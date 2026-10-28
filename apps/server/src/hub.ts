import type { ServerWebSocket } from "bun";
import {
	ROOM_CODE_ALPHABET,
	ROOM_CODE_LENGTH,
	parseClientMessage,
	type ClientMessage,
	type ServerMessage
} from "@bingo/shared";
import type { Config } from "./config";
import {
	GameError,
	addChat,
	addPlayer,
	checkToken,
	createRoom,
	findPlayer,
	playAgain,
	removePlayer,
	setConnected,
	setReady,
	setUnready,
	snapshot,
	startGame,
	strike,
	nextTurn,
	type RoomState
} from "./engine";
import type { RoomStore } from "./store";

export interface SocketData {
	connId: string;
	code?: string;
	playerId?: string;
	global: Bucket;
	chat: Bucket;
}

export type Socket = ServerWebSocket<SocketData>;

/** Token bucket: `burst` messages up front, refilling `perSecond`. */
export class Bucket {
	private tokens: number;
	private last = Date.now();
	constructor(
		private burst: number,
		private perSecond: number
	) {
		this.tokens = burst;
	}
	take(now = Date.now()) {
		this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.perSecond);
		this.last = now;
		if (this.tokens < 1) return false;
		this.tokens -= 1;
		return true;
	}
}

export const newSocketData = (): SocketData => ({
	connId: crypto.randomUUID(),
	global: new Bucket(30, 15),
	chat: new Bucket(5, 1)
});

const topic = (code: string) => `room:${code}`;

const makeCode = () => {
	const bytes = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH));
	let out = "";
	for (const b of bytes) out += ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length];
	return out;
};

type Publisher = (topic: string, data: string) => void;

export class Hub {
	private rooms = new Map<string, RoomState>();
	private sockets = new Map<string, Socket>(); // playerId -> socket
	private connections = 0;
	private persistTimers = new Map<string, Timer>();
	private skipTimers = new Map<string, Timer>(); // playerId -> turn-skip timer
	private seatTimers = new Map<string, Timer>(); // playerId -> seat-release timer
	private sweep: Timer;

	constructor(
		private store: RoomStore,
		private cfg: Config,
		private publish: Publisher
	) {
		this.sweep = setInterval(() => this.evictIdle(), 60_000);
		this.sweep.unref?.();
	}

	get stats() {
		return { rooms: this.rooms.size, connections: this.connections };
	}

	canAccept() {
		return this.connections < this.cfg.maxConnections;
	}

	// ---------------------------------------------------------------- lifecycle

	open(ws: Socket) {
		this.connections++;
		this.send(ws, { t: "hello", heartbeatMs: this.cfg.heartbeatMs });
	}

	async close(ws: Socket) {
		this.connections = Math.max(0, this.connections - 1);
		const { code, playerId } = ws.data;
		if (!code || !playerId) return;
		// A newer socket may already own this seat (resume); leave it alone.
		if (this.sockets.get(playerId) !== ws) return;
		this.sockets.delete(playerId);
		const room = this.rooms.get(code);
		if (!room) return;
		setConnected(room, playerId, false);
		this.armSeatTimer(room, playerId);
		if (room.turn === playerId) this.armSkipTimer(room, playerId);
		this.broadcastState(room);
		this.persist(room);
	}

	async message(ws: Socket, raw: string | Buffer) {
		const text = typeof raw === "string" ? raw : raw.toString("utf8");
		const msg = parseClientMessage(text);
		if (!msg) return this.error(ws, "bad_message", "Malformed message");
		if (msg.t === "ping") return this.send(ws, { t: "pong" });
		if (!ws.data.global.take()) return this.error(ws, "rate_limited", "Slow down", msg);

		try {
			await this.dispatch(ws, msg);
		} catch (err) {
			if (err instanceof GameError) return this.error(ws, err.code, err.message, msg);
			console.error("[hub] unhandled", err);
			this.error(ws, "bad_message", "Something went wrong", msg);
		}
	}

