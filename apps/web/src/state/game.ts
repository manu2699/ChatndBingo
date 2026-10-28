import {
	orderedBoard,
	randomBoard,
	type ChatMessage,
	type RoomSnapshot,
	type ServerMessage
} from "@bingo/shared";
import { create } from "zustand";
import { ApiError, GameSocket, type Status } from "../net/socket";
import { clearSession, loadName, loadSession, saveName, saveSession } from "./session";

export interface Toast {
	id: number;
	text: string;
	tone: "info" | "error" | "good";
}

export interface StrikeEvent {
	seq: number;
	n: number;
	by: string;
}

interface GameState {
	status: Status;
	/** Resolved once we know whether a saved session is still valid. */
	resumed: boolean;
	code: string | null;
	you: string | null;
	name: string;
	room: RoomSnapshot | null;
	chat: ChatMessage[];
	/** Server-locked board (set while ready / in game). */
	board: number[] | null;
	/** Local arrangement while editing. */
	draft: number[];
	lastStrike: StrikeEvent | null;
	/** Bumps each time a game finishes, to trigger celebrations once. */
	overSeq: number;
	typing: Record<string, number>;
	toasts: Toast[];
}

const initial = (): GameState => ({
	status: "connecting",
	resumed: false,
	code: null,
	you: null,
	name: loadName(),
	room: null,
	chat: [],
	board: null,
	draft: orderedBoard(),
	lastStrike: null,
	overSeq: 0,
	typing: {},
	toasts: []
});

export const useGame = create<GameState>(() => initial());

const set = useGame.setState;
const get = useGame.getState;

let socket: GameSocket | null = null;
let toastSeq = 0;
let strikeSeq = 0;

export const toast = (text: string, tone: Toast["tone"] = "info") => {
	const id = ++toastSeq;
	set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }));
	setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
};

const resetRoom = () =>
	set({
		code: null,
		you: null,
		room: null,
		chat: [],
		board: null,
		draft: orderedBoard(),
		lastStrike: null,
		typing: {}
	});

const handle = (m: ServerMessage) => {
	switch (m.t) {
		case "session":
			set({ code: m.code, you: m.playerId });
			saveSession({ code: m.code, playerId: m.playerId, token: m.token, name: get().name });
			break;
		case "room.state": {
			const prev = get().room;
			set({ room: m.room });
			if (prev) announcePresence(prev, m.room);
			break;
		}
		case "board.locked":
			set({ board: m.board, draft: m.board });
			break;
		case "board.unlocked":
			set({ board: null });
			break;
		case "game.strike":
			set({ lastStrike: { seq: ++strikeSeq, n: m.n, by: m.by } });
			break;
		case "game.over":
			set((s) => ({ overSeq: s.overSeq + 1 }));
			break;
		case "chat.history":
			set({ chat: m.messages });
			break;
		case "chat.msg":
			set((s) => ({ chat: [...s.chat, m.msg].slice(-100) }));
			break;
		case "chat.typing":
			set((s) => ({ typing: { ...s.typing, [m.from]: Date.now() } }));
			break;
		case "error":
			// Errors tied to a request are handled by the caller; stray ones surface as toasts.
			if (!m.rid) toast(m.message, "error");
			break;
	}
};

const announcePresence = (prev: RoomSnapshot, next: RoomSnapshot) => {
	for (const p of next.players) {
		const before = prev.players.find((q) => q.id === p.id);
		if (before && before.connected && !p.connected) toast(`${p.name} lost connection`);
		if (before && !before.connected && p.connected) toast(`${p.name} is back`, "good");
	}
};

/** After (re)connecting, take our seat back if we had one. */
const resumeSaved = async () => {
	const saved = loadSession();
	if (!saved) return set({ resumed: true });
	try {
		await socket!.request({ t: "room.resume", code: saved.code, playerId: saved.playerId, token: saved.token });
		set({ name: saved.name || get().name });
	} catch (err) {
		if (err instanceof ApiError && (err.code === "no_room" || err.code === "bad_session")) {
			clearSession();
			resetRoom();
		}
	} finally {
		set({ resumed: true });
	}
};

export const connect = () => {
	if (socket) return;
	socket = new GameSocket();
	socket.onStatus((status) => {
		set({ status });
		if (status === "open") void resumeSaved();
	});
	socket.onMessage(handle);
	socket.connect();
};

const need = () => {
	if (!socket) throw new Error("socket not started");
	return socket;
};

export const actions = {
	setName(name: string) {
		set({ name });
		saveName(name);
	},

	async createRoom(name: string, maxPlayers?: number) {
		actions.setName(name);
		const res = await need().request({ t: "room.create", name, maxPlayers });
		return res.t === "session" ? res.code : null;
	},

	async joinRoom(code: string, name: string) {
		actions.setName(name);
		await need().request({ t: "room.join", code, name });
	},

	async checkRoom(code: string) {
		const res = await need().request({ t: "room.check", code });
		return res.t === "room.status" ? res : null;
	},

	async leave() {
		try {
			await need().request({ t: "room.leave" });
		} catch {
			/* leaving is best-effort; local state is cleared below regardless */
		}
		clearSession();
		resetRoom();
	},

	randomize() {
		set({ draft: randomBoard() });
	},

	reset() {
		set({ draft: orderedBoard() });
	},

	swap(a: number, b: number) {
		const draft = [...get().draft];
		[draft[a], draft[b]] = [draft[b]!, draft[a]!];
		set({ draft });
	},

	ready: () => need().request({ t: "player.ready", board: get().draft }),
	unready: () => need().request({ t: "player.unready" }),
	start: () => need().request({ t: "game.start" }),
	strike: (n: number) => need().request({ t: "game.strike", n }),
	again: () => need().request({ t: "game.again" }),
	sendChat: (text: string) => need().request({ t: "chat.send", text }),
	typing: () => need().send({ t: "chat.typing" })
};

export const errorText = (err: unknown) => (err instanceof ApiError ? err.message : "Something went wrong");

// Test hook: lets tests swap in a fake socket.
export const __setSocketForTests = (s: GameSocket | null) => {
	socket = s;
};
