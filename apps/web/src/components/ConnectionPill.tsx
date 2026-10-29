import { useGame } from "../state/game";

const COPY = {
	connecting: "Connecting…",
	waking: "Waking the server… the free host naps when idle, this can take up to a minute",
	reconnecting: "Reconnecting…",
	open: "Connected"
} as const;

export function ConnectionPill() {
	const status = useGame((s) => s.status);
	const everOpen = useGame((s) => s.resumed);
	// Stay out of the way once connected; the pill only exists to explain delays.
	if (status === "open") return null;
	return (
		<div className={`pill pill--${status}`} role="status" aria-live="polite" data-ever-open={everOpen}>
			<span className="pill__dot" />
			<span>{COPY[status]}</span>
		</div>
	);
}