	async shutdown() {
		clearInterval(this.sweep);
		for (const t of [...this.skipTimers.values(), ...this.seatTimers.values()]) clearTimeout(t);
		await Promise.all([...this.rooms.values()].map((r) => this.flush(r)));
	}

	// ----------------------------------------------------------------- dispatch

	private async dispatch(ws: Socket, msg: ClientMessage) {
		switch (msg.t) {
			case "room.check":
				return this.checkRoom(ws, msg);
			case "room.create":
				return this.createRoom(ws, msg);
			case "room.join":
				return this.joinRoom(ws, msg);
			case "room.resume":
				return this.resumeRoom(ws, msg);
		}

		// Everything below needs a seat.
		const { room, playerId } = this.seat(ws);
		switch (msg.t) {
			case "room.leave":
				return this.leave(ws, room, playerId, msg);
			case "player.ready":
				setReady(room, playerId, msg.board);
				this.send(ws, { t: "board.locked", board: msg.board });
				break;
			case "player.unready":
				setUnready(room, playerId);
				this.send(ws, { t: "board.unlocked" });
				break;
			case "game.start":
				startGame(room, playerId);
				break;
			case "game.strike": {
				const res = strike(room, playerId, msg.n);
				this.publish(topic(room.code), JSON.stringify({ t: "game.strike", by: res.by, n: res.n, next: res.next }));
				if (res.winners.length) {
					this.publish(topic(room.code), JSON.stringify({ t: "game.over", winners: res.winners }));
				}
				break;
			}
			case "game.again":
				playAgain(room, playerId);
				for (const p of room.players) this.sockets.get(p.id)?.send(JSON.stringify({ t: "board.unlocked" }));
				break;
			case "chat.send": {
				if (!ws.data.chat.take()) throw new GameError("rate_limited", "You're sending messages too fast");
				const from = findPlayer(room, playerId)!;
				const chat = addChat(room, from, msg.text);
				this.publish(topic(room.code), JSON.stringify({ t: "chat.msg", msg: chat }));
				this.persist(room);
				return;
			}
			case "chat.typing":
				ws.publish(topic(room.code), JSON.stringify({ t: "chat.typing", from: playerId }));
				return;
		}
		room.updatedAt = Date.now();
		this.broadcastState(room);
		this.persist(room, msg.t !== "player.ready" && msg.t !== "player.unready");
	}

	private seat(ws: Socket) {
		const { code, playerId } = ws.data;
		const room = code ? this.rooms.get(code) : undefined;
		if (!room || !playerId || !findPlayer(room, playerId)) {
			throw new GameError("not_in_room", "Join a room first");
		}
		return { room, playerId };
	}

	// -------------------------------------------------------------------- rooms

	private async getRoom(code: string): Promise<RoomState | null> {
		const live = this.rooms.get(code);
		if (live) return live;
		const stored = await this.store.load(code).catch((err) => {
			console.error("[store] load failed", err);
			return null;
		});
		if (!stored) return null;
		// Whoever was connected before the restart is not connected now.
		for (const p of stored.players) {
			p.connected = false;
			this.armSeatTimer(stored, p.id);
		}
		this.rooms.set(code, stored);
		return stored;
	}

	private async checkRoom(ws: Socket, msg: Extract<ClientMessage, { t: "room.check" }>) {
		const room = await this.getRoom(msg.code);
		const base = { t: "room.status", rid: msg.rid, code: msg.code } as const;
		if (!room) return this.send(ws, { ...base, available: false, reason: "no_room" });
		const open = room.phase === "lobby" && room.players.length < room.maxPlayers;
		this.send(ws, open ? { ...base, available: true } : { ...base, available: false, reason: "room_full" });
	}

