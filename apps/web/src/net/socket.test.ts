import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { ServerMessage } from "@bingo/shared";

// Minimal browser globals so the module can run under bun:test without a DOM.
const g = globalThis as Record<string, unknown>;
g.window = { addEventListener() {}, removeEventListener() {} };
g.document = { addEventListener() {}, removeEventListener() {}, visibilityState: "visible" };
g.location = { protocol: "http:", host: "localhost" };

class FakeWebSocket {
	static OPEN = 1;
	static instances: FakeWebSocket[] = [];
	readyState = 0;
	sent: string[] = [];
	onopen: (() => void) | null = null;
	onmessage: ((e: { data: string }) => void) | null = null;
	onclose: (() => void) | null = null;
	onerror: (() => void) | null = null;
	constructor(public url: string) {
		FakeWebSocket.instances.push(this);
	}
	send(data: string) {
		this.sent.push(data);
	}
	close() {
		this.readyState = 3;
		this.onclose?.();
	}
	// test helpers
	open() {
		this.readyState = 1;
		this.onopen?.();
	}
	receive(m: ServerMessage) {
		this.onmessage?.({ data: JSON.stringify(m) });
	}
}
g.WebSocket = FakeWebSocket;

const { ApiError, GameSocket } = await import("./socket");

let sock: InstanceType<typeof GameSocket>;
const current = () => FakeWebSocket.instances.at(-1)!;

beforeEach(() => {
	FakeWebSocket.instances = [];
	sock = new GameSocket("ws://test/ws");
	sock.connect();
});
afterEach(() => sock.close());

describe("GameSocket", () => {
	test("goes connecting -> open and resolves whenOpen", async () => {
		expect(sock.status).toBe("connecting");
		const opened = sock.whenOpen();
		current().open();
		await opened;
		expect(sock.status).toBe("open");
	});

	test("correlates replies by rid and rejects on error", async () => {
		current().open();
		const ok = sock.request({ t: "room.check", code: "ABCDE" });
		const { rid, ...rest } = JSON.parse(current().sent[0]!);
		expect(rest).toEqual({ t: "room.check", code: "ABCDE" });
		expect(typeof rid).toBe("string");
		current().receive({ t: "room.status", rid, code: "ABCDE", available: true });
		expect(await ok).toMatchObject({ available: true });

		const bad = sock.request({ t: "game.start" });
		const badRid = JSON.parse(current().sent[1]!).rid;
		current().receive({ t: "error", rid: badRid, code: "not_host", message: "Only the host can start" });
		const err = await bad.catch((e) => e);
		expect(err).toBeInstanceOf(ApiError);
		expect(err.code).toBe("not_host");
	});

	test("queues requests until the socket opens", async () => {
		const pending = sock.request({ t: "room.check", code: "ABCDE" });
		expect(current().sent).toHaveLength(0);
		current().open();
		await Promise.resolve();
		await Promise.resolve();
		expect(current().sent).toHaveLength(1);
		const rid = JSON.parse(current().sent[0]!).rid;
		current().receive({ t: "ok", rid });
		expect(await pending).toEqual({ t: "ok", rid });
	});

	test("fails in-flight requests and reconnects when the socket drops", async () => {
		current().open();
		const inflight = sock.request({ t: "game.start" });
		const first = current();
		first.close();
		expect((await inflight.catch((e) => e)).code).toBe("closed");
		expect(sock.status).toBe("reconnecting");
		await Bun.sleep(1000); // first backoff is ~500ms +/- 25%
		expect(FakeWebSocket.instances.length).toBe(2);
		current().open();
		expect(sock.status).toBe("open");
	});

	test("broadcasts messages without a rid to handlers", () => {
		const seen: ServerMessage[] = [];
		sock.onMessage((m) => seen.push(m));
		current().open();
		current().receive({ t: "chat.history", messages: [] });
		expect(seen.map((m) => m.t)).toEqual(["chat.history"]);
	});
});
