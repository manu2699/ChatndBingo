import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { ClientMessage, ServerMessage } from "@bingo/shared";
import { orderedBoard } from "@bingo/shared";
import { config } from "./config";
import { startServer } from "./server";
import { MemoryStore } from "./store";

let app: ReturnType<typeof startServer>;
let url: string;

beforeAll(() => {
	app = startServer({ ...config, port: 0, hostname: "127.0.0.1", turnSkipMs: 150, persistDebounceMs: 10 }, new MemoryStore());
	url = `ws://127.0.0.1:${app.server.port}/ws`;
});
afterAll(() => app.stop());

class Client {
	ws: WebSocket;
	inbox: ServerMessage[] = [];
	private waiters: { match: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }[] = [];
	playerId = "";
	token = "";
	code = "";

	private constructor(ws: WebSocket) {
		this.ws = ws;
		ws.onmessage = (e) => {
			const m = JSON.parse(String(e.data)) as ServerMessage;
			this.inbox.push(m);
			this.waiters = this.waiters.filter((w) => {
				if (!w.match(m)) return true;
				w.resolve(m);
				return false;
			});
		};
	}

	static async connect() {
		const ws = new WebSocket(url);
		const c = new Client(ws);
		await new Promise<void>((resolve, reject) => {
			ws.onopen = () => resolve();
			ws.onerror = () => reject(new Error("ws error"));
		});
		await c.next("hello");
		return c;
	}

	send(m: ClientMessage) {
		this.ws.send(JSON.stringify(m));
	}

	/** Wait for the next message of type `t` that arrives after now, or one already queued. */
	next<T extends ServerMessage["t"]>(t: T, pred: (m: Extract<ServerMessage, { t: T }>) => boolean = () => true) {
		const match = (m: ServerMessage): m is Extract<ServerMessage, { t: T }> =>
			m.t === t && pred(m as Extract<ServerMessage, { t: T }>);
		const queued = this.inbox.findIndex(match);
		if (queued !== -1) return Promise.resolve(this.inbox.splice(queued, 1)[0] as Extract<ServerMessage, { t: T }>);
		return new Promise<Extract<ServerMessage, { t: T }>>((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error(`timeout waiting for ${t}`)), 2000);
			this.waiters.push({
				match,
				resolve: (m) => {
					clearTimeout(timer);
					const i = this.inbox.indexOf(m);
					if (i !== -1) this.inbox.splice(i, 1);
					resolve(m as Extract<ServerMessage, { t: T }>);
				}
			});
		});
	}

	async create(name: string) {
		this.send({ t: "room.create", name });
		const s = await this.next("session");
		Object.assign(this, { playerId: s.playerId, token: s.token, code: s.code });
		return s;
	}

	async join(code: string, name: string) {
		this.send({ t: "room.join", code, name });
		const s = await this.next("session");
		Object.assign(this, { playerId: s.playerId, token: s.token, code: s.code });
		return s;
	}

	close() {
		this.ws.close();
	}
}

