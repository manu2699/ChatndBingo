import type { ClientMessage, ErrorCode, ServerMessage } from "@bingo/shared";

export type Status = "connecting" | "open" | "reconnecting" | "waking";

/** Free-tier hosts sleep when idle; after this long without an answer we tell the user why. */
const WAKING_AFTER_MS = 3500;
const REQUEST_TIMEOUT_MS = 20_000;

export class ApiError extends Error {
	constructor(
		readonly code: ErrorCode | "timeout" | "closed",
		message: string
	) {
		super(message);
	}
}

type Pending = {
	resolve: (m: ServerMessage) => void;
	reject: (e: ApiError) => void;
	timer: ReturnType<typeof setTimeout>;
};

export const defaultUrl = () => {
	const env = import.meta.env.VITE_WS_URL as string | undefined;
	if (env) return env;
	const proto = location.protocol === "https:" ? "wss" : "ws";
	return `${proto}://${location.host}/ws`;
};

/**
 * WebSocket wrapper: backoff reconnects, heartbeat watchdog, and request/response
 * correlation via `rid`. Knows nothing about the game.
 */
export class GameSocket {
	status: Status = "connecting";

	private ws: WebSocket | null = null;
	private attempts = 0;
	private everOpened = false;
	private stopped = false;
	private seq = 0;
	private pending = new Map<string, Pending>();
	private openWaiters: (() => void)[] = [];
	private statusHandlers = new Set<(s: Status) => void>();
	private messageHandlers = new Set<(m: ServerMessage) => void>();
	private retryTimer?: ReturnType<typeof setTimeout>;
	private wakingTimer?: ReturnType<typeof setTimeout>;
	private pingTimer?: ReturnType<typeof setInterval>;
	private lastSeen = 0;

	constructor(private url: string = defaultUrl()) {}

	connect() {
		this.stopped = false;
		this.open();
		if (typeof window !== "undefined") {
			window.addEventListener("online", this.nudge);
			document.addEventListener("visibilitychange", this.nudge);
		}
	}

	close() {
		this.stopped = true;
		clearTimeout(this.retryTimer);
		clearTimeout(this.wakingTimer);
		clearInterval(this.pingTimer);
		window.removeEventListener("online", this.nudge);
		document.removeEventListener("visibilitychange", this.nudge);
		this.ws?.close();
	}

	onStatus(h: (s: Status) => void) {
		this.statusHandlers.add(h);
		return () => this.statusHandlers.delete(h);
	}

	onMessage(h: (m: ServerMessage) => void) {
		this.messageHandlers.add(h);
		return () => this.messageHandlers.delete(h);
	}

	/** Fire and forget. Dropped silently if the socket isn't open. */
	send(msg: ClientMessage) {
		if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
	}

	/** Send and wait for the reply carrying the same rid (waits for the socket to open first). */
	async request(msg: Exclude<ClientMessage, { t: "ping" }>): Promise<ServerMessage> {
		if (this.status !== "open") await this.whenOpen();
		const rid = `r${++this.seq}`;
		return new Promise<ServerMessage>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(rid);
				reject(new ApiError("timeout", "The server took too long to answer"));
			}, REQUEST_TIMEOUT_MS);
			this.pending.set(rid, { resolve, reject, timer });
			this.send({ ...msg, rid } as ClientMessage);
		});
	}

	whenOpen() {
		return new Promise<void>((resolve) => {
			if (this.status === "open") resolve();
			else this.openWaiters.push(resolve);
		});
	}

	// ---------------------------------------------------------------- internals

	private setStatus(s: Status) {
		if (this.status === s) return;
		this.status = s;
		this.statusHandlers.forEach((h) => h(s));
	}

	private open() {
		if (this.stopped) return;
		if (this.everOpened) this.setStatus("reconnecting");
		else if (this.status !== "waking") this.setStatus("connecting");
		clearTimeout(this.wakingTimer);
		if (!this.everOpened) {
			this.wakingTimer = setTimeout(() => {
				if (this.status !== "open") this.setStatus("waking");
			}, WAKING_AFTER_MS);
		}

		let ws: WebSocket;
		try {
			ws = new WebSocket(this.url);
		} catch {
			return this.scheduleRetry();
		}
		this.ws = ws;

		ws.onopen = () => {
			this.attempts = 0;
			this.everOpened = true;
			this.lastSeen = Date.now();
			clearTimeout(this.wakingTimer);
			this.setStatus("open");
			const waiters = this.openWaiters;
			this.openWaiters = [];
			waiters.forEach((w) => w());
		};

		ws.onmessage = (e) => {
			this.lastSeen = Date.now();
			let msg: ServerMessage;
			try {
				msg = JSON.parse(String(e.data)) as ServerMessage;
			} catch {
				return;
			}
			if (msg.t === "hello") this.startHeartbeat(msg.heartbeatMs);
			if (msg.t === "pong") return;
			const rid = "rid" in msg ? msg.rid : undefined;
			const waiting = rid ? this.pending.get(rid) : undefined;
			if (waiting && rid) {
				this.pending.delete(rid);
				clearTimeout(waiting.timer);
				if (msg.t === "error") waiting.reject(new ApiError(msg.code, msg.message));
				else waiting.resolve(msg);
			}
			this.messageHandlers.forEach((h) => h(msg));
		};

		ws.onclose = () => {
			if (this.ws !== ws) return;
			clearInterval(this.pingTimer);
			this.failPending();
			this.ws = null;
			if (!this.stopped) this.scheduleRetry();
		};

		ws.onerror = () => ws.close();
	}

	private failPending() {
		for (const [rid, p] of this.pending) {
			clearTimeout(p.timer);
			p.reject(new ApiError("closed", "Connection lost"));
			this.pending.delete(rid);
		}
	}

	private scheduleRetry() {
		if (this.stopped) return;
		if (this.status === "open") this.setStatus("reconnecting");
		const base = Math.min(8000, 500 * 2 ** this.attempts++);
		const delay = base * (0.75 + Math.random() * 0.5);
		clearTimeout(this.retryTimer);
		this.retryTimer = setTimeout(() => this.open(), delay);
		if (this.everOpened) this.setStatus("reconnecting");
	}

	/** Reconnect right away when the user comes back online / to the tab. */
	private nudge = () => {
		if (document.visibilityState === "hidden") return;
		if (this.ws && this.ws.readyState <= WebSocket.OPEN) {
			// Looks alive; make sure it really is.
			if (this.status === "open" && Date.now() - this.lastSeen > 20_000) this.send({ t: "ping" });
			return;
		}
		clearTimeout(this.retryTimer);
		this.attempts = 0;
		this.open();
	};

	private startHeartbeat(everyMs: number) {
		clearInterval(this.pingTimer);
		this.pingTimer = setInterval(() => {
			if (Date.now() - this.lastSeen > everyMs * 2.5) {
				this.ws?.close(); // watchdog: socket is half-dead
				return;
			}
			this.send({ t: "ping" });
		}, everyMs);
	}
}
