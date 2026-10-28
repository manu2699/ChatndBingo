import { afterAll, describe, expect, test } from "bun:test";
import { createRoom } from "./engine";
import { MemoryStore, RedisStore, type RoomStore } from "./store";

const run = (name: string, make: () => RoomStore) =>
	describe(name, () => {
		const store = make();
		afterAll(() => store.close());
		const code = `T${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

		test("claim is exclusive and load returns null until saved", async () => {
			expect(await store.claim(code, 60)).toBe(true);
			expect(await store.claim(code, 60)).toBe(false);
			expect(await store.load(code)).toBeNull();
		});

		test("save / load round-trips and remove deletes", async () => {
			const { room } = createRoom(code, "Ann");
			await store.save(room, 60);
			expect(await store.load(code)).toEqual(room);
			await store.remove(code);
			expect(await store.load(code)).toBeNull();
			expect(await store.claim(code, 60)).toBe(true);
			await store.remove(code);
		});
	});

run("MemoryStore", () => new MemoryStore());

// Opt-in: REDIS_URL=redis://localhost:6379 bun test
if (process.env.REDIS_URL) run("RedisStore", () => new RedisStore(process.env.REDIS_URL!));
