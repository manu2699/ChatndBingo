const num = (name: string, fallback: number) => {
	const v = Number(process.env[name]);
	return Number.isFinite(v) && v > 0 ? v : fallback;
};

export const config = {
	port: num("PORT", 10000),
	hostname: process.env.HOST ?? "0.0.0.0",
	redisUrl: process.env.REDIS_URL || null,
	/** Extra origins allowed to open a WebSocket (same-origin and localhost are always allowed). */
	allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean),
	staticDir: process.env.STATIC_DIR ?? new URL("../../web/dist", import.meta.url).pathname,
	roomTtlSeconds: num("ROOM_TTL_SECONDS", 2 * 60 * 60),
	maxRooms: num("MAX_ROOMS", 500),
	maxConnections: num("MAX_CONNECTIONS", 1000),
	heartbeatMs: num("HEARTBEAT_MS", 25_000),
	/** How long a dropped player keeps their seat before their turn is skipped. */
	turnSkipMs: num("TURN_SKIP_MS", 15_000),
	/** How long a disconnected player keeps their seat before being removed. */
	seatGraceMs: num("SEAT_GRACE_MS", 5 * 60_000),
	/** Idle rooms (nobody connected) are dropped from memory after this long. */
	evictAfterMs: num("EVICT_AFTER_MS", 30 * 60_000),
	persistDebounceMs: num("PERSIST_DEBOUNCE_MS", 250)
};

export type Config = typeof config;
