import { useState } from "react";
import { play } from "../fx/feedback";
import { toast } from "../state/game";
import { CheckIcon, CopyIcon, ShareIcon } from "./icons";

export function CopyCode({ code }: { code: string }) {
	const [copied, setCopied] = useState(false);
	const link = `${location.origin}/room/${code}`;

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(link);
			setCopied(true);
			play("pop");
			setTimeout(() => setCopied(false), 1600);
		} catch {
			toast(`Copy this link: ${link}`);
		}
	};

	const share = async () => {
		try {
			await navigator.share({ title: "Join my Bingo room", text: `Room ${code}`, url: link });
		} catch {
			/* dismissed */
		}
	};

	return (
		<div className="code">
			<div className="code__label">Room code</div>
			<div className="code__row">
				<span className="code__value" aria-label={`Room code ${code.split("").join(" ")}`}>
					{code.split("").map((c, i) => (
						<span key={i} style={{ "--i": i } as React.CSSProperties}>
							{c}
						</span>
					))}
				</span>
				<button type="button" className={`icon-btn${copied ? " icon-btn--done" : ""}`} onClick={copy} aria-label="Copy invite link">
					<span className="icon-btn__swap" data-state={copied ? "done" : "idle"}>
						<CopyIcon />
						<CheckIcon />
					</span>
				</button>
				{typeof navigator !== "undefined" && "share" in navigator && (
					<button type="button" className="icon-btn" onClick={share} aria-label="Share invite link">
						<ShareIcon />
					</button>
				)}
			</div>
			<div className="code__hint" aria-live="polite">
				{copied ? "Link copied ✓" : "Tap to copy the invite link"}
			</div>
		</div>
	);
}
