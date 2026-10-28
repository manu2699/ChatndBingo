import { useEffect, useRef } from "react";
import { burst } from "../fx/confetti";
import { haptic, play } from "../fx/feedback";
import { useGame } from "../state/game";

/** Fires once per finished game, if this player is among the winners. */
export function Confetti() {
	const ref = useRef<HTMLCanvasElement>(null);
	const overSeq = useGame((s) => s.overSeq);
	const lastSeq = useRef(overSeq);

	useEffect(() => {
		if (overSeq === lastSeq.current) return;
		lastSeq.current = overSeq;
		const { room, you } = useGame.getState();
		if (!room || !you || !room.winners.includes(you)) return;
		play("win");
		haptic([40, 40, 80, 40, 160]);
		if (ref.current) void burst(ref.current);
	}, [overSeq]);

	return <canvas ref={ref} className="confetti" aria-hidden />;
}
