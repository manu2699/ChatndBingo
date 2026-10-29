import { useGame } from "../state/game";

export function Toasts() {
	const toasts = useGame((s) => s.toasts);
	return (
		<div className="toasts" role="status" aria-live="polite">
			{toasts.map((t) => (
				<div key={t.id} className={`toast toast--${t.tone}`}>
					{t.text}
				</div>
			))}
		</div>
	);
}
