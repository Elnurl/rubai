# Production-ish image for the rubai API (Railway / Render / Fly).
# Build from repo root:
#   docker build -t rubai-api -f Dockerfile .
FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.7.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY scripts ./scripts
COPY lib ./lib
COPY artifacts/api-server ./artifacts/api-server

RUN pnpm install --frozen-lockfile --filter @workspace/api-server...
RUN pnpm --filter @workspace/api-server build

ENV NODE_ENV=production
ENV PORT=5000
# Raise Node's HTTP header limit (default 16KB) to avoid HTTP 431 from mobile JWTs.
ENV NODE_OPTIONS=--max-http-header-size=131072
EXPOSE 5000

CMD ["pnpm", "--filter", "@workspace/api-server", "start"]
