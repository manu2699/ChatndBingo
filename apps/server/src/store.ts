import { RedisClient } from "bun";
import type { RoomState } from "./engine";

/**
 * Where rooms live between touches. The hub keeps hot state in memory and
 * only calls this on state transitions, so Redis traffic stays tiny.
 */
export interface RoomStore {
	/** Reserve a code. Returns false when it's already taken. */
	claim(code: string, ttlSeconds: number): Promise<boolean>;
	load(code: string): Promise<RoomState | null>;
	save(room: RoomState, ttlSeconds: number): Promise<void>;
	remove(code: string): Promise<void>;
	close(): void;
}

export class MemoryStore implements RoomStore {
	private rooms = new Map<string, { json: string; expires: number }>();

	private live(code: string) {
		const hit = this.rooms.get(code);
		if (!hit) return undefined;
		if (hit.expires < Date.now()) {
			this.rooms.delete(code);
			return undefined;
		}
		return hit;
	}

	async claim(code: string, ttlSeconds: number) {
		if (this.live(code)) return false;
		this.rooms.set(code, { json: "", expires: Date.now() + ttlSeconds * 1000 });
		return true;
	}

	async load(code: string) {
		const hit = this.live(code);
		return hit && hit.json ? (JSON.parse(hit.json) as RoomState) : null;
	}

	async save(room: RoomState, ttlSeconds: number) {
		this.rooms.set(room.code, { json: JSON.stringify(room), expires: Date.now() + ttlSeconds * 1000 });
	}

	async remove(code: string) {
		this.rooms.delete(code);
	}

	close() {}
}

const key = (code: string) => `bingo:room:${code}`;

export class RedisStore implements RoomStore {
	private client: RedisClient;

	constructor(url: string) {
		this.client = new RedisClient(url);
		this.client.onclose = (err) => console.warn("[redis] connection closed:", err?.message ?? err);
		this.client.onconnect = () => console.info("[redis] connected");
	}

	async claim(code: string, ttlSeconds: number) {
		const res = await this.client.set(key(code), "", "NX", "EX", String(ttlSeconds));
		return res === "OK";
	}

	async load(code: string) {
		const raw = await this.client.get(key(code));
		return raw ? (JSON.parse(raw) as RoomState) : null;
	}

	async save(room: RoomState, ttlSeconds: number) {
		await this.client.set(key(room.code), JSON.stringify(room), "EX", ttlSeconds);
	}

	async remove(code: string) {
		await this.client.del(key(code));
	}

	close() {
		this.client.close();
	}
}

export const createStore = (redisUrl: string | null): RoomStore =>
	redisUrl ? new RedisStore(redisUrl) : new MemoryStore();
