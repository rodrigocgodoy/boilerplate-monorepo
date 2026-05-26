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
| `apps/api/test/payment.test.ts` | integração (`app.inject`) | guards das rotas: 503 sem API key, 400 do Zod, 401 do webhook, 401 sem sessão |
| `apps/api/test/webhook-signature.test.ts` | unit | HMAC do webhook (assinatura válida/inválida, corpo adulterado) |
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
- **Turbo:** o task `test` tem `dependsOn: ["^build"]` porque `@repo/database`
  é consumido como `dist` (precisa estar buildado).
- **Playwright:** sobe o dev server do app (`webServer`) e testa no Chromium.
  Seletores por `id` (`#signin-email`) são estáveis entre idiomas.

## Próximos passos (não incluídos nesta fundação)

- **Integração com banco:** para testar rotas que consultam o DB (`/health`,
  sessão real, persistência de pagamento/assinatura), aponte `DATABASE_URL`
  para um banco/schema de teste e rode migrations + truncate entre os testes
  (ex.: um `globalSetup` que cria um schema dedicado).
- **E2E autenticado** (login → dashboard → checkout): suba a stack completa
  (`pnpm dev` na raiz: API + Postgres + app) e crie um usuário via API no
  `beforeAll` (ou um storage state de sessão reaproveitável).
- **Cobertura:** `vitest run --coverage` (adicione `@vitest/coverage-v8`).

## Adicionando testes a um novo package

1. `pnpm --filter <pkg> add -D vitest` (o override fixa a versão 3.x compatível
   com o Vite 5).
2. Crie `vitest.config.ts` (copie o de `@repo/api` ou `@repo/ui`).
3. Adicione `"test": "vitest run"` aos scripts — o `pnpm test` da raiz já o pega.
