# ChatndBingo revamp plan

Goal: rebuild on Bun + React 19 with our own WebSocket layer and Redis, sized for Render's free tier, with polished client micro-interactions.

> Render free-tier numbers below (512 MB RAM, ~15 min idle spin-down, ~25 MB free Key Value) are from memory — verify against Render's docs before relying on them.

## Problems with the old code

**Server**
- `CheckRoom` referenced an undefined variable (`roomsInfo`), so the handler threw and never replied.
- Room codes came from `Math.random() * 9999`; rooms never expired in Redis.
- `NoRoom/${id}` / `FullRoom/${id}` replies were broadcast to every client with `io.emit`.
- The client decided the winner and the strikes, so anyone could cheat with one message.
- No sessions: a refresh lost the seat (and the client blocked refresh with `beforeunload`).
- `nedb` was installed but unused.

**Client**
- CRA 3.4.1 (deprecated), React 16, React Router 5.
- State lived in the DOM (`getElementById`, `innerText`) and `matrix` was mutated in place.
- `bingoMatrix.js` was 25 hand-written `<td>`s.
- Socket listeners were re-registered on every join attempt; the server URL was hardcoded.
- HTML5 drag-and-drop does not work on touch; Font Awesome Pro came from a CDN.

## Architecture

One Bun workspace, one Render web service, one free Render Key Value instance.

```
apps/web         Vite + React 19 + TypeScript
apps/server      Bun.serve: static files + /healthz + /ws
packages/shared  Message types and pure game logic, used by both sides
```

### WebSocket layer (Bun native, replaces socket.io)
- `Bun.serve` WebSocket with topic pub/sub for room fan-out.
- JSON envelopes `{ t, rid?, ...payload }`, typed in `packages/shared`. Every request gets one explicit reply, never a broadcast.
- App-level ping (~25 s) to keep connections alive through Render's proxy.
- Sessions: server issues `{playerId, token}`; client stores it in `localStorage`. Reconnecting within a grace period reclaims the seat and receives a full snapshot. A disconnected player's turn is skipped after a timeout.
- Server-authoritative game: boards are submitted at Ready and then locked; the server validates strikes, tracks lines, decides the winner. Chat is rate-limited and length-capped.
- Room codes: 5 characters from an unambiguous alphabet, from `crypto.getRandomValues`, collision-checked.

### Redis (a cache, shaped for the free tier)
- Live game state stays in memory; Redis is written on transitions only (create / join / ready / start / end), not per move or chat message.
- One key per room with a sliding TTL (~2 h); chat history is a trimmed list (last 50).
- After a restart or spin-down, rooms rehydrate lazily from Redis. A flushed Redis just loses those rooms.
- Cross-instance fan-out via Redis pub/sub is deferred: Render's free tier is a single instance, and multi-instance would also need room-ownership locking. Bun's `RedisClient` already exposes `publish`/`subscribe`, so it's a clean follow-up.
- Everything sits behind a `RoomStore` interface: in-memory implementation when `REDIS_URL` is unset (local dev needs nothing), Redis implementation otherwise.

### Render fit
- `render.yaml` blueprint: web service + free Key Value, connection string injected.
- Dockerfile on `oven/bun` for a deterministic Bun version.
- `/healthz` for the health check; no persistent disk is needed.
- Cold starts handled honestly in the UI ("waking the server…", retry with backoff, connection pill). No keep-alive pingers.
- Cap rooms/players and evict idle rooms to stay inside 512 MB.

## Client

- Vite, React 19, TypeScript, React Router 7 (library mode).
- State driven by server snapshots; no DOM reads.
- One `<Board>` of real `<button>`s in an ARIA grid with keyboard support.
- Pointer-based drag-to-swap that works on touch.
- Keep the existing look (Fredoka, blue/pink palette) with CSS variables; self-hosted fonts, inline SVG icons; responsive.

### Micro-interactions
All honour `prefers-reduced-motion`; sound is off by default.
- Buttons press and spring back; inputs get floating labels and a validation shake.
- Create/Join cards tilt on hover.
- Randomize animates cells to their new positions (FLIP).
- Drag-swap: cell lifts, target highlights, spring swap.
- Ready button morphs into a checkmark.
- Striking a number: ink-stamp on the cell, ripple for opponent strikes.
- Completed line sweep highlight; B-I-N-G-O letters light up with a bounce.
- Win: confetti, winner banner, short vibration on mobile.
- Turn indicator: pulsing avatar ring, optional turn-timer ring.
- Avatars pop in/out on join/leave, with a toast.
- Chat: messages slide in, typing indicator, animated send, quick emoji reactions.
- Room code: Copy → "Copied ✓", Web Share button.
- Connection pill: connecting / waking / reconnecting.

## Phases

Status: all six phases are implemented on this branch (Phase 3 and 5 landed together).

1. **Foundation** — Bun workspace, `packages/shared` with game logic + tests, remove `nedb` and CRA.
2. **Server** — `Bun.serve`, protocol, rooms, sessions/reconnect, `RoomStore` (memory then Redis), server-authoritative game; `bun test` incl. multi-socket integration tests.
3. **Client core** — Vite app, socket hook with reconnect, home / lobby / game / chat at feature parity, new `<Board>` with touch drag.
4. **Deploy** — Dockerfile, `render.yaml`, `/healthz`, cold-start UX, README rewrite.
5. **Micro-interactions and polish** — the list above, plus accessibility and mobile passes.
6. **Hardening** — Playwright e2e (2–4 clients: create, join, play, win, reconnect), CI workflow, rate limits and room caps.

## Defaults chosen

TypeScript; 4 players per room by default (2–6 configurable); current visual identity kept; short alphanumeric room codes (old numeric links stop working); sound off by default.