	private async createRoom(ws: Socket, msg: Extract<ClientMessage, { t: "room.create" }>) {
		if (this.rooms.size >= this.cfg.maxRooms) throw new GameError("server_busy", "Too many rooms right now");
		this.detach(ws);

		let code = "";
		for (let attempt = 0; attempt < 8; attempt++) {
			const candidate = makeCode();
			if (this.rooms.has(candidate)) continue;
			if (await this.store.claim(candidate, this.cfg.roomTtlSeconds)) {
				code = candidate;
				break;
			}
		}
		if (!code) throw new GameError("server_busy", "Couldn't allocate a room, try again");

		const { room, host } = createRoom(code, msg.name, msg.maxPlayers);
		this.rooms.set(code, room);
		addChat(room, null, `Welcome ${host.name}! Share the room code ${code} with your friends.`);
		this.attach(ws, room, host.id);
		this.session(ws, room, host, msg.rid);
		this.broadcastState(room);
		this.persist(room, true);
	}

	private async joinRoom(ws: Socket, msg: Extract<ClientMessage, { t: "room.join" }>) {
		const room = await this.getRoom(msg.code);
		if (!room) throw new GameError("no_room", `No room called ${msg.code}`);
		this.detach(ws);
		const player = addPlayer(room, msg.name);
		this.attach(ws, room, player.id);
		addChat(room, null, `${player.name} joined the room.`);
		this.session(ws, room, player, msg.rid);
		room.updatedAt = Date.now();
		this.broadcastState(room);
		this.publish(topic(room.code), JSON.stringify({ t: "chat.msg", msg: room.chat.at(-1) }));
		this.persist(room, true);
	}

	private async resumeRoom(ws: Socket, msg: Extract<ClientMessage, { t: "room.resume" }>) {
		const room = await this.getRoom(msg.code);
		if (!room) throw new GameError("no_room", `No room called ${msg.code}`);
		const player = checkToken(room, msg.playerId, msg.token);
		this.detach(ws);
		const previous = this.sockets.get(player.id);
		if (previous && previous !== ws) {
			previous.data.playerId = undefined; // so its close() doesn't touch the seat
			previous.close(4000, "replaced");
		}
		this.attach(ws, room, player.id);
		this.session(ws, room, player, msg.rid);
		if (player.board && player.ready) this.send(ws, { t: "board.locked", board: player.board });
		this.broadcastState(room);
		this.persist(room);
	}

	private leave(ws: Socket, room: RoomState, playerId: string, msg: ClientMessage) {
		const name = findPlayer(room, playerId)?.name ?? "Someone";
		this.detach(ws, true);
		this.dropSeat(room, playerId, `${name} left the room.`);
		this.send(ws, { t: "left", rid: "rid" in msg ? msg.rid : undefined });
	}

	/** Remove a player and tell the room; delete the room if it's empty. */
	private dropSeat(room: RoomState, playerId: string, note: string) {
		this.clearTimers(playerId);
		this.sockets.delete(playerId);
		removePlayer(room, playerId);
		if (room.players.length === 0) {
			this.rooms.delete(room.code);
			clearTimeout(this.persistTimers.get(room.code));
			this.persistTimers.delete(room.code);
			void this.store.remove(room.code);
			return;
		}
		const msg = addChat(room, null, note);
		this.publish(topic(room.code), JSON.stringify({ t: "chat.msg", msg }));
		this.broadcastState(room);
		this.persist(room, true);
	}

	// ------------------------------------------------------------------ sockets

	private attach(ws: Socket, room: RoomState, playerId: string) {
		ws.data.code = room.code;
		ws.data.playerId = playerId;
		ws.subscribe(topic(room.code));
		this.sockets.set(playerId, ws);
		setConnected(room, playerId, true);
		this.clearTimers(playerId);
	}

