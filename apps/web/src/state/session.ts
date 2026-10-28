export interface Session {
	code: string;
	playerId: string;
	token: string;
	name: string;
}

const KEY = "bingo.session";
const NAME_KEY = "bingo.name";

const safe = <T>(fn: () => T, fallback: T): T => {
	try {
		return fn();
	} catch {
		return fallback;
	}
};

export const loadSession = (): Session | null =>
	safe(() => {
		const raw = localStorage.getItem(KEY);
		if (!raw) return null;
		const s = JSON.parse(raw) as Session;
		return s.code && s.playerId && s.token ? s : null;
	}, null);

export const saveSession = (s: Session) => safe(() => localStorage.setItem(KEY, JSON.stringify(s)), undefined);
export const clearSession = () => safe(() => localStorage.removeItem(KEY), undefined);

export const loadName = () => safe(() => localStorage.getItem(NAME_KEY) ?? "", "");
export const saveName = (n: string) => safe(() => localStorage.setItem(NAME_KEY, n), undefined);
