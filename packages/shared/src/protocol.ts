import { isValidBoard, isValidCall } from "./board";

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 5;
export const MAX_NAME_LENGTH = 16;
export const MAX_CHAT_LENGTH = 300;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const DEFAULT_PLAYERS = 4;

export type Phase = "lobby" | "playing" | "finished";

export interface PublicPlayer {
	id: string;
	name: string;
	ready: boolean;
	connected: boolean;
	/** Completed lines, public during play so everyone sees the B-I-N-G-O progress. */
	lines: number;
}

export interface ChatMessage {
	id: string;
	/** Player id, or null for system messages. */
	from: string | null;
	name: string;
	text: string;
	at: number;
}

export interface RoomSnapshot {
	code: string;
	phase: Phase;
	hostId: string;
	maxPlayers: number;
	players: PublicPlayer[];
	/** Numbers called so far, in order. */
	called: number[];
	turn: string | null;
	winners: string[];
}

export type ErrorCode =
	| "bad_message"
	| "no_room"
	| "room_full"
	| "name_taken"
	| "bad_session"
	| "not_in_room"
	| "not_host"
	| "bad_phase"
	| "bad_board"
	| "not_ready"
	| "not_your_turn"
	| "already_called"
	| "rate_limited"
	| "server_busy";

/** Messages the client sends. `rid` is echoed back on the reply. */
export type ClientMessage =
	| { t: "room.create"; rid?: string; name: string; maxPlayers?: number }
	| { t: "room.join"; rid?: string; code: string; name: string }
	| { t: "room.resume"; rid?: string; code: string; playerId: string; token: string }
	| { t: "room.check"; rid?: string; code: string }
	| { t: "room.leave"; rid?: string }
	| { t: "player.ready"; rid?: string; board: number[] }
	| { t: "player.unready"; rid?: string }
	| { t: "game.start"; rid?: string }
	| { t: "game.strike"; rid?: string; n: number }
	| { t: "game.again"; rid?: string }
	| { t: "chat.send"; rid?: string; text: string }
	| { t: "chat.typing"; rid?: string }
	| { t: "ping" };

/** Messages the server sends. */
export type ServerMessage =
	| { t: "hello"; heartbeatMs: number }
	| { t: "session"; rid?: string; code: string; playerId: string; token: string; you: string }
	| { t: "room.status"; rid?: string; code: string; available: boolean; reason?: "no_room" | "room_full" }
	| { t: "room.state"; room: RoomSnapshot }
	| { t: "board.locked"; board: number[] }
	| { t: "board.unlocked" }
	| { t: "game.strike"; by: string; n: number; next: string | null }
	| { t: "game.over"; winners: string[] }
	| { t: "chat.history"; messages: ChatMessage[] }
	| { t: "chat.msg"; msg: ChatMessage }
	| { t: "chat.typing"; from: string }
	| { t: "left"; rid?: string }
	| { t: "error"; rid?: string; code: ErrorCode; message: string }
	/** Generic success reply for requests whose real effect arrives as a broadcast. */
	| { t: "ok"; rid: string }
	| { t: "pong" };

const str = (v: unknown, max: number): string | null => {
	if (typeof v !== "string") return null;
	const s = v.trim();
	return s.length > 0 && s.length <= max ? s : null;
};

export const normalizeCode = (code: unknown): string | null => {
	if (typeof code !== "string") return null;
	const c = code.trim().toUpperCase();
	if (c.length !== ROOM_CODE_LENGTH) return null;
	for (const ch of c) if (!ROOM_CODE_ALPHABET.includes(ch)) return null;
	return c;
};

export const cleanName = (name: unknown): string | null => {
	const s = str(typeof name === "string" ? name.replace(/\s+/g, " ") : name, MAX_NAME_LENGTH);
	return s;
};

/** Validate an untrusted frame. Returns null for anything malformed. */
export const parseClientMessage = (raw: unknown): ClientMessage | null => {
	let m: unknown = raw;
	if (typeof raw === "string") {
		if (raw.length > 4096) return null;
		try {
			m = JSON.parse(raw);
		} catch {
			return null;
		}
	}
	if (typeof m !== "object" || m === null) return null;
	const o = m as Record<string, unknown>;
	const rid = typeof o.rid === "string" && o.rid.length <= 40 ? o.rid : undefined;

	switch (o.t) {
		case "ping":
			return { t: "ping" };
		case "room.create": {
			const name = cleanName(o.name);
			if (!name) return null;
			let maxPlayers: number | undefined;
			if (o.maxPlayers !== undefined) {
				if (
					!Number.isInteger(o.maxPlayers) ||
					(o.maxPlayers as number) < MIN_PLAYERS ||
					(o.maxPlayers as number) > MAX_PLAYERS
				) {
					return null;
				}
				maxPlayers = o.maxPlayers as number;
			}
			return { t: "room.create", rid, name, maxPlayers };
		}
		case "room.join": {
			const code = normalizeCode(o.code);
			const name = cleanName(o.name);
			return code && name ? { t: "room.join", rid, code, name } : null;
		}
		case "room.resume": {
			const code = normalizeCode(o.code);
			const playerId = str(o.playerId, 40);
			const token = str(o.token, 80);
			return code && playerId && token ? { t: "room.resume", rid, code, playerId, token } : null;
		}
		case "room.check": {
			const code = normalizeCode(o.code);
			return code ? { t: "room.check", rid, code } : null;
		}
		case "room.leave":
		case "player.unready":
		case "game.start":
		case "game.again":
		case "chat.typing":
			return { t: o.t, rid };
		case "player.ready":
			return isValidBoard(o.board) ? { t: "player.ready", rid, board: o.board } : null;
		case "game.strike":
			return isValidCall(o.n) ? { t: "game.strike", rid, n: o.n } : null;
		case "chat.send": {
			const text = str(o.text, MAX_CHAT_LENGTH);
			return text ? { t: "chat.send", rid, text } : null;
		}
		default:
			return null;
	}
};
