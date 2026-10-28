import {
	DEFAULT_PLAYERS,
	LINES_TO_WIN,
	MAX_PLAYERS,
	MIN_PLAYERS,
	countLines,
	isValidBoard,
	isValidCall,
	type ChatMessage,
	type ErrorCode,
	type Phase,
	type PublicPlayer,
	type RoomSnapshot
} from "@bingo/shared";

/** Pure, serialisable room state. All rules live here; IO lives in the hub. */
export interface PlayerState {
	id: string;
	name: string;
	token: string;
	ready: boolean;
	connected: boolean;
	board: number[] | null;
}

export interface RoomState {
	code: string;
	phase: Phase;
	hostId: string;
	maxPlayers: number;
	/** Join order; also the turn order. */
	players: PlayerState[];
	called: number[];
	turn: string | null;
	winners: string[];
	chat: ChatMessage[];
	createdAt: number;
	updatedAt: number;
}

export class GameError extends Error {
	constructor(
		readonly code: ErrorCode,
		message: string
	) {
		super(message);
	}
}

export const CHAT_HISTORY = 50;

const id = () => crypto.randomUUID();
const secret = () => crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");

export const createRoom = (
	code: string,
	hostName: string,
	maxPlayers = DEFAULT_PLAYERS,
	now = Date.now()
): { room: RoomState; host: PlayerState } => {
	const size = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, maxPlayers));
	const host = newPlayer(hostName);
	const room: RoomState = {
		code,
		phase: "lobby",
		hostId: host.id,
		maxPlayers: size,
		players: [host],
		called: [],
		turn: null,
		winners: [],
		chat: [],
		createdAt: now,
		updatedAt: now
	};
	return { room, host };
};

const newPlayer = (name: string): PlayerState => ({
	id: id(),
	name,
	token: secret(),
	ready: false,
	connected: true,
	board: null
});

export const findPlayer = (room: RoomState, playerId: string) =>
	room.players.find((p) => p.id === playerId);

const mustFind = (room: RoomState, playerId: string) => {
	const p = findPlayer(room, playerId);
	if (!p) throw new GameError("not_in_room", "You are not in this room");
	return p;
};

export const addPlayer = (room: RoomState, name: string): PlayerState => {
	if (room.phase !== "lobby") throw new GameError("bad_phase", "The game has already started");
	if (room.players.length >= room.maxPlayers) throw new GameError("room_full", "Room is full");
	const taken = room.players.some((p) => p.name.toLowerCase() === name.toLowerCase());
	if (taken) throw new GameError("name_taken", "Someone in the room already has that name");
	const player = newPlayer(name);
	room.players.push(player);
	return player;
};

export const checkToken = (room: RoomState, playerId: string, token: string): PlayerState => {
	const p = findPlayer(room, playerId);
	if (!p || p.token.length !== token.length) throw new GameError("bad_session", "Session expired");
	let diff = 0;
	for (let i = 0; i < token.length; i++) diff |= p.token.charCodeAt(i) ^ token.charCodeAt(i);
	if (diff !== 0) throw new GameError("bad_session", "Session expired");
	return p;
};

export const setReady = (room: RoomState, playerId: string, board: unknown) => {
	const p = mustFind(room, playerId);
	if (room.phase !== "lobby") throw new GameError("bad_phase", "The game has already started");
	if (!isValidBoard(board)) throw new GameError("bad_board", "Board must use 1-25 exactly once");
	p.board = board;
	p.ready = true;
};

export const setUnready = (room: RoomState, playerId: string) => {
	const p = mustFind(room, playerId);
	if (room.phase !== "lobby") throw new GameError("bad_phase", "The game has already started");
	p.ready = false;
	p.board = null;
};

export const canStart = (room: RoomState) =>
	room.phase === "lobby" && room.players.length >= MIN_PLAYERS && room.players.every((p) => p.ready);

export const startGame = (room: RoomState, playerId: string) => {
	mustFind(room, playerId);
	if (room.hostId !== playerId) throw new GameError("not_host", "Only the host can start");
	if (room.phase !== "lobby") throw new GameError("bad_phase", "The game has already started");
	if (!canStart(room)) throw new GameError("not_ready", "Everyone must be ready (2 players minimum)");
	room.phase = "playing";
	room.called = [];
	room.winners = [];
	room.turn = room.players[0]!.id;
};

