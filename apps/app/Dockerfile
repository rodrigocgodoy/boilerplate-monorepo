# syntax=docker/dockerfile:1
# Build do app (Vite + React) — SPA estática servida por `serve`.
# Contexto de build = raiz do monorepo:
#   docker build -f apps/app/Dockerfile -t boilerplate-app \
#     --build-arg VITE_API_URL=https://api.seudominio.com .
#
# IMPORTANTE: o Vite "assa" os VITE_* no bundle em BUILD time. Passe-os como
# --build-arg (abaixo). Em runtime não dá para trocar a URL da API.

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

# --- Prune: app + api (api só pelo openapi.yaml que o api-client lê no build) ---
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.7.6 prune @repo/app @repo/api --docker

# --- Install + build ---
FROM base AS builder
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
# VITE_* assados no bundle (defaults dev; sobrescreva no build).
ARG VITE_API_URL=http://localhost:3333
ARG VITE_SENTRY_DSN=
ARG VITE_POSTHOG_KEY=
ARG VITE_POSTHOG_HOST=
ENV VITE_API_URL=$VITE_API_URL \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    VITE_POSTHOG_KEY=$VITE_POSTHOG_KEY \
    VITE_POSTHOG_HOST=$VITE_POSTHOG_HOST
# `turbo build --filter=@repo/app` builda o api-client (kubb lê o openapi.yaml)
# + ui/i18n/utils antes do app.
RUN pnpm build --filter=@repo/app

# --- Runner: serve estático ---
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S web -G nodejs
COPY --from=builder --chown=web:nodejs /app .
USER web
WORKDIR /app/apps/app
EXPOSE 3000
ENV PORT=3000
# Serve o SPA direto pelo bin do `serve` (sem passar pelo pnpm em runtime → sem
# prompt do corepack). `-s` faz fallback de qualquer rota para o index (SPA).
CMD ["sh", "-c", "node_modules/.bin/serve -s dist -l tcp://0.0.0.0:${PORT:-3000}"]
