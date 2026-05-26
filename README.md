# Boilerplate Monorepo (SaaS)

[![CI](https://github.com/Dellub/boilerplate-monorepo/actions/workflows/ci.yml/badge.svg)](https://github.com/Dellub/boilerplate-monorepo/actions/workflows/ci.yml)

Ponto de partida enxuto para SaaS: auth pronta, geração de client tipado a partir do OpenAPI, banco com Prisma e UI com tokens fáceis de customizar.

## Stack

- **apps/app** — Vite + React 19 + TanStack Router/Query (login + 1 página autenticada).
- **apps/api** — Fastify + Zod + Better Auth, gera `openapi.yaml` automaticamente.
- **packages/api-client** — Kubb gera hooks React Query a partir do `openapi.yaml`.
- **packages/database** — Prisma + adapter-pg (somente modelos do Better Auth).
- **packages/ui** — primitivos shadcn + tokens neutros (OKLCH) fáceis de editar.
- **packages/utils** — `auth-client` + resolução de URL da API.
- **packages/{biome-config,typescript-config}** — configs compartilhadas.

## Pré-requisitos

- Node `>= 24.10` e pnpm `>= 10.32` (veja `.nvmrc`).
- Docker (para o Postgres local).

## Bootstrap

```bash
cp .env.example .env          # ajuste os segredos
pnpm install
pnpm dep-up                   # sobe o Postgres
pnpm db:generate              # gera o Prisma Client
pnpm db:migrate               # cria as tabelas do Better Auth (migration inicial)
pnpm openapi                  # gera apps/api/openapi.yaml
pnpm api-client               # Kubb gera os hooks tipados
pnpm dev                      # api em :3333, app em :5173
```

Acesse `http://localhost:5173` → você é redirecionado para `/login`. Crie uma
conta com email/senha e caia no `/dashboard`, que consome o hook `useGetMe()`.

Docs da API (Scalar) em `http://localhost:3333/reference` (modo dev).

## Fluxo OpenAPI → hooks

1. As rotas da API são tipadas com Zod (`fastify-type-provider-zod`).
2. `pnpm openapi` sobe o Fastify em memória e escreve `apps/api/openapi.yaml`.
3. `pnpm api-client` roda o Kubb, que lê esse YAML e gera `models` + `hooks`.
4. O app importa os hooks de `@repo/api-client/hooks`.

Sempre que mudar/adicionar uma rota, rode `pnpm openapi && pnpm api-client`.

## Customização

- **Cores / tokens**: `packages/ui/src/styles/globals.css` (variáveis `--*` em
  `:root` e `.dark`).
- **Auth**: `apps/api/src/modules/better-auth/configs.ts`.
- **Adicionar Redis, MinIO/S3, email, etc.**: veja [`UPGRADES.md`](./UPGRADES.md).
- **Traduções (i18n)**: `packages/i18n` (veja abaixo).

## Internacionalização (i18n)

Idiomas: **pt-BR** (padrão), **en**, **es**. As mensagens ficam no pacote
compartilhado `@repo/i18n` (`packages/i18n/src/locales/*.ts`), agrupadas por
namespace (`common`, `auth`, `validation`, `dashboard`) e com chaves tipadas.

- **Frontend** (`apps/app`): react-i18next inicializado em `src/i18n.ts`
  (detecção por `localStorage` → navegador, preferência persistida). Use
  `useTranslation([ns...])` e `t('ns:chave')`; há um `LanguageSwitcher` no login
  e no dashboard.
- **API** (`apps/api`): resolve o idioma por request via header `Accept-Language`
  (`src/utils/i18n.ts` + hook em `plugin.ts`), expõe `request.t` e responde com
  `Content-Language`. Ex.: o 401 de `GET /me` é traduzido.

**Adicionar um idioma**: copie `packages/i18n/src/locales/pt-BR.ts`, traduza,
registre em `config.ts` (`locales`) e em `resources.ts`. **Nova chave**:
adicione no `pt-BR.ts` (referência de tipos) e nos demais.
