import { describe, expect, test } from "bun:test";
import { orderedBoard } from "./board";
import { cleanName, normalizeCode, parseClientMessage } from "./protocol";

const p = (o: unknown) => parseClientMessage(JSON.stringify(o));

describe("protocol", () => {
	test("rejects junk", () => {
		expect(parseClientMessage("nope")).toBeNull();
		expect(parseClientMessage("null")).toBeNull();
		expect(parseClientMessage("x".repeat(5000))).toBeNull();
		expect(p({ t: "unknown" })).toBeNull();
		expect(p({})).toBeNull();
	});

	test("room.create trims the name and bounds maxPlayers", () => {
		expect(p({ t: "room.create", name: "  Ann  " })).toEqual({
			t: "room.create",
			rid: undefined,
			name: "Ann",
			maxPlayers: undefined
		});
		expect(p({ t: "room.create", name: "" })).toBeNull();
		expect(p({ t: "room.create", name: "x".repeat(17) })).toBeNull();
		expect(p({ t: "room.create", name: "a", maxPlayers: 1 })).toBeNull();
		expect(p({ t: "room.create", name: "a", maxPlayers: 7 })).toBeNull();
		expect(p({ t: "room.create", name: "a", maxPlayers: 6 })).not.toBeNull();
	});

	test("room codes are case-insensitive and alphabet-checked", () => {
		expect(normalizeCode("abcde")).toBe("ABCDE");
		expect(normalizeCode("ABCD")).toBeNull();
		expect(normalizeCode("ABCD0")).toBeNull(); // 0 is not in the alphabet
		expect(p({ t: "room.join", code: "k7m2q", name: "Bo" })).toMatchObject({ code: "K7M2Q" });
	});

	test("player.ready validates the board", () => {
		expect(p({ t: "player.ready", board: orderedBoard() })).not.toBeNull();
		expect(p({ t: "player.ready", board: [1, 2] })).toBeNull();
	});

	test("game.strike validates the number", () => {
		expect(p({ t: "game.strike", n: 12 })).toMatchObject({ n: 12 });
		expect(p({ t: "game.strike", n: 0 })).toBeNull();
		expect(p({ t: "game.strike", n: "12" })).toBeNull();
	});

	test("chat.send bounds the text and keeps the rid", () => {
		expect(p({ t: "chat.send", text: "hi", rid: "r1" })).toMatchObject({ text: "hi", rid: "r1" });
		expect(p({ t: "chat.send", text: "   " })).toBeNull();
		expect(p({ t: "chat.send", text: "x".repeat(301) })).toBeNull();
	});

	test("cleanName collapses whitespace", () => {
		expect(cleanName("a   b")).toBe("a b");
		expect(cleanName(5)).toBeNull();
	});
});