	/** Detach a socket from whichever seat it holds (e.g. before creating/joining another room). */
	private detach(ws: Socket, leaving = false) {
		const { code, playerId } = ws.data;
		if (!code || !playerId) return;
		ws.unsubscribe(topic(code));
		if (this.sockets.get(playerId) === ws) this.sockets.delete(playerId);
		const room = this.rooms.get(code);
		ws.data.code = undefined;
		ws.data.playerId = undefined;
		if (!leaving && room && findPlayer(room, playerId)) {
			// Switching rooms without an explicit leave: free the seat.
			this.dropSeat(room, playerId, `${findPlayer(room, playerId)!.name} left the room.`);
		}
	}

	private session(ws: Socket, room: RoomState, player: { id: string; token: string }, rid?: string) {
		this.send(ws, { t: "session", rid, code: room.code, playerId: player.id, token: player.token, you: player.id });
		this.send(ws, { t: "chat.history", messages: room.chat });
	}

	private send(ws: Socket, msg: ServerMessage) {
		ws.send(JSON.stringify(msg));
	}

	private error(ws: Socket, code: Extract<ServerMessage, { t: "error" }>["code"], message: string, to?: ClientMessage) {
		const rid = to && "rid" in to ? to.rid : undefined;
		this.send(ws, { t: "error", rid, code, message });
	}

	private broadcastState(room: RoomState) {
		this.publish(topic(room.code), JSON.stringify({ t: "room.state", room: snapshot(room) } satisfies ServerMessage));
	}

	// ------------------------------------------------------------------- timers

	private clearTimers(playerId: string) {
		clearTimeout(this.skipTimers.get(playerId));
		clearTimeout(this.seatTimers.get(playerId));
		this.skipTimers.delete(playerId);
		this.seatTimers.delete(playerId);
	}

	/** If the player whose turn it is stays offline, pass the turn on. */
	private armSkipTimer(room: RoomState, playerId: string) {
		clearTimeout(this.skipTimers.get(playerId));
		const timer = setTimeout(() => {
			this.skipTimers.delete(playerId);
			const p = findPlayer(room, playerId);
			if (!p || p.connected || room.turn !== playerId || room.phase !== "playing") return;
			room.turn = nextTurn(room, playerId);
			this.broadcastState(room);
			this.persist(room);
		}, this.cfg.turnSkipMs);
		this.skipTimers.set(playerId, timer);
	}

	/** A player offline for too long gives up their seat. */
	private armSeatTimer(room: RoomState, playerId: string) {
		clearTimeout(this.seatTimers.get(playerId));
		const timer = setTimeout(() => {
			this.seatTimers.delete(playerId);
			const p = findPlayer(room, playerId);
			if (!p || p.connected) return;
			this.dropSeat(room, playerId, `${p.name} disconnected.`);
		}, this.cfg.seatGraceMs);
		this.seatTimers.set(playerId, timer);
	}

	// -------------------------------------------------------------- persistence

	private persist(room: RoomState, immediate = false) {
		room.updatedAt = Date.now();
		clearTimeout(this.persistTimers.get(room.code));
		if (immediate) {
			this.persistTimers.delete(room.code);
			void this.flush(room);
			return;
		}
		this.persistTimers.set(
			room.code,
			setTimeout(() => {
				this.persistTimers.delete(room.code);
				void this.flush(room);
			}, this.cfg.persistDebounceMs)
		);
	}

	private async flush(room: RoomState) {
		if (!this.rooms.has(room.code)) return;
		await this.store.save(room, this.cfg.roomTtlSeconds).catch((err) => console.error("[store] save failed", err));
	}

	private evictIdle() {
		const cutoff = Date.now() - this.cfg.evictAfterMs;
		for (const [code, room] of this.rooms) {
			if (room.updatedAt > cutoff) continue;
			if (room.players.some((p) => p.connected)) continue;
			void this.flush(room).then(() => {
				// Only drop it if nobody came back while we were saving.
				if (!room.players.some((p) => p.connected)) this.rooms.delete(code);
			});
		}
	}
}
