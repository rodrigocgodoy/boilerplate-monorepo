# syntax=docker/dockerfile:1
# Build da API (Fastify) — multi-stage com `turbo prune` (monorepo pnpm).
# Contexto de build = raiz do monorepo:
#   docker build -f apps/api/Dockerfile -t boilerplate-api .

FROM node:24-alpine AS base
RUN corepack enable
# openssl: usado pelo Prisma no `generate`.
RUN apk add --no-cache openssl
WORKDIR /app

# --- Prune: isola @repo/api + suas deps de workspace ---
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.7.6 prune @repo/api --docker

# --- Install + build ---
FROM base AS builder
# 1) deps (camada cacheável): só os package.json + lockfile podados.
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
# 2) código podado + build (turbo builda @repo/database — prisma generate — e
#    as demais deps antes da API, via `^build`).
COPY --from=pruner /app/out/full/ .
# `prisma generate` exige DATABASE_URL no config (não conecta) — valor dummy só
# para o build; o runtime usa o DATABASE_URL real do ambiente.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN pnpm build --filter=@repo/api

# --- Runner ---
FROM base AS runner
# `ENV` (do schema do app) controla o modo: production desliga swagger/openapi/
# /reference (que são dev-only). `NODE_ENV` segue o padrão da stack Node.
ENV NODE_ENV=production
ENV ENV=production
# Usuário não-root.
RUN addgroup -S nodejs && adduser -S fastify -G nodejs
COPY --from=builder --chown=fastify:nodejs /app .
USER fastify
EXPOSE 3333
# `--import instrument.js`: liga o Sentry antes do app (no-op sem SENTRY_DSN).
CMD ["node", "--import", "./apps/api/dist/instrument.js", "apps/api/dist/index.js"]
