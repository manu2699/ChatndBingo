import type { Config } from "./config";
import { Hub, newSocketData, type SocketData } from "./hub";
import type { RoomStore } from "./store";
import { serveStatic } from "./static";

export const startServer = (config: Config, store: RoomStore) => {
	const startedAt = Date.now();

	const originAllowed = (req: Request) => {
		const origin = req.headers.get("origin");
		if (!origin) return true; // non-browser clients
		try {
			const { host, hostname } = new URL(origin);
			return (
				host === req.headers.get("host") ||
				hostname === "localhost" ||
				hostname === "127.0.0.1" ||
				config.allowedOrigins.includes(origin)
			);
		} catch {
			return false;
		}
	};

	// `hub` needs server.publish, and the server needs the hub's handlers.
	let hub: Hub;

	const server = Bun.serve<SocketData>({
		port: config.port,
		hostname: config.hostname,

		async fetch(req, srv) {
			const url = new URL(req.url);

			if (url.pathname === "/ws") {
				if (!originAllowed(req)) return new Response("Forbidden", { status: 403 });
				if (!hub.canAccept()) return new Response("Server busy", { status: 503 });
				if (srv.upgrade(req, { data: newSocketData() })) return undefined;
				return new Response("Expected a WebSocket upgrade", { status: 426 });
			}

			if (url.pathname === "/healthz") {
				return Response.json({
					ok: true,
					uptime: Math.round((Date.now() - startedAt) / 1000),
					redis: config.redisUrl !== null,
					...hub.stats
				});
			}

			return serveStatic(config.staticDir, url.pathname);
		},

		websocket: {
			maxPayloadLength: 8 * 1024,
			idleTimeout: 120,
			perMessageDeflate: false,
			open: (ws) => hub.open(ws),
			message: (ws, raw) => hub.message(ws, raw),
			close: (ws) => hub.close(ws)
		}
	});

	hub = new Hub(store, config, (topic, data) => server.publish(topic, data));

	const stop = async () => {
		await hub.shutdown();
		store.close();
		await server.stop(true);
	};

	return { server, hub, stop };
};
