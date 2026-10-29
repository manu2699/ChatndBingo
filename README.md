# 💬 Chat & Bingo

Play Bingo online with friends, with live chat. Rooms of 2–6 players (4 by default), reconnect-safe, built to fit [Render](https://render.com)'s free tier.

## Stack

| Layer | Tech |
| --- | --- |
| Runtime / server | [Bun](https://bun.sh): `Bun.serve` with native WebSockets and topic pub/sub |
| Realtime | Our own small JSON protocol over WebSockets (no socket.io) |
| State | In memory while a room is active, written through to Redis/Valkey so rooms survive restarts |
| Client | React 19, TypeScript, Vite, React Router, zustand |

```
apps/server      Bun server: WebSocket hub, game engine, Redis/memory stores, static hosting
apps/web         React client
packages/shared  Board/line rules + the typed protocol, used by both sides
e2e/             Playwright browser tests
docs/            Revamp plan
```

## How it works

- **Server-authoritative.** Players submit their board when they hit *Ready*; after that the server validates every strike, keeps turn order, counts lines and decides the winner (ties are possible). Boards are never sent to other players.
- **Rooms** are identified by a 5-character code. Hot state lives in memory; the room is saved to Redis on changes with a 2 h sliding TTL and lazily reloaded after a restart or when Render wakes the service.
- **Sessions.** Joining returns a `{playerId, token}` stored in `localStorage`. Reloading, switching networks or a server restart resumes the same seat; a player who stays offline during their turn is skipped after 15 s, and loses the seat after 5 min.
- **Free-tier friendly.** Redis is written on transitions only (not per chat message or typing event), idle rooms are evicted, rooms/connections are capped, sockets are rate-limited, and the client shows an honest "waking the server" state during cold starts.
- **Protocol.** `packages/shared/src/protocol.ts` lists every message. Requests carry an optional `rid`, answered by a reply with the same `rid` (or an `error`).

## Develop

```bash
bun install
```

```bash
bun run dev:server   # http://localhost:10000, in-memory rooms
```

```bash
bun run dev:web      # http://localhost:3000, proxies /ws to the server
```

Optional: run a local Redis and start the server with `REDIS_URL=redis://localhost:6379`.

```bash
bun test             # unit + server integration tests (set REDIS_URL to also cover the Redis store)
bun run typecheck
bun run build        # builds apps/web/dist, served by the server
bun run test:e2e     # Playwright (needs `bunx playwright install chromium` and a build)
```

## Configuration

See [`.env.example`](.env.example). Everything is optional.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `10000` | HTTP + WebSocket port (Render sets this) |
| `REDIS_URL` | – | Redis/Valkey URL. Without it, rooms live in memory only |
| `ALLOWED_ORIGINS` | – | Extra WebSocket origins (same-origin and localhost are always allowed) |
| `ROOM_TTL_SECONDS` | `7200` | Sliding room expiry |
| `MAX_ROOMS` / `MAX_CONNECTIONS` | `500` / `1000` | Capacity guards |

## Deploy on Render

`render.yaml` is a Blueprint defining one free web service (Docker, health check `/healthz`) and one free Key Value instance wired in through `REDIS_URL`.

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, pick the repo, apply.

Things to know about the free tier (check Render's current docs, they change): the service sleeps after a period without traffic and takes a while to wake, there is no persistent disk, and the free Key Value instance is small and not durable. The app is designed around exactly that: Redis is a cache, so losing it only drops the active rooms.

## Roadmap

Cross-instance fan-out via Redis pub/sub is not implemented (a free service is a single instance). See [`docs/REVAMP_PLAN.md`](docs/REVAMP_PLAN.md).

---

> 💻 & 🎨 with 💖 by [Maneesh K](https://maneeshk.now.sh)
