export const SIZE = 5;
export const CELLS = SIZE * SIZE;
export const LINES_TO_WIN = 5;
export const BINGO_LETTERS = ["B", "I", "N", "G", "O"] as const;

/** A board is 25 numbers (1..25, each exactly once), row-major. */
export type Board = readonly number[];

/** Every line (5 rows, 5 columns, 2 diagonals) as cell indexes. */
export const LINES: readonly (readonly number[])[] = (() => {
	const lines: number[][] = [];
	for (let r = 0; r < SIZE; r++) {
		lines.push(Array.from({ length: SIZE }, (_, c) => r * SIZE + c));
	}
	for (let c = 0; c < SIZE; c++) {
		lines.push(Array.from({ length: SIZE }, (_, r) => r * SIZE + c));
	}
	lines.push(Array.from({ length: SIZE }, (_, i) => i * SIZE + i));
	lines.push(Array.from({ length: SIZE }, (_, i) => i * SIZE + (SIZE - 1 - i)));
	return lines;
})();

export const orderedBoard = (): number[] =>
	Array.from({ length: CELLS }, (_, i) => i + 1);

/** Fisher-Yates shuffle. `random` returns [0, 1). */
export const shuffle = <T>(items: readonly T[], random: () => number = Math.random): T[] => {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j] as T, out[i] as T];
	}
	return out;
};

export const randomBoard = (random?: () => number): number[] =>
	shuffle(orderedBoard(), random);

export const isValidBoard = (board: unknown): board is number[] => {
	if (!Array.isArray(board) || board.length !== CELLS) return false;
	const seen = new Set<number>();
	for (const n of board) {
		if (!Number.isInteger(n) || n < 1 || n > CELLS || seen.has(n)) return false;
		seen.add(n);
	}
	return true;
};

export const isValidCall = (n: unknown): n is number =>
	Number.isInteger(n) && (n as number) >= 1 && (n as number) <= CELLS;

/** Indexes (into LINES) of the lines fully covered by `called`. */
export const completedLines = (board: Board, called: ReadonlySet<number>): number[] => {
	const done: number[] = [];
	LINES.forEach((line, i) => {
		if (line.every((cell) => called.has(board[cell] as number))) done.push(i);
	});
	return done;
};

export const countLines = (board: Board, called: ReadonlySet<number>): number =>
	completedLines(board, called).length;

export const hasBingo = (board: Board, called: ReadonlySet<number>): boolean =>
	countLines(board, called) >= LINES_TO_WIN;

/** How many of the B-I-N-G-O letters are lit for a given line count. */
export const litLetters = (lines: number): number => Math.min(lines, BINGO_LETTERS.length);
