import { BINGO_LETTERS } from "@bingo/shared";

export function BingoLetters({ lit }: { lit: number }) {
	return (
		<div className="letters" role="img" aria-label={`${lit} of 5 letters complete`}>
			{BINGO_LETTERS.map((l, i) => (
				<span key={l} className={`letters__l${i < lit ? " letters__l--lit" : ""}`} style={{ "--i": i } as React.CSSProperties}>
					{l}
				</span>
			))}
		</div>
	);
}
