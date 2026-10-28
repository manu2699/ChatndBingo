import { describe, expect, test } from "bun:test";
import {
	LINES,
	completedLines,
	countLines,
	hasBingo,
	isValidBoard,
	litLetters,
	orderedBoard,
	randomBoard,
	shuffle
} from "./board";

describe("board", () => {
	test("has 12 lines of 5 distinct cells", () => {
		expect(LINES).toHaveLength(12);
		for (const line of LINES) expect(new Set(line).size).toBe(5);
	});

	test("randomBoard is a permutation of 1..25", () => {
		const b = randomBoard();
		expect(isValidBoard(b)).toBe(true);
		expect([...b].sort((a, c) => a - c)).toEqual(orderedBoard());
	});

	test("shuffle is deterministic for a fixed rng", () => {
		const rng = () => 0;
		expect(shuffle([1, 2, 3, 4], rng)).toEqual(shuffle([1, 2, 3, 4], rng));
	});

	test("isValidBoard rejects bad boards", () => {
		expect(isValidBoard(null)).toBe(false);
		expect(isValidBoard([1, 2, 3])).toBe(false);
		expect(isValidBoard(Array(25).fill(1))).toBe(false);
		expect(isValidBoard([...orderedBoard().slice(0, 24), 26])).toBe(false);
		expect(isValidBoard([...orderedBoard().slice(0, 24), 1.5])).toBe(false);
	});

	test("counts rows, columns and diagonals", () => {
		const board = orderedBoard();
		expect(countLines(board, new Set([1, 2, 3, 4, 5]))).toBe(1);
		expect(countLines(board, new Set([1, 6, 11, 16, 21]))).toBe(1);
		expect(countLines(board, new Set([1, 7, 13, 19, 25]))).toBe(1);
		expect(countLines(board, new Set([5, 9, 13, 17, 21]))).toBe(1);
		expect(completedLines(board, new Set())).toEqual([]);
	});

	test("one call can complete several lines at once", () => {
		const board = orderedBoard();
		// everything in row 0 and column 0 except the shared corner
		const called = new Set([2, 3, 4, 5, 6, 11, 16, 21]);
		expect(countLines(board, called)).toBe(0);
		called.add(1);
		expect(countLines(board, called)).toBe(2);
	});

	test("bingo needs five lines", () => {
		const board = orderedBoard();
		const called = new Set(Array.from({ length: 20 }, (_, i) => i + 1)); // rows 0-3
		expect(countLines(board, called)).toBe(4);
		expect(hasBingo(board, called)).toBe(false);
		called.add(21); // completes column 0 and the anti-diagonal at once
		expect(countLines(board, called)).toBe(6);
		expect(hasBingo(board, called)).toBe(true);
	});

	test("litLetters caps at 5", () => {
		expect(litLetters(0)).toBe(0);
		expect(litLetters(3)).toBe(3);
		expect(litLetters(12)).toBe(5);
	});
});