/** Next connected player after `fromId` in join order (or `fromId` itself if alone). */
export const nextTurn = (room: RoomState, fromId: string | null): string | null => {
	const n = room.players.length;
	if (n === 0) return null;
	const start = Math.max(0, room.players.findIndex((p) => p.id === fromId));
	for (let step = 1; step <= n; step++) {
		const p = room.players[(start + step) % n]!;
		if (p.connected) return p.id;
	}
	return room.players[start]!.id;
};

export interface StrikeResult {
	n: number;
	by: string;
	next: string | null;
	winners: string[];
}

export const strike = (room: RoomState, playerId: string, n: unknown): StrikeResult => {
	mustFind(room, playerId);
	if (room.phase !== "playing") throw new GameError("bad_phase", "No game in progress");
	if (room.turn !== playerId) throw new GameError("not_your_turn", "It's not your turn");
	if (!isValidCall(n)) throw new GameError("bad_message", "Pick a number from 1 to 25");
	if (room.called.includes(n)) throw new GameError("already_called", "That number is already struck");

	room.called.push(n);
	const called = new Set(room.called);
	const winners = room.players
		.filter((p) => p.board && countLines(p.board, called) >= LINES_TO_WIN)
		.map((p) => p.id);

	if (winners.length > 0) {
		room.phase = "finished";
		room.winners = winners;
		room.turn = null;
	} else if (room.called.length >= 25) {
		// Unreachable in practice (all 25 called completes every line) but keeps the state machine total.
		room.phase = "finished";
		room.turn = null;
	} else {
		room.turn = nextTurn(room, playerId);
	}
	return { n, by: playerId, next: room.turn, winners };
};

export const playAgain = (room: RoomState, playerId: string) => {
	mustFind(room, playerId);
	if (room.phase !== "finished") throw new GameError("bad_phase", "The game isn't over yet");
	resetToLobby(room);
};

const resetToLobby = (room: RoomState) => {
	room.phase = "lobby";
	room.called = [];
	room.winners = [];
	room.turn = null;
	for (const p of room.players) {
		p.ready = false;
		p.board = null;
	}
};

export const setConnected = (room: RoomState, playerId: string, connected: boolean) => {
	const p = findPlayer(room, playerId);
	if (p) p.connected = connected;
};

/** Remove a player. Reassigns host, advances the turn, ends the game if too few remain. */
export const removePlayer = (room: RoomState, playerId: string) => {
	const idx = room.players.findIndex((p) => p.id === playerId);
	if (idx === -1) return;
	const wasTurn = room.turn === playerId;
	const prevId = room.players[(idx - 1 + room.players.length) % room.players.length]!.id;
	room.players.splice(idx, 1);

	if (room.hostId === playerId && room.players.length > 0) {
		room.hostId = (room.players.find((p) => p.connected) ?? room.players[0]!).id;
	}
	if (room.phase === "playing") {
		if (room.players.length < MIN_PLAYERS) {
			room.phase = "finished";
			room.turn = null;
		} else if (wasTurn) {
			room.turn = nextTurn(room, prevId);
		}
	}
};

export const addChat = (room: RoomState, from: PlayerState | null, text: string, now = Date.now()) => {
	const msg: ChatMessage = {
		id: id(),
		from: from?.id ?? null,
		name: from?.name ?? "BINGO_BOT",
		text,
		at: now
	};
	room.chat.push(msg);
	if (room.chat.length > CHAT_HISTORY) room.chat.splice(0, room.chat.length - CHAT_HISTORY);
	return msg;
};

export const snapshot = (room: RoomState): RoomSnapshot => {
	const called = new Set(room.called);
	const live = room.phase !== "lobby";
	const players: PublicPlayer[] = room.players.map((p) => ({
		id: p.id,
		name: p.name,
		ready: p.ready,
		connected: p.connected,
		lines: live && p.board ? countLines(p.board, called) : 0
	}));
	return {
		code: room.code,
		phase: room.phase,
		hostId: room.hostId,
		maxPlayers: room.maxPlayers,
		players,
		called: [...room.called],
		turn: room.turn,
		winners: [...room.winners]
	};
};
