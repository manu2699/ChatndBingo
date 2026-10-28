import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const serverPort = process.env.SERVER_PORT ?? "10000";

export default defineConfig({
	plugins: [react()],
	server: {
		port: 3000,
		proxy: {
			"/ws": { target: `ws://localhost:${serverPort}`, ws: true },
			"/healthz": `http://localhost:${serverPort}`
		}
	},
	build: { sourcemap: false, target: "es2022" }
});
