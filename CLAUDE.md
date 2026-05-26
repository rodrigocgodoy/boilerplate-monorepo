# CLAUDE.md

Monorepo boilerplate para SaaS. Use este arquivo como guia ao trabalhar no repo.

## Guia do repositório

**Arquitetura (pnpm workspaces + Turborepo):**

- `apps/app` — Vite + React 19 + TanStack Router/Query. Roteamento file-based em
  `src/routes`: `_auth` (rotas públicas, ex. login) e `_app` (rotas protegidas,
  ex. dashboard). Consome hooks tipados de `@repo/api-client`.
- `apps/api` — Fastify + Zod + Better Auth. Toda rota é tipada com Zod
  (`fastify-type-provider-zod`); o `@fastify/swagger` deriva o OpenAPI. Auth em
  `src/modules/better-auth`, rota de exemplo em `src/modules/me`.
- `packages/api-client` — Kubb lê `apps/api/openapi.yaml` e gera `models` + `hooks`.
- `packages/database` — Prisma + adapter-pg, só com modelos do Better Auth.
- `packages/ui` — primitivos shadcn + tokens neutros (OKLCH).
- `packages/utils` — `auth-client` (Better Auth React) e `api-url`.
- `packages/{biome-config,typescript-config}` — configs compartilhadas.

**Comandos chave:**

```bash
pnpm install
pnpm dep-up            # Postgres via docker
pnpm db:generate      # Prisma Client
pnpm db:migrate       # migrations (cria/atualiza tabelas)
pnpm openapi          # gera apps/api/openapi.yaml
pnpm api-client       # Kubb gera os hooks
pnpm dev              # api :3333 + app :5173
pnpm lint / pnpm lint:fix / pnpm build
```

**Regras importantes:**

- Ao mudar/adicionar rota na API, rode `pnpm openapi && pnpm api-client` para
  regenerar os hooks. Não edite `packages/api-client/gen/*` à mão.
- Ao mudar o schema do Better Auth (plugins/campos), rode `pnpm auth:generate`
  (atualiza `packages/database/prisma/schema.prisma`) e depois `pnpm db:migrate`.
- Cores e tokens da UI: `packages/ui/src/styles/globals.css`.
- Para adicionar Redis, MinIO/S3, email, plugins de auth: veja `UPGRADES.md`.

## Setup MCP

O `.mcp.json` declara três servers — `figma-desktop`, `context7` e `serena`.

Pré-requisitos por dev:

1. **Figma Desktop** rodando com Dev Mode MCP ligado (`Preferences → Enable local MCP server`) — serve em `http://127.0.0.1:3845`.
2. **`uvx`** instalado pra Serena: `curl -LsSf https://astral.sh/uv/install.sh | sh`.
3. **API key do Context7** exportada no shell antes de abrir o Claude Code:
   ```sh
   export CONTEXT7_API_KEY="ctx7sk-xxxxxxxx"
   ```
   A chave vive em `~/.zshrc` (ou equivalente), nunca no repo.

No primeiro start após clonar, o Claude Code pede aprovação do trust dialog pros 3 servers.

<!-- autoskills:start -->

Skills disponíveis em `.claude/skills` (resumo). Veja os arquivos completos.

## Accessibility (a11y)

Auditar e melhorar acessibilidade web seguindo WCAG 2.2. "improve accessibility", "a11y audit", "WCAG", "screen reader", "keyboard navigation".

- `.claude/skills/accessibility/SKILL.md`

## Better Auth Integration Guide

Configurar Better Auth server/client, adapters de banco, sessões, plugins e env vars. Use quando mencionarem Better Auth, auth.ts, ou auth com email/senha, OAuth ou plugins.

- `.claude/skills/better-auth-best-practices/SKILL.md`

## Email & Password (Better Auth)

Verificação de email, reset de senha, políticas de senha e hashing no Better Auth.

- `.claude/skills/email-and-password-best-practices/SKILL.md`

## Organization (Better Auth)

Multi-tenant, membros/convites, roles e permissões, teams e RBAC com o plugin organization.

- `.claude/skills/organization-best-practices/SKILL.md`

## Two-Factor Authentication (Better Auth)

TOTP, OTP por email/SMS, backup codes, trusted devices e fluxo de 2FA.

- `.claude/skills/two-factor-authentication-best-practices/SKILL.md`

## Frontend Design

Interfaces front-end de alta qualidade. Use ao construir componentes, páginas, dashboards, layouts HTML/CSS ou estilizar UI.

- `.claude/skills/frontend-design/SKILL.md`

## Node.js Backend Patterns

Serviços Node.js de produção com Express/Fastify: middleware, error handling, auth, banco e design de API.

- `.claude/skills/nodejs-backend-patterns/SKILL.md`

## Node.js Best Practices

Princípios de Node.js: escolha de framework, async, segurança e arquitetura.

- `.claude/skills/nodejs-best-practices/SKILL.md`

## Prisma CLI Reference

Comandos do Prisma CLI. "prisma init/generate/migrate/db/studio".

- `.claude/skills/prisma-cli/SKILL.md`

## Prisma Client API Reference

API do Prisma Client: queries, filtros, operadores. "findMany", "create", "$transaction".

- `.claude/skills/prisma-client-api/SKILL.md`

## Prisma Database Setup

Configurar Prisma com diferentes providers (PostgreSQL, MySQL, SQLite, MongoDB).

- `.claude/skills/prisma-database-setup/SKILL.md`

## Prisma Postgres

Setup e operações do Prisma Postgres (Console, create-db CLI, Management API).

- `.claude/skills/prisma-postgres/SKILL.md`

## SEO Optimization

Otimização para busca. "improve SEO", "meta tags", "structured data", "sitemap".

- `.claude/skills/seo/SKILL.md`

## shadcn/ui

Gerenciar componentes shadcn — adicionar, buscar, corrigir, estilizar, compor. Para projetos com `components.json`.

- `.claude/skills/shadcn/SKILL.md`

## Tailwind CSS Patterns

Padrões utility-first do Tailwind: responsivo, layout, flexbox, grid, spacing, tipografia, cores.

- `.claude/skills/tailwind-css-patterns/SKILL.md`

## Tailwind v4 + shadcn/ui Production Stack

Setup Tailwind v4 + shadcn/ui + Vite + React. `@theme inline`, CSS variables, dark mode, `components.json`, gotchas do v4.

- `.claude/skills/tailwind-v4-shadcn/SKILL.md`

## Turborepo

Build system do monorepo: `turbo.json`, pipelines, `dependsOn`, cache, `--filter`, `--affected`, env vars, internal packages.

- `.claude/skills/turborepo/SKILL.md`

## TypeScript Advanced Types

Generics, conditional types, mapped types, template literals e utility types.

- `.claude/skills/typescript-advanced-types/SKILL.md`

## React Composition Patterns

Composição em React: compound components, lifting state, evitar proliferação de props booleanas.

- `.claude/skills/vercel-composition-patterns/SKILL.md`

## Vercel React Best Practices

Performance de React/Next.js da Vercel Engineering. Use ao escrever/revisar/refatorar React.

- `.claude/skills/vercel-react-best-practices/SKILL.md`

## Vite

Configuração do Vite, plugin API, SSR e migração Vite 8 Rolldown.

- `.claude/skills/vite/SKILL.md`

<!-- autoskills:end -->
