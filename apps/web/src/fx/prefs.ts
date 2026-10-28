import { useSyncExternalStore } from "react";

const SOUND_KEY = "bingo.sound";

const read = () => {
	try {
		return localStorage.getItem(SOUND_KEY) === "on";
	} catch {
		return false;
	}
};

let soundOn = read();
const listeners = new Set<() => void>();

export const setSound = (on: boolean) => {
	soundOn = on;
	try {
		localStorage.setItem(SOUND_KEY, on ? "on" : "off");
	} catch {
		/* storage unavailable: preference lasts for this session only */
	}
	listeners.forEach((l) => l());
};

export const isSoundOn = () => soundOn;

export const useSound = () =>
	useSyncExternalStore(
		(cb) => {
			listeners.add(cb);
			return () => listeners.delete(cb);
		},
		() => soundOn
	);

export const prefersReducedMotion = () =>
	typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
