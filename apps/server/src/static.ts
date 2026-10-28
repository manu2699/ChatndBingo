import { join, normalize, sep } from "node:path";

const cacheFor = (path: string) =>
	path.includes(`${sep}assets${sep}`)
		? "public, max-age=31536000, immutable"
		: "no-cache";

/** Serve the built web app, falling back to index.html for client-side routes. */
export const serveStatic = async (root: string, pathname: string): Promise<Response> => {
	let rel: string;
	try {
		rel = decodeURIComponent(pathname);
	} catch {
		return new Response("Bad request", { status: 400 });
	}
	const file = normalize(join(root, rel));
	if (file !== root && !file.startsWith(root + sep)) return new Response("Not found", { status: 404 });

	const hit = Bun.file(file);
	if (rel !== "/" && (await hit.exists()) && !file.endsWith(sep)) {
		return new Response(hit, { headers: { "Cache-Control": cacheFor(file) } });
	}

	// Unknown file-looking paths are real 404s; anything else is an SPA route.
	if (/\.[a-z0-9]+$/i.test(rel)) return new Response("Not found", { status: 404 });
	const index = Bun.file(join(root, "index.html"));
	if (await index.exists()) {
		return new Response(index, { headers: { "Cache-Control": "no-cache" } });
	}
	return new Response("Web app not built. Run `bun run build`.", { status: 404 });
};
