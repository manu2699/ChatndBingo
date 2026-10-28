import { LINES, SIZE, completedLines } from "@bingo/shared";
import {
	useCallback,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type KeyboardEvent,
	type PointerEvent
} from "react";
import { haptic, play } from "../fx/feedback";
import { prefersReducedMotion } from "../fx/prefs";

export type BoardMode = "edit" | "play" | "view";

interface Props {
	cells: readonly number[];
	/** Numbers struck so far, in order. */
	called: readonly number[];
	mode: BoardMode;
	/** In play mode: is it this player's turn? */
	canStrike?: boolean;
	onStrike?: (n: number) => void;
	onSwap?: (a: number, b: number) => void;
}

const DRAG_THRESHOLD = 6;

export function Board({ cells, called, mode, canStrike = false, onStrike, onSwap }: Props) {
	const refs = useRef<(HTMLButtonElement | null)[]>([]);
	const rects = useRef(new Map<number, DOMRect>());
	const [selected, setSelected] = useState<number | null>(null);
	const [dragging, setDragging] = useState<number | null>(null);
	const [dropTarget, setDropTarget] = useState<number | null>(null);
	const drag = useRef<{ index: number; x: number; y: number; pointerId: number } | null>(null);
	const swallowClick = useRef(false);

	const calledSet = useMemo(() => new Set(called), [called]);
	const last = called.length ? called[called.length - 1] : null;
	const inLine = useMemo(() => {
		const out = new Set<number>();
		for (const li of completedLines(cells, calledSet)) for (const c of LINES[li]!) out.add(c);
		return out;
	}, [cells, calledSet]);

	// FLIP: when cells change order (randomize / swap) glide each tile from where it was.
	useLayoutEffect(() => {
		const previous = rects.current;
		const next = new Map<number, DOMRect>();
		cells.forEach((n, i) => {
			const el = refs.current[i];
			if (!el) return;
			const rect = el.getBoundingClientRect();
			next.set(n, rect);
			const before = previous.get(n);
			if (!before || mode !== "edit" || prefersReducedMotion() || !el.animate) return;
			const dx = before.left - rect.left;
			const dy = before.top - rect.top;
			if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
			el.animate(
				[{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
				{ duration: 380, easing: "cubic-bezier(.2,.9,.3,1.2)" }
			);
		});
		rects.current = next;
	}, [cells, mode]);

	const targetAt = (x: number, y: number, from: number) => {
		for (const el of document.elementsFromPoint(x, y)) {
			const idx = (el as HTMLElement).dataset?.cell;
			if (idx !== undefined && Number(idx) !== from) return Number(idx);
		}
		return null;
	};

	const onPointerDown = (e: PointerEvent<HTMLButtonElement>, index: number) => {
		if (mode !== "edit" || e.button > 0) return;
		drag.current = { index, x: e.clientX, y: e.clientY, pointerId: e.pointerId };
		e.currentTarget.setPointerCapture(e.pointerId);
	};

	const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
		const d = drag.current;
		if (!d || d.pointerId !== e.pointerId) return;
		const dx = e.clientX - d.x;
		const dy = e.clientY - d.y;
		if (dragging === null) {
			if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
			setDragging(d.index);
			setSelected(null);
			haptic(8);
		}
		e.currentTarget.style.transform = `translate(${dx}px, ${dy}px) scale(1.1) rotate(${Math.max(-8, Math.min(8, dx / 12))}deg)`;
		const t = targetAt(e.clientX, e.clientY, d.index);
		setDropTarget((prev) => (prev === t ? prev : t));
	};

	const endDrag = (e: PointerEvent<HTMLButtonElement>, cancelled: boolean) => {
		const d = drag.current;
		if (!d || d.pointerId !== e.pointerId) return;
		drag.current = null;
		e.currentTarget.style.transform = "";
		if (dragging !== null) {
			// The browser may or may not fire a click after a drag; only swallow one that's already queued.
			swallowClick.current = true;
			setTimeout(() => (swallowClick.current = false), 0);
			const target = cancelled ? null : targetAt(e.clientX, e.clientY, d.index);
			if (target !== null) {
				onSwap?.(d.index, target);
				play("tap");
				haptic(12);
			}
		}
		setDragging(null);
		setDropTarget(null);
	};

	const onClick = (index: number) => {
		if (swallowClick.current) {
			swallowClick.current = false;
			return;
		}
		if (mode === "play") {
			const n = cells[index]!;
			if (canStrike && !calledSet.has(n)) {
				play("tap");
				haptic(10);
				onStrike?.(n);
			}
			return;
		}
		if (mode !== "edit") return;
		// Tap one tile, then another, to swap them (also the keyboard path).
		if (selected === null) setSelected(index);
		else if (selected === index) setSelected(null);
		else {
			onSwap?.(selected, index);
			setSelected(null);
			play("tap");
		}
	};

	const onKeyDown = useCallback((e: KeyboardEvent<HTMLButtonElement>, index: number) => {
		const row = Math.floor(index / SIZE);
		const col = index % SIZE;
		const move: Record<string, [number, number]> = {
			ArrowUp: [-1, 0],
			ArrowDown: [1, 0],
			ArrowLeft: [0, -1],
			ArrowRight: [0, 1]
		};
		const delta = move[e.key];
		if (!delta) return;
		e.preventDefault();
		const r = Math.min(SIZE - 1, Math.max(0, row + delta[0]));
		const c = Math.min(SIZE - 1, Math.max(0, col + delta[1]));
		refs.current[r * SIZE + c]?.focus();
	}, []);

	return (
		<div className={`board board--${mode}`} role="group" aria-label="Bingo board">
			{cells.map((n, i) => {
				const struck = calledSet.has(n);
				const cls = [
					"cell",
					struck && "cell--struck",
					struck && n === last && "cell--fresh",
					inLine.has(i) && "cell--line",
					selected === i && "cell--selected",
					dragging === i && "cell--dragging",
					dropTarget === i && "cell--target",
					mode === "play" && canStrike && !struck && "cell--pickable"
				]
					.filter(Boolean)
					.join(" ");
				return (
					<button
						key={n}
						ref={(el) => {
							refs.current[i] = el;
						}}
						type="button"
						data-cell={i}
						className={cls}
						style={{ "--i": i } as CSSProperties}
						aria-label={`${n}${struck ? ", struck" : ""}`}
						aria-pressed={mode === "edit" ? selected === i : struck}
						disabled={mode === "view" || (mode === "play" && struck)}
						onClick={() => onClick(i)}
						onKeyDown={(e) => onKeyDown(e, i)}
						onPointerDown={(e) => onPointerDown(e, i)}
						onPointerMove={onPointerMove}
						onPointerUp={(e) => endDrag(e, false)}
						onPointerCancel={(e) => endDrag(e, true)}>
						<span className="cell__num">{n}</span>
					</button>
				);
			})}
		</div>
	);
}
