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
- **packages/{biome-config,typescript-config,vitest-config}** — configs compartilhadas.

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

## Testes

```bash
pnpm test        # Vitest em todos os workspaces (não precisa de Docker)
pnpm test:db     # sobe um Postgres efêmero e roda a suíte COMPLETA
pnpm test:e2e    # E2E real: Postgres + API + app, sem mock
```

Detalhes e cobertura em [`TESTING.md`](./TESTING.md). As decisões que valem
explicar:

- **Configuração compartilhada, não copiada.** Os presets do Vitest vivem em
  `packages/vitest-config` (`base`/`node`/`react`). Cada workspace declara só o
  que é dele. Config de teste duplicada diverge em silêncio: um workspace ganha
  uma regra, o outro não, e a diferença só aparece quando um teste falha por
  motivo errado.
- **A suíte roda sem infra; o banco é opt-in e efêmero.** `pnpm test` funciona
  numa máquina sem Docker (os testes de integração se pulam). Quando o banco
  entra, ele é um container próprio em `tmpfs`, numa porta própria, criado e
  destruído pelo comando — os testes nunca alcançam o banco de desenvolvimento,
  e não existe estado sobrevivente entre execuções.
- **Um E2E que roda de verdade.** `auth-flow.spec.ts` faz cadastro → dashboard
  contra API e Postgres reais, sem um único mock. É o único teste capaz de
  afirmar que a corrente Zod → OpenAPI → Kubb → React está inteira; dez specs
  com a rede mockada não afirmam isso. Os smokes mockados continuam existindo
  para quem quer feedback rápido sem Docker.
- **Rede mockada em teste unitário.** `apps/app` mocka `@repo/api-client` e o
  `auth-client`. Teste unitário que faz I/O é lento, some quando a rede oscila e
  transforma falha de ambiente em falha de código.
- **Cobertura como diagnóstico, não como meta.** O relatório conta todos os
  arquivos (`all: true`), então o número global é baixo de propósito — ele mostra
  o que não é testado em vez de premiar quem testa o trivial. O alvo é o caminho
  crítico (login, dashboard, `GET /me`, auth), que está entre 85% e 97%.

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
