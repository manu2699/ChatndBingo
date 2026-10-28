import { config } from "./config";
import { startServer } from "./server";
import { createStore } from "./store";

const store = createStore(config.redisUrl);
const { server, stop } = startServer(config, store);

console.info(
	`[bingo] listening on ${server.hostname}:${server.port} (${config.redisUrl ? "redis" : "in-memory"} store)`
);

const shutdown = async () => {
	await stop();
	process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
