# syntax=docker/dockerfile:1

# ---- build the web app ----
FROM oven/bun:1.4 AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# ---- runtime: server + built web, production deps only ----
FROM oven/bun:1.4-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile --production
COPY apps/server/src apps/server/src
COPY packages/shared/src packages/shared/src
COPY --from=build /app/apps/web/dist apps/web/dist

USER bun
EXPOSE 10000
# --smol trades a little speed for a smaller heap, which suits a 512 MB instance.
CMD ["bun", "--smol", "apps/server/src/index.ts"]
