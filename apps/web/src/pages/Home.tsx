import { DEFAULT_PLAYERS, MAX_NAME_LENGTH, MAX_PLAYERS, MIN_PLAYERS, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, cleanName, normalizeCode } from "@bingo/shared";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import createImg from "../assets/createRoom.png";
import joinImg from "../assets/joinRoom.png";
import { MinusIcon, PlusIcon } from "../components/icons";
import { play } from "../fx/feedback";
import { actions, errorText, useGame } from "../state/game";

const Spinner = () => <span className="spinner" aria-hidden />;

export function Home() {
	const navigate = useNavigate();
	const savedName = useGame((s) => s.name);
	const room = useGame((s) => s.room);
	const [name, setName] = useState(savedName);
	const [size, setSize] = useState(DEFAULT_PLAYERS);
	const [code, setCode] = useState("");
	const [creating, setCreating] = useState(false);
	const [checking, setChecking] = useState(false);
	const [createError, setCreateError] = useState("");
	const [joinError, setJoinError] = useState("");
	const [shake, setShake] = useState(0);

	const create = async (e: FormEvent) => {
		e.preventDefault();
		const clean = cleanName(name);
		if (!clean || creating) return;
		setCreating(true);
		setCreateError("");
		try {
			const newCode = await actions.createRoom(clean, size);
			play("pop");
			if (newCode) navigate(`/room/${newCode}`);
		} catch (err) {
			setCreateError(errorText(err));
		} finally {
			setCreating(false);
		}
	};

	const join = async (e: FormEvent) => {
		e.preventDefault();
		const normalized = normalizeCode(code);
		if (!normalized || checking) return;
		setChecking(true);
		setJoinError("");
		try {
			const status = await actions.checkRoom(normalized);
			if (status?.available) navigate(`/room/${normalized}`);
			else {
				setJoinError(status?.reason === "room_full" ? `Room ${normalized} is full or already playing` : `No room called ${normalized}`);
				setShake((s) => s + 1);
			}
		} catch (err) {
			setJoinError(errorText(err));
		} finally {
			setChecking(false);
		}
	};

	return (
		<main className="home">
			{room && (
				<button type="button" className="rejoin" onClick={() => navigate(`/room/${room.code}`)}>
					<span className="rejoin__dot" /> You're still in room <strong>{room.code}</strong> — rejoin
				</button>
			)}
			<div className="home__cards">
				<form className="card card--tilt" onSubmit={create} style={{ "--i": 0 } as React.CSSProperties}>
					<h2>Create new</h2>
					<img src={createImg} alt="" className="card__img" />
					<label className="field">
						<input
							className="field__input"
							value={name}
							maxLength={MAX_NAME_LENGTH}
							autoComplete="off"
							placeholder=" "
							onChange={(e) => setName(e.target.value)}
						/>
						<span className="field__label">Your name</span>
					</label>
					<div className="stepper" role="group" aria-label="Players in the room">
						<button type="button" className="icon-btn" aria-label="Fewer players" disabled={size <= MIN_PLAYERS} onClick={() => setSize((s) => s - 1)}>
							<MinusIcon />
						</button>
						<span className="stepper__value" key={size}>
							{size} players
						</span>
						<button type="button" className="icon-btn" aria-label="More players" disabled={size >= MAX_PLAYERS} onClick={() => setSize((s) => s + 1)}>
							<PlusIcon />
						</button>
					</div>
					<button type="submit" className="btn" disabled={!cleanName(name) || creating}>
						{creating ? <Spinner /> : "Create room"}
					</button>
					<p className="form-error" role="alert">
						{createError}
					</p>
				</form>

				<form className="card card--tilt" onSubmit={join} style={{ "--i": 1 } as React.CSSProperties}>
					<h2>Join one</h2>
					<img src={joinImg} alt="" className="card__img" />
					<label className={`field${shake ? " field--shake" : ""}`} key={shake}>
						<input
							className="field__input field__input--code"
							value={code}
							maxLength={ROOM_CODE_LENGTH}
							autoComplete="off"
							autoCapitalize="characters"
							spellCheck={false}
							placeholder=" "
							onChange={(e) =>
								setCode(
									e.target.value
										.toUpperCase()
										.split("")
										.filter((c) => ROOM_CODE_ALPHABET.includes(c))
										.join("")
								)
							}
						/>
						<span className="field__label">Room code</span>
					</label>
					<button type="submit" className="btn" disabled={code.length !== ROOM_CODE_LENGTH || checking}>
						{checking ? <Spinner /> : "Find room"}
					</button>
					<p className="form-error" role="alert">
						{joinError}
					</p>
				</form>
			</div>
		</main>
	);
}
