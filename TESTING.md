# Testes

Fundação de testes do monorepo: **Vitest** (unit + integração) e **Playwright**
(E2E). Cada package roda seus testes via Turborepo.

## Comandos

```bash
pnpm test            # roda todos os Vitest (turbo run test, com cache + ^build)
pnpm test:e2e        # roda os testes E2E (Playwright) do app

# por package
pnpm --filter @repo/api test          # integração + unit da API
pnpm --filter @repo/ui  test          # componentes (jsdom)
pnpm --filter @repo/api test:watch    # modo watch

# primeira vez (baixa o browser do Playwright)
pnpm --filter app exec playwright install chromium
pnpm --filter app test:e2e:ui         # runner visual do Playwright
```

## O que já está coberto

| Onde | Tipo | Cobre |
|------|------|-------|
| `apps/api/test/*.test.ts` | integração (`app.inject`) + unit | guards das rotas (401/402/403/503), HMAC do webhook, jobIds idempotentes, quota/escopos/categorias (funções puras) |
| `apps/api/test/*.int.test.ts` | **integração com banco** | fluxos com Postgres real: entitlements (consumo/limite/seats), audit (record/list), notifications (notify/preferências), api-keys (create→verify→revoke), export LGPD |
| `packages/ui/test/button.test.tsx` | componente (jsdom) | render, clique e estado disabled do `Button` |
| `apps/app/e2e/login.spec.ts` | E2E (Playwright) | a tela de login renderiza |

## Como funciona

- **Vitest por package:** cada um tem seu `vitest.config.ts`. A API usa
  `environment: 'node'`; `@repo/ui` usa `jsdom` + `@testing-library/react`.
  O alias `@/*` é resolvido no config da API (igual ao tsconfig).
- **Integração da API sem porta:** `apps/api/test/helpers/build-app.ts` registra
  o `backendPlugin` num Fastify e os testes usam `app.inject()`. **Não conecta
  no banco** ao subir (o Pool do Prisma é lazy), então esses testes não precisam
  de Postgres — cobrem os caminhos que respondem antes de qualquer query.
- **Env hermético:** o `vitest.config.ts` da API define `test.env` (secrets de
  teste, `DATABASE_URL` dummy), então os testes não dependem do seu `.env`.
- **Testes de integração com banco (`*.int.test.ts`):** rodam **só quando
  `TEST_DATABASE_URL` está setado** — senão, `describeDb` (= `describe.skip`) os
  pula e o `pnpm test` segue só com os unitários (continua funcionando sem
  infra). Quando há banco, o config aponta o `DATABASE_URL` para ele e desliga o
  paralelismo de arquivos (`fileParallelism: false`) — eles compartilham o mesmo
  Postgres e o `resetDb()` (TRUNCATE … CASCADE no `beforeEach`) de um arquivo não
  pode apagar dados de outro. Fixtures (`createUser`/`createOrg`/`createPlan`) e
  helpers ficam em `test/helpers/db.ts`. **No CI**, o job `quality` sobe um
  Postgres, roda `migrate deploy` e seta `TEST_DATABASE_URL` — então a integração
  roda a cada PR.

**Rodar a integração localmente** (não toca no banco de dev — use um separado):

```bash
docker exec boilerplate-postgres psql -U postgres -c 'CREATE DATABASE boilerplate_test;'
DATABASE_URL='postgresql://postgres:postgres@localhost:5432/boilerplate_test?schema=public' \
  pnpm --filter @repo/database exec prisma migrate deploy
TEST_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/boilerplate_test?schema=public' \
  pnpm --filter @repo/api test
```
- **Turbo:** o task `test` tem `dependsOn: ["^build"]` porque `@repo/database`
  é consumido como `dist` (precisa estar buildado).
- **Playwright:** sobe o dev server do app (`webServer`) e testa no Chromium.
  Seletores por `id` (`#signin-email`) são estáveis entre idiomas.

## Próximos passos (não incluídos nesta fundação)

- **E2E autenticado** (login → dashboard → checkout): suba a stack completa
  (`pnpm dev` na raiz: API + Postgres + app) e crie um usuário via API no
  `beforeAll` (ou um storage state de sessão reaproveitável).
- **Cobertura:** `vitest run --coverage` (adicione `@vitest/coverage-v8`).

## Adicionando testes a um novo package

1. `pnpm --filter <pkg> add -D vitest` (o override fixa a versão 3.x compatível
   com o Vite 5).
2. Crie `vitest.config.ts` (copie o de `@repo/api` ou `@repo/ui`).
3. Adicione `"test": "vitest run"` aos scripts — o `pnpm test` da raiz já o pega.