describe("websocket server", () => {
	test("healthz and unknown routes", async () => {
		const res = await fetch(`http://127.0.0.1:${app.server.port}/healthz`);
		expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
		const missing = await fetch(`http://127.0.0.1:${app.server.port}/nope.js`);
		expect(missing.status).toBe(404);
	});

	test("rejects malformed frames and unauthenticated actions", async () => {
		const c = await Client.connect();
		c.ws.send("garbage");
		expect((await c.next("error")).code).toBe("bad_message");
		c.send({ t: "chat.send", text: "hi" });
		expect((await c.next("error")).code).toBe("not_in_room");
		c.close();
	});

	test("create, check, join and full room flow", async () => {
		const a = await Client.connect();
		const b = await Client.connect();
		const { code } = await a.create("Ann");
		expect(code).toHaveLength(5);

		b.send({ t: "room.check", code, rid: "r1" });
		expect(await b.next("room.status")).toMatchObject({ available: true, rid: "r1" });

		b.send({ t: "room.check", code: "ZZZZZ" });
		expect(await b.next("room.status")).toMatchObject({ available: false, reason: "no_room" });

		await b.join(code, "Bo");
		const state = await a.next("room.state", (m) => m.room.players.length === 2);
		expect(state.room.players.map((p) => p.name)).toEqual(["Ann", "Bo"]);

		b.send({ t: "room.join", code, name: "Ann" });
		expect((await b.next("error")).code).toBe("name_taken");
		a.close();
		b.close();
	});

	test("full game: ready, start, strikes, win, replay", async () => {
		const a = await Client.connect();
		const b = await Client.connect();
		const { code } = await a.create("Ann");
		await b.join(code, "Bo");

		a.send({ t: "player.ready", board: orderedBoard() });
		await a.next("board.locked");
		b.send({ t: "player.ready", board: orderedBoard() });
		await b.next("board.locked");

		b.send({ t: "game.start" });
		expect((await b.next("error")).code).toBe("not_host");
		a.send({ t: "game.start" });
		const playing = await a.next("room.state", (m) => m.room.phase === "playing");
		expect(playing.room.turn).toBe(a.playerId);

		b.send({ t: "game.strike", n: 1 });
		expect((await b.next("error")).code).toBe("not_your_turn");

		let current = a;
		let over: Extract<ServerMessage, { t: "game.over" }> | undefined;
		for (let n = 1; n <= 25 && !over; n++) {
			current.send({ t: "game.strike", n });
			const ev = await current.next("game.strike", (m) => m.n === n);
			expect(ev.n).toBe(n);
			if (n >= 21) {
				over = await current.next("game.over");
			} else {
				current = ev.next === a.playerId ? a : b;
			}
		}
		expect(over!.winners.sort()).toEqual([a.playerId, b.playerId].sort());

		a.send({ t: "game.again" });
		const lobby = await a.next("room.state", (m) => m.room.phase === "lobby");
		expect(lobby.room.called).toEqual([]);
		a.close();
		b.close();
	});

	test("chat is broadcast to the room", async () => {
		const a = await Client.connect();
		const b = await Client.connect();
		const { code } = await a.create("Ann");
		await b.join(code, "Bo");
		a.send({ t: "chat.send", text: "hello bo" });
		const msg = await b.next("chat.msg", (m) => m.msg.text === "hello bo");
		expect(msg.msg.name).toBe("Ann");
		a.close();
		b.close();
	});

	test("resume reclaims the seat; a bad token is refused", async () => {
		const a = await Client.connect();
		const b = await Client.connect();
		const { code } = await a.create("Ann");
		await b.join(code, "Bo");
		const { playerId, token } = a;
		a.close();
		const offline = await b.next("room.state", (m) => m.room.players.some((p) => !p.connected));
		expect(offline.room.players.find((p) => p.id === playerId)!.connected).toBe(false);

		const a2 = await Client.connect();
		a2.send({ t: "room.resume", code, playerId, token: "0".repeat(token.length) });
		expect((await a2.next("error")).code).toBe("bad_session");

		a2.send({ t: "room.resume", code, playerId, token });
		const s = await a2.next("session");
		expect(s.playerId).toBe(playerId);
		const back = await b.next("room.state", (m) => m.room.players.every((p) => p.connected));
		expect(back.room.players).toHaveLength(2);
		a2.close();
		b.close();
	});

	test("turn passes on when the current player stays offline", async () => {
		const a = await Client.connect();
		const b = await Client.connect();
		const { code } = await a.create("Ann");
		await b.join(code, "Bo");
		a.send({ t: "player.ready", board: orderedBoard() });
		b.send({ t: "player.ready", board: orderedBoard() });
		await b.next("board.locked");
		await a.next("board.locked");
		a.send({ t: "game.start" });
		await b.next("room.state", (m) => m.room.turn === a.playerId);
		a.close();
		const moved = await b.next("room.state", (m) => m.room.turn === b.playerId);
		expect(moved.room.phase).toBe("playing");
		b.close();
	});

	test("leaving removes the player and moves the host", async () => {
		const a = await Client.connect();
		const b = await Client.connect();
		const { code } = await a.create("Ann");
		await b.join(code, "Bo");
		a.send({ t: "room.leave" });
		await a.next("left");
		const st = await b.next("room.state", (m) => m.room.players.length === 1);
		expect(st.room.hostId).toBe(b.playerId);
		a.close();
		b.close();
	});
});

describe("restart recovery", () => {
	test("rooms rehydrate from the store and players can resume", async () => {
		const store = new MemoryStore();
		const cfg = { ...config, port: 0, hostname: "127.0.0.1", persistDebounceMs: 10 };
		const first = startServer(cfg, store);
		const connect = async (port: number) => {
			const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
			const msgs: ServerMessage[] = [];
			ws.onmessage = (e) => msgs.push(JSON.parse(String(e.data)));
			await new Promise<void>((r) => (ws.onopen = () => r()));
			const waitFor = async (t: string) => {
				for (let i = 0; i < 100; i++) {
					const hit = msgs.find((m) => m.t === t);
					if (hit) return hit;
					await Bun.sleep(10);
				}
				throw new Error(`timeout ${t}`);
			};
			return { ws, waitFor };
		};

		const a = await connect(first.server.port!);
		a.ws.send(JSON.stringify({ t: "room.create", name: "Ann" }));
		const s = (await a.waitFor("session")) as Extract<ServerMessage, { t: "session" }>;
		await Bun.sleep(50); // let the debounced save land
		await first.server.stop(true);

		// New process, same store (a real deploy would point both at Redis).
		const second = startServer(cfg, store);
		const b = await connect(second.server.port!);
		b.ws.send(JSON.stringify({ t: "room.resume", code: s.code, playerId: s.playerId, token: s.token }));
		const resumed = (await b.waitFor("session")) as Extract<ServerMessage, { t: "session" }>;
		expect(resumed.playerId).toBe(s.playerId);
		const state = (await b.waitFor("room.state")) as Extract<ServerMessage, { t: "room.state" }>;
		expect(state.room.players[0]!.connected).toBe(true);
		b.ws.close();
		await second.server.stop(true);
	});
});
