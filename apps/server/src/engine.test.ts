import { describe, expect, test } from "bun:test";
import { orderedBoard } from "@bingo/shared";
import {
	GameError,
	addPlayer,
	canStart,
	checkToken,
	createRoom,
	nextTurn,
	playAgain,
	removePlayer,
	setConnected,
	setReady,
	snapshot,
	startGame,
	strike,
	type RoomState
} from "./engine";

const reversed = () => orderedBoard().reverse();

const lobby = (names = ["Ann", "Bo"]) => {
	const { room, host } = createRoom("ABCDE", names[0]!);
	const players = [host, ...names.slice(1).map((n) => addPlayer(room, n))];
	return { room, players };
};

const started = () => {
	const { room, players } = lobby();
	setReady(room, players[0]!.id, orderedBoard());
	setReady(room, players[1]!.id, reversed());
	startGame(room, players[0]!.id);
	return { room, ann: players[0]!, bo: players[1]! };
};

const code = (fn: () => unknown) => {
	try {
		fn();
	} catch (e) {
		return e instanceof GameError ? e.code : "other";
	}
	return "none";
};

describe("lobby", () => {
	test("rejects duplicate names and full rooms", () => {
		const { room } = lobby(["Ann", "Bo"]);
		expect(code(() => addPlayer(room, "bo"))).toBe("name_taken");
		room.maxPlayers = 2;
		expect(code(() => addPlayer(room, "Cy"))).toBe("room_full");
	});

	test("cannot start until everyone is ready, and only the host can", () => {
		const { room, players } = lobby();
		expect(canStart(room)).toBe(false);
		setReady(room, players[0]!.id, orderedBoard());
		expect(code(() => startGame(room, players[0]!.id))).toBe("not_ready");
		setReady(room, players[1]!.id, reversed());
		expect(code(() => startGame(room, players[1]!.id))).toBe("not_host");
		startGame(room, players[0]!.id);
		expect(room.phase).toBe("playing");
		expect(room.turn).toBe(players[0]!.id);
	});

	test("rejects invalid boards", () => {
		const { room, players } = lobby();
		expect(code(() => setReady(room, players[0]!.id, [1, 2, 3]))).toBe("bad_board");
	});

	test("tokens are checked", () => {
		const { room, players } = lobby();
		expect(checkToken(room, players[0]!.id, players[0]!.token).id).toBe(players[0]!.id);
		expect(code(() => checkToken(room, players[0]!.id, "x".repeat(players[0]!.token.length)))).toBe("bad_session");
		expect(code(() => checkToken(room, "nobody", "x"))).toBe("bad_session");
	});
});

describe("play", () => {
	test("enforces turn order and rejects repeats", () => {
		const { room, ann, bo } = started();
		expect(code(() => strike(room, bo.id, 1))).toBe("not_your_turn");
		const res = strike(room, ann.id, 1);
		expect(res.next).toBe(bo.id);
		expect(code(() => strike(room, bo.id, 1))).toBe("already_called");
		expect(code(() => strike(room, bo.id, 99))).toBe("bad_message");
	});

	test("first to five lines wins and the game finishes", () => {
		const { room, ann, bo } = started();
		// Ann's board is 1..25 row-major: calling 1-20 gives 4 rows; 21 then gives column 0 + anti-diagonal.
		let turn = ann.id;
		let last;
		for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]) {
			last = strike(room, turn, n);
			if (last.winners.length) break;
			turn = last.next!;
		}
		expect(last!.winners.length).toBeGreaterThan(0);
		expect(room.phase).toBe("finished");
		expect(room.turn).toBeNull();
		expect(room.winners).toEqual(last!.winners);
		expect(code(() => strike(room, bo.id, 22))).toBe("bad_phase");
	});

	test("ties are possible when one call completes several players", () => {
		const { room, players } = lobby();
		setReady(room, players[0]!.id, orderedBoard());
		setReady(room, players[1]!.id, orderedBoard());
		startGame(room, players[0]!.id);
		let turn = players[0]!.id;
		let res;
		for (let n = 1; n <= 25; n++) {
			res = strike(room, turn, n);
			if (res.winners.length) break;
			turn = res.next!;
		}
		expect(res!.winners).toHaveLength(2);
	});

	test("snapshot never leaks boards and reports lines", () => {
		const { room, ann } = started();
		strike(room, ann.id, 1);
		const snap = snapshot(room);
		expect(JSON.stringify(snap)).not.toContain("board");
		expect(JSON.stringify(snap)).not.toContain(ann.token);
		expect(snap.called).toEqual([1]);
	});

	test("play again returns to the lobby with fresh state", () => {
		const { room, ann, bo } = started();
		expect(code(() => playAgain(room, ann.id))).toBe("bad_phase");
		room.phase = "finished";
		playAgain(room, ann.id);
		expect(room.phase as string).toBe("lobby");
		expect(room.called).toEqual([]);
		expect(room.players.every((p) => !p.ready && p.board === null)).toBe(true);
		expect(bo.ready).toBe(false);
	});
});

describe("turn handling", () => {
	test("skips disconnected players", () => {
		const { room, players } = lobby(["Ann", "Bo", "Cy"]);
		setConnected(room, players[1]!.id, false);
		expect(nextTurn(room, players[0]!.id)).toBe(players[2]!.id);
		expect(nextTurn(room, players[2]!.id)).toBe(players[0]!.id);
	});

	test("removing the player on turn passes it on; too few players ends the game", () => {
		const { room, players } = lobby(["Ann", "Bo", "Cy"]);
		players.forEach((p) => setReady(room, p.id, orderedBoard()));
		startGame(room, players[0]!.id);
		removePlayer(room, players[0]!.id);
		expect(room.turn).toBe(players[1]!.id);
		expect(room.hostId).toBe(players[1]!.id);
		removePlayer(room, players[1]!.id);
		expect(room.phase).toBe("finished");
		expect(room.turn).toBeNull();
	});
});

// keep the compiler honest about the exported shape
export type _Room = RoomState;
