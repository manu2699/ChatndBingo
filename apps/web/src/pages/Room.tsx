import { MAX_NAME_LENGTH, cleanName, litLetters, normalizeCode, orderedBoard } from "@bingo/shared";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import joinImg from "../assets/joinRoom.png";
import waitImg from "../assets/roomMembers.png";
import { BingoLetters } from "../components/BingoLetters";
import { Board } from "../components/Board";
import { Chat } from "../components/Chat";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { CopyCode } from "../components/CopyCode";
import { CheckIcon, LeaveIcon, ShuffleIcon } from "../components/icons";
import { Players } from "../components/Players";
import { haptic, play } from "../fx/feedback";
import { actions, errorText, toast, useGame } from "../state/game";

export function RoomPage() {
	const { code: raw } = useParams();
	const code = normalizeCode(raw);
	const room = useGame((s) => s.room);
	const resumed = useGame((s) => s.resumed);

	if (!code) return <Notice title="That room code doesn't look right" />;
	if (room && room.code === code) return <InRoom />;
	if (!resumed) return <Notice title="Finding your seat…" busy />;
	return <JoinGate code={code} />;
}

function Notice({ title, busy }: { title: string; busy?: boolean }) {
	const navigate = useNavigate();
	return (
		<main className="notice">
			<img src={waitImg} alt="" className="card__img" />
			<h2>{title}</h2>
			{busy ? <span className="spinner spinner--lg" aria-hidden /> : <button className="btn" onClick={() => navigate("/")}>Back home</button>}
		</main>
	);
}

function JoinGate({ code }: { code: string }) {
	const navigate = useNavigate();
	const saved = useGame((s) => s.name);
	const [name, setName] = useState(saved);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [availability, setAvailability] = useState<"checking" | "ok" | "gone" | "full">("checking");

	useEffect(() => {
		let cancelled = false;
		actions
			.checkRoom(code)
			.then((s) => !cancelled && setAvailability(s?.available ? "ok" : s?.reason === "no_room" ? "gone" : "full"))
			.catch(() => !cancelled && setAvailability("ok"));
		return () => {
			cancelled = true;
		};
	}, [code]);

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		const clean = cleanName(name);
		if (!clean || busy) return;
		setBusy(true);
		setError("");
		try {
			await actions.joinRoom(code, clean);
			play("pop");
		} catch (err) {
			setError(errorText(err));
		} finally {
			setBusy(false);
		}
	};

	return (
		<main className="notice">
			<form className="card" onSubmit={submit}>
				<h2>Room {code}</h2>
				<img src={joinImg} alt="" className="card__img" />
				{availability === "gone" && <p className="form-error">This room doesn't exist (anymore).</p>}
				{availability === "full" && <p className="form-error">This room is full or already playing.</p>}
				<label className="field">
					<input className="field__input" value={name} maxLength={MAX_NAME_LENGTH} autoComplete="off" placeholder=" " autoFocus onChange={(e) => setName(e.target.value)} />
					<span className="field__label">Your name</span>
				</label>
				<button type="submit" className="btn" disabled={!cleanName(name) || busy || availability === "gone" || availability === "full"}>
					{busy ? <span className="spinner" aria-hidden /> : "Join room"}
				</button>
				<p className="form-error" role="alert">{error}</p>
				<button type="button" className="btn btn--ghost" onClick={() => navigate("/")}>
					Not this room?
				</button>
			</form>
		</main>
	);
}

