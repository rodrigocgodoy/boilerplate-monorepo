# syntax=docker/dockerfile:1
#
# Imagem da API (Fastify) e do worker de jobs — o mesmo build, dois alvos.
#
#   docker build -f apps/api/Dockerfile --target api    -t boilerplate-api .
#   docker build -f apps/api/Dockerfile --target worker -t boilerplate-worker .
#
# O contexto de build é a **raiz do monorepo** (o `.dockerignore` da raiz é o
# que vale — ver a nota em DEPLOYING.md).
#
# API e worker compartilham a imagem de propósito: os handlers de job usam os
# serviços da API (SubscriptionService, PaymentService, prisma, e-mails).
# Separar em duas imagens duplicaria o build inteiro para trocar uma linha de
# CMD, e as réplicas escalam de forma independente do mesmo jeito.

FROM node:24-alpine AS base
RUN corepack enable
# openssl: exigido pelo Prisma no `generate` e no `migrate deploy`.
# curl: usado pelo HEALTHCHECK (a imagem alpine do node não traz nenhum dos dois).
RUN apk add --no-cache openssl curl
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

# ── Prune ────────────────────────────────────────────────────────────────────
# Isola @repo/api e as deps de workspace dela. `--docker` separa a saída em
# `out/json` (só os manifests) e `out/full` (o código), que é o que permite
# instalar dependências numa camada que só invalida quando um package.json muda.
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.7.6 prune @repo/api --docker

# ── Dependências ─────────────────────────────────────────────────────────────
# Camada cacheável: só manifests + lockfile. Editar código-fonte não a invalida.
FROM base AS deps
COPY --from=pruner /app/out/json/ .
# Cache do store do pnpm entre builds (BuildKit). Substitui o `pnpm fetch`:
# o store fica fora da imagem, então nada disso entra no resultado final.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ── Build ────────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY --from=pruner /app/out/full/ .
# `prisma generate` exige DATABASE_URL no config (não conecta em build time).
# O valor real vem do ambiente em runtime.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
# O `^build` do Turbo garante que database/emails/env/i18n sejam compilados
# antes da API — todos são consumidos como `dist`.
RUN pnpm build --filter=@repo/api

# ── Poda para produção ───────────────────────────────────────────────────────
# `pnpm deploy` monta um diretório autocontido só com dependências de produção,
# com os pacotes de workspace copiados (não symlinkados). É o que tira do
# resultado final o TypeScript, o Vitest, o tsc-alias e o código-fonte — sem
# isso a imagem carrega o ambiente de build inteiro.
FROM builder AS pruned
RUN pnpm deploy --filter=@repo/api --prod --legacy /prod/api

# Nota sobre tamanho (~680 MB): o grosso é o CLI do Prisma, necessário aqui
# porque o entrypoint e o serviço `migrate` do compose rodam `migrate deploy`.
# Tentei podar o que produção não executa (studio, pglite, TypeScript) e **não
# dá**: o CLI do Prisma 7 carrega esses módulos no boot — remover qualquer um
# deles quebra o `migrate deploy` com `Cannot find module`.
#
# Para uma imagem de runtime enxuta, o caminho é tirar as migrations daqui:
# construa um alvo separado com o CLI e rode-o na fase de release da plataforma
# (ou como init container), deixando api/worker sem o CLI. Ver DEPLOYING.md.

# O `prisma.config.ts` do repo é TypeScript e o CLI o carrega em runtime; o
# Prisma 7 também não aceita mais `url` no schema, então o config é obrigatório
# para o `migrate deploy`. Em vez de arrastar o compilador TS para dentro da
# imagem, geramos aqui um equivalente em CommonJS — as mesmas três informações.
# O `.ts` fica fora da imagem (`files` no package.json do @repo/database).
RUN printf '%s\n' \
  "module.exports = {" \
  "  schema: 'prisma/schema.prisma'," \
  "  migrations: { path: 'prisma/migrations' }," \
  "  datasource: { url: process.env.DATABASE_URL }," \
  "}" > /prod/api/node_modules/@repo/database/prisma.config.cjs

# ── Runtime: API ─────────────────────────────────────────────────────────────
FROM base AS api
ENV NODE_ENV=production
# `ENV` é a variável da aplicação (desliga swagger/scalar, que são dev-only).
# `NODE_ENV` é o que bibliotecas de terceiros leem — em especial o rate limit do
# Better Auth. O boot recusa subir se as duas discordarem (ver packages/env).
ENV ENV=production
ENV PORT=3333

# Usuário não-root: um RCE na aplicação não deve virar root no container.
RUN addgroup -S nodejs && adduser -S fastify -G nodejs
COPY --from=pruned --chown=fastify:nodejs /prod/api .
COPY --chown=fastify:nodejs apps/api/docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
USER fastify

EXPOSE 3333

# `/health` consulta o banco, então o healthcheck cobre a stack, não só o
# processo. `start-period` dá folga para a primeira conexão e as migrations.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://localhost:${PORT}/health || exit 1

# `--import instrument.js` liga o Sentry antes do app (no-op sem SENTRY_DSN).
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "--import", "./dist/instrument.js", "dist/index.js"]

# ── Runtime: worker ──────────────────────────────────────────────────────────
FROM api AS worker
USER fastify

# O worker não escuta porta: o healthcheck confere que o processo está vivo e
# com a fila conectada. `pgrep` casa o entrypoint para não dar falso positivo
# com o próprio processo do healthcheck.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD pgrep -f "dist/worker.js" > /dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "--import", "./dist/instrument.js", "dist/worker.js"]
