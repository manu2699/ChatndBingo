import { isSoundOn, prefersReducedMotion } from "./prefs";

type Cue = "tap" | "strike" | "turn" | "win" | "pop" | "send";

let ctx: AudioContext | null = null;

const tone = (freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.06) => {
	if (!ctx) return;
	const osc = ctx.createOscillator();
	const amp = ctx.createGain();
	osc.type = type;
	osc.frequency.value = freq;
	amp.gain.setValueAtTime(0.0001, ctx.currentTime + start);
	amp.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
	amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
	osc.connect(amp).connect(ctx.destination);
	osc.start(ctx.currentTime + start);
	osc.stop(ctx.currentTime + start + dur + 0.02);
};

const SOUNDS: Record<Cue, () => void> = {
	tap: () => tone(520, 0, 0.06, "triangle"),
	strike: () => {
		tone(220, 0, 0.09, "square", 0.04);
		tone(330, 0.05, 0.12, "triangle");
	},
	turn: () => {
		tone(660, 0, 0.1);
		tone(880, 0.1, 0.14);
	},
	win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.25, "triangle", 0.07)),
	pop: () => tone(740, 0, 0.07, "sine", 0.05),
	send: () => {
		tone(600, 0, 0.05, "triangle");
		tone(900, 0.05, 0.07, "triangle");
	}
};

export const play = (cue: Cue) => {
	if (!isSoundOn()) return;
	try {
		ctx ??= new AudioContext();
		if (ctx.state === "suspended") void ctx.resume();
		SOUNDS[cue]();
	} catch {
		/* audio not available */
	}
};

export const haptic = (pattern: number | number[]) => {
	if (prefersReducedMotion()) return;
	try {
		navigator.vibrate?.(pattern);
	} catch {
		/* unsupported */
	}
};
