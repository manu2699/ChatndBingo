import { useEffect, useRef, useState } from "react";
import { MAX_CHAT_LENGTH } from "@bingo/shared";
import { play } from "../fx/feedback";
import { actions, errorText, toast, useGame } from "../state/game";
import { SendIcon } from "./icons";

const TYPING_WINDOW_MS = 2500;

export function Chat() {
	const chat = useGame((s) => s.chat);
	const room = useGame((s) => s.room);
	const you = useGame((s) => s.you);
	const typing = useGame((s) => s.typing);
	const [text, setText] = useState("");
	const [sending, setSending] = useState(false);
	const [now, setNow] = useState(() => Date.now());
	const list = useRef<HTMLDivElement>(null);
	const lastTyping = useRef(0);
	const stick = useRef(true);
	const seen = useRef(chat.length);

	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, []);

	// Keep pinned to the newest message unless the reader scrolled up.
	useEffect(() => {
		const el = list.current;
		if (el && stick.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
		const latest = chat[chat.length - 1];
		if (chat.length > seen.current && latest && latest.from !== you && latest.from !== null) play("pop");
		seen.current = chat.length;
	}, [chat, you]);

	const typers = room?.players.filter((p) => p.id !== you && now - (typing[p.id] ?? 0) < TYPING_WINDOW_MS) ?? [];

	const submit = async () => {
		const value = text.trim();
		if (!value || sending) return;
		setSending(true);
		try {
			await actions.sendChat(value);
			setText("");
			play("send");
			stick.current = true;
		} catch (err) {
			toast(errorText(err), "error");
		} finally {
			setSending(false);
		}
	};

	return (
		<section className="chat" aria-label="Chat">
			<h2 className="chat__title">Chat</h2>
			<div
				className="chat__list"
				ref={list}
				role="log"
				aria-live="polite"
				onScroll={(e) => {
					const el = e.currentTarget;
					stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
				}}>
				{chat.map((m) =>
					m.from === null ? (
						<div key={m.id} className="msg msg--system">
							{m.text}
						</div>
					) : (
						<div key={m.id} className={`msg ${m.from === you ? "msg--mine" : "msg--theirs"}`}>
							<div className="msg__who">{m.from === you ? "You" : m.name}</div>
							<div className="msg__text">{m.text}</div>
						</div>
					)
				)}
				<div className={`typing${typers.length ? " typing--on" : ""}`} aria-hidden={!typers.length}>
					<span className="typing__dots">
						<i />
						<i />
						<i />
					</span>
					{typers.map((p) => p.name).join(", ")} {typers.length > 1 ? "are" : "is"} typing
				</div>
			</div>
			<form
				className="chat__form"
				onSubmit={(e) => {
					e.preventDefault();
					void submit();
				}}>
				<input
					className="chat__input"
					value={text}
					maxLength={MAX_CHAT_LENGTH}
					placeholder="Say something…"
					autoComplete="off"
					aria-label="Message"
					onChange={(e) => {
						setText(e.target.value);
						const t = Date.now();
						if (t - lastTyping.current > 1500) {
							lastTyping.current = t;
							actions.typing();
						}
					}}
				/>
				<button type="submit" className={`send${text.trim() ? " send--ready" : ""}${sending ? " send--busy" : ""}`} aria-label="Send message" disabled={!text.trim() || sending}>
					<SendIcon />
				</button>
			</form>
		</section>
	);
}