function InRoom() {
	const navigate = useNavigate();
	const room = useGame((s) => s.room)!;
	const you = useGame((s) => s.you);
	const board = useGame((s) => s.board);
	const draft = useGame((s) => s.draft);
	const strikeEvent = useGame((s) => s.lastStrike);
	const [confirmLeave, setConfirmLeave] = useState(false);
	const [busy, setBusy] = useState(false);

	const me = room.players.find((p) => p.id === you);
	const myTurn = room.phase === "playing" && room.turn === you;
	const turnPlayer = room.players.find((p) => p.id === room.turn);
	const isHost = room.hostId === you;
	const everyoneReady = room.players.length >= 2 && room.players.every((p) => p.ready);

	// Cue the player when it becomes their turn.
	useEffect(() => {
		if (!myTurn) return;
		play("turn");
		haptic([30, 40, 30]);
		const previous = document.title;
		document.title = "● Your turn — Chat & Bingo";
		return () => {
			document.title = previous;
		};
	}, [myTurn]);

	useEffect(() => {
		if (strikeEvent) play("strike");
	}, [strikeEvent]);

	const run = async (fn: () => Promise<unknown>) => {
		if (busy) return;
		setBusy(true);
		try {
			await fn();
		} catch (err) {
			toast(errorText(err), "error");
			haptic(60);
		} finally {
			setBusy(false);
		}
	};

	const leave = async () => {
		await actions.leave();
		navigate("/");
	};

	const winnerNames = room.players.filter((p) => room.winners.includes(p.id)).map((p) => p.name);
	const iWon = !!you && room.winners.includes(you);

	return (
		<main className={`stage stage--${room.phase}`}>
			<section className="stage__main">
				<div className="topline">
					{room.phase === "lobby" ? <CopyCode code={room.code} /> : <span className="topline__code">Room {room.code}</span>}
					<button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmLeave(true)}>
						<LeaveIcon /> Leave
					</button>
				</div>

				{room.phase === "lobby" ? (
					<Lobby
						locked={!!board}
						cells={board ?? draft}
						isHost={isHost}
						canStart={everyoneReady}
						meReady={!!me?.ready}
						busy={busy}
						onReady={() => run(() => (me?.ready ? actions.unready() : actions.ready()))}
						onStart={() => run(actions.start)}
					/>
				) : (
					<div className="game">
						<div className={`turn${myTurn ? " turn--mine" : ""}${room.phase === "finished" ? " turn--over" : ""}`} key={`${room.turn}-${room.phase}`} aria-live="assertive">
							{room.phase === "finished"
								? winnerNames.length
									? iWon
										? winnerNames.length > 1 ? `🎉 BINGO! You tied with ${winnerNames.filter((n) => n !== me?.name).join(" & ")}` : "🎉 BINGO! You win!"
										: `${winnerNames.join(" & ")} made BINGO!`
									: "Game over"
								: myTurn
									? "Your turn — pick a number"
									: `${turnPlayer?.name ?? "…"}'s turn${turnPlayer && !turnPlayer.connected ? " (offline, skipping soon)" : ""}`}
						</div>
						<BingoLetters lit={litLetters(me?.lines ?? 0)} />
						<Board
							cells={board ?? orderedBoard()}
							called={room.called}
							mode={room.phase === "playing" ? "play" : "view"}
							canStrike={myTurn}
							onStrike={(n) => void run(() => actions.strike(n))}
						/>
						{room.phase === "finished" && (
							<button type="button" className="btn btn--pop" disabled={busy} onClick={() => run(actions.again)}>
								Play again
							</button>
						)}
					</div>
				)}
			</section>

			<aside className="stage__side">
				<Players room={room} you={you} />
				<Chat />
			</aside>

			<ConfirmDialog open={confirmLeave} title="Leave this room?" confirmLabel="Leave" onCancel={() => setConfirmLeave(false)} onConfirm={() => void leave()} />
		</main>
	);
}

interface LobbyProps {
	locked: boolean;
	cells: readonly number[];
	isHost: boolean;
	canStart: boolean;
	meReady: boolean;
	busy: boolean;
	onReady: () => void;
	onStart: () => void;
}

function Lobby({ locked, cells, isHost, canStart, meReady, busy, onReady, onStart }: LobbyProps) {
	const [spin, setSpin] = useState(0);
	return (
		<div className="lobby">
			<p className="lobby__hint">
				{locked ? "Your board is locked in. Waiting for everyone…" : "Arrange your board — drag tiles, or tap two to swap."}
			</p>
			<Board cells={cells} called={[]} mode={locked ? "view" : "edit"} onSwap={actions.swap} />
			<div className="actions">
				<button
					type="button"
					className="btn btn--ghost"
					disabled={locked}
					onClick={() => {
						actions.randomize();
						setSpin((s) => s + 1);
						play("tap");
						haptic(15);
					}}>
					<ShuffleIcon key={spin} className={spin ? "spin" : ""} /> Shuffle
				</button>
				<button type="button" className={`btn btn--ready${meReady ? " btn--ready-on" : ""}`} disabled={busy} onClick={onReady}>
					<span className="btn__morph">
						<CheckIcon />
						<span>{meReady ? "Ready!" : "I'm ready"}</span>
					</span>
				</button>
			</div>
			{isHost && (
				<button type="button" className={`btn btn--pop${canStart ? " btn--pulse" : ""}`} disabled={!canStart || busy} onClick={onStart}>
					{canStart ? "Start the game" : "Waiting for everyone to be ready…"}
				</button>
			)}
			{!isHost && meReady && <p className="lobby__hint">The host will start the game.</p>}
		</div>
	);
}
