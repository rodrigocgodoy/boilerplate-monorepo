# syntax=docker/dockerfile:1
#
# Imagem do painel administrativo (Vite + React) — SPA estática servida por nginx.
#
#   docker build -f apps/app/Dockerfile -t boilerplate-admin \
#     --build-arg VITE_API_URL=https://api.seudominio.com .
#
# Contexto de build = raiz do monorepo.
#
# **As variáveis `VITE_*` são assadas no bundle em BUILD time.** Não existe
# trocar a URL da API em runtime: apontar para outro backend exige rebuild. É
# consequência de o Vite substituir os valores no código, não uma escolha nossa
# — e é o tropeço mais comum de quem promove a mesma imagem de staging para
# produção esperando que o env mude junto.

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

# ── Prune ────────────────────────────────────────────────────────────────────
# Inclui @repo/api porque o `openapi.yaml` dele é a entrada do Kubb, que gera os
# hooks que o app importa (`packages/api-client/gen` é gitignored).
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.7.6 prune @repo/admin @repo/api --docker

# ── Dependências ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY --from=pruner /app/out/json/ .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ── Build ────────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY --from=pruner /app/out/full/ .

# Defaults de desenvolvimento; sobrescreva com --build-arg no deploy real.
#
# O linter do Docker avisa sobre `VITE_POSTHOG_KEY` em ARG/ENV. É falso
# positivo: a Project API Key do PostHog é **pública** por definição — ela vai
# no bundle que qualquer visitante baixa. O mesmo vale para o DSN do Sentry.
# Segredo de verdade nunca deve ter o prefixo `VITE_`, justamente porque tudo
# que o tem acaba no browser.
ARG VITE_API_URL=http://localhost:3333
# URL do app: o painel redireciona para lá ao impersonar.
ARG VITE_APP_URL=http://localhost:5173
ARG VITE_SENTRY_DSN=
ARG VITE_SENTRY_ENVIRONMENT=production
ARG VITE_SENTRY_TRACES_SAMPLE_RATE=0
ARG VITE_POSTHOG_KEY=
ARG VITE_POSTHOG_HOST=https://us.i.posthog.com
ENV VITE_API_URL=$VITE_API_URL \
    VITE_APP_URL=$VITE_APP_URL \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    VITE_SENTRY_ENVIRONMENT=$VITE_SENTRY_ENVIRONMENT \
    VITE_SENTRY_TRACES_SAMPLE_RATE=$VITE_SENTRY_TRACES_SAMPLE_RATE \
    VITE_POSTHOG_KEY=$VITE_POSTHOG_KEY \
    VITE_POSTHOG_HOST=$VITE_POSTHOG_HOST

# `prisma generate` roda na cadeia de build do @repo/database (dep do api-client
# via @repo/api); não conecta em build time.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build

# Upload dos source maps ao Sentry (opcional).
#
# O token vai por **secret do BuildKit**, não por `ARG`: build args ficam
# gravados no histórico da imagem (`docker history` os mostra), e o
# SENTRY_AUTH_TOKEN dá acesso de escrita ao projeto. Secret é montado só durante
# o RUN e não entra em camada nenhuma.
#
#   docker build -f apps/app/Dockerfile \
#     --secret id=sentry_token,env=SENTRY_AUTH_TOKEN \
#     --build-arg SENTRY_ORG=sua-org --build-arg SENTRY_PROJECT=seu-proj .
#
# Sem o secret, o plugin é no-op e o build segue normalmente.
ARG SENTRY_ORG=
ARG SENTRY_PROJECT=
ENV SENTRY_ORG=$SENTRY_ORG \
    SENTRY_PROJECT=$SENTRY_PROJECT
RUN --mount=type=secret,id=sentry_token,required=false \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_token 2>/dev/null || true)" \
    pnpm build --filter=@repo/admin

# ── Runtime: nginx ───────────────────────────────────────────────────────────
# O resultado do build é HTML/CSS/JS estático — não há Node em runtime. nginx
# alpine entrega isso em ~50 MB, contra ~200 MB de uma imagem Node servindo os
# mesmos arquivos, e trata cache, gzip e fallback de SPA sem código nosso.
FROM nginx:1.27-alpine AS app

COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/admin/dist /usr/share/nginx/html

# Os `.map` são gerados como `hidden` (sem referência no bundle) para o upload
# ao Sentry, mas não podem ser servidos: publicá-los entrega o código-fonte
# original a qualquer visitante. Faça o upload a partir do artefato de build,
# não da imagem.
RUN find /usr/share/nginx/html -name '*.map' -delete

# Usuário não-root: a imagem oficial já traz o usuário `nginx`. Os diretórios de
# escrita precisam pertencer a ele, e o master process não pode tentar bindar
# porta privilegiada — por isso a 8080 no conf.
RUN touch /var/run/nginx.pid \
    && chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /usr/share/nginx/html
USER nginx

EXPOSE 8080

# `wget` já vem na imagem alpine do nginx (via busybox), então não instalamos
# nada só para o healthcheck.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
