import type { RoomSnapshot } from "@bingo/shared";
import { CheckIcon, CrownIcon } from "./icons";

const HUES = [350, 212, 160, 40, 280, 190];

export function Avatar({ name, index, active, dim }: { name: string; index: number; active?: boolean; dim?: boolean }) {
	return (
		<span
			className={`avatar${active ? " avatar--active" : ""}${dim ? " avatar--dim" : ""}`}
			style={{ "--hue": HUES[index % HUES.length] } as React.CSSProperties}
			aria-hidden>
			{name.slice(0, 1).toUpperCase()}
		</span>
	);
}

export function Players({ room, you }: { room: RoomSnapshot; you: string | null }) {
	const playing = room.phase !== "lobby";
	return (
		<ul className="players" aria-label="Players">
			{room.players.map((p, i) => {
				const active = room.turn === p.id;
				const won = room.winners.includes(p.id);
				return (
					<li key={p.id} className={`player${active ? " player--turn" : ""}${won ? " player--won" : ""}`} style={{ "--i": i } as React.CSSProperties}>
						<Avatar name={p.name} index={i} active={active} dim={!p.connected} />
						<span className="player__name">
							{p.name}
							{p.id === you && <em> (you)</em>}
							{p.id === room.hostId && <CrownIcon className="player__crown" width={14} height={14} aria-label="host" />}
						</span>
						<span className="player__meta">
							{!p.connected ? (
								<span className="tag tag--off">offline</span>
							) : playing ? (
								<span className="tag">{p.lines} {p.lines === 1 ? "line" : "lines"}</span>
							) : p.ready ? (
								<span className="tag tag--ready"><CheckIcon width={12} height={12} /> ready</span>
							) : (
								<span className="tag tag--wait">choosing…</span>
							)}
						</span>
					</li>
				);
			})}
		</ul>
	);
}
