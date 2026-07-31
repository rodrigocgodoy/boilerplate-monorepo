# Testes

Suíte do monorepo: **Vitest** (unit + integração) e **Playwright** (E2E), com
configuração compartilhada em `packages/vitest-config` e um banco de teste
efêmero que sobe e desce sozinho.

## Comandos

```bash
pnpm test              # Vitest em todos os workspaces (sem infra; integração se pula)
pnpm test:watch        # modo watch
pnpm test:coverage     # com relatório de cobertura

pnpm test:db           # sobe Postgres efêmero → migrations → suíte COMPLETA → derruba
pnpm test:db:coverage  # idem, com cobertura

pnpm test:e2e          # E2E completo: Postgres + API + app, sem mock
pnpm test:e2e:smoke    # só os specs que mockam a API (rápido, sem Docker)

# por workspace
pnpm --filter @repo/api test
pnpm --filter @repo/app test
pnpm --filter @repo/ui  test

# primeira vez (baixa o browser do Playwright)
pnpm --filter @repo/app exec playwright install chromium
pnpm --filter @repo/app test:e2e:ui    # runner visual
```

> `pnpm test` **não** precisa de Docker: sem banco, os `*.int.test.ts` se pulam
> e a suíte segue com os unitários. `pnpm test:db` é o comando que roda tudo.

## O que está coberto

| Onde | Tipo | Cobre |
|------|------|-------|
| `apps/api/test/*.test.ts` | integração (`app.inject`) + unit | `GET /me` (401, i18n do erro), guards das rotas (401/402/403/503), HMAC do webhook, jobIds idempotentes, quota/escopos/categorias |
| `apps/api/test/auth-flow.int.test.ts` | **integração com banco** | cadastro → sessão → `GET /me` 200 → logout → 401, senha errada, e-mail duplicado |
| `apps/api/test/*.int.test.ts` | **integração com banco** | entitlements, audit, notifications, api-keys, export LGPD |
| `apps/api/test/queue.int.test.ts` | **integração com Redis** | fila real: enfileirar→processar, retry com backoff, DLQ, replay, payload obsoleto e shutdown esperando o job ativo |
| `apps/app/test/login-form.test.tsx` | componente (jsdom) | validação Zod, payload enviado ao Better Auth, toast de erro, aba de cadastro |
| `apps/app/test/dashboard.test.tsx` | componente (jsdom) | dados do `useGetMe`, skeleton, sessão expirada, badge de não lidas, logout |
| `packages/ui/test/*.test.tsx` | componente (jsdom) | render, acessibilidade e composição (`asChild`) dos primitivos |
| `apps/app/e2e/auth-flow.spec.ts` | **E2E real** | caminho crítico ponta a ponta, sem mock nenhum |
| `apps/app/e2e/login.spec.ts` | E2E (API mockada) | login, `?redirect=`, fluxo de "esqueci a senha" |

## Como funciona

### Configuração compartilhada (`packages/vitest-config`)

Três presets, para não repetir config em cada workspace:

- **`base`** — `clearMocks`/`restoreMocks` e as opções de cobertura (provider
  **v8**: nativo do Node, sem instrumentar o bundle).
- **`node`** — `apps/api`. Ambiente Node, sem DOM.
- **`react`** — `apps/app` e `packages/ui`. jsdom, plugin do React, matchers do
  jest-dom e `cleanup()` entre testes.

Cada workspace só declara o que é dele (aliases, env) via `mergeConfig`.

> O pacote é consumido como **fonte** pelo carregador de config do Vite, que
> externaliza workspaces e os carrega como ESM nativo. Por isso os imports
> internos dele levam extensão (`./base.ts`).
>
> Os matchers do jest-dom são importados no setup compartilhado, mas cada
> workspace de UI mantém um `test/matchers.d.ts` de uma linha — o setup está
> fora do programa do TypeScript local, e sem essa âncora o `tsc` não enxerga a
> augmentação do `expect`.

### Banco de teste efêmero

`docker-compose.test.yml` sobe um Postgres (**55432**) e um Redis (**56379**)
isolados dos de desenvolvimento em três eixos: container próprio, porta própria
(sobrescrevíveis com `TEST_DB_PORT` / `TEST_REDIS_PORT`) e **sem persistência** —
o Postgres usa `tmpfs` e o Redis roda com `--save ''`. Nenhum teste alcança a
infra de dev por acidente.

`scripts/test-db.ts` orquestra: `up --wait` → `migrate deploy` → o comando →
teardown num `finally` (e em `SIGINT`). O teardown é o ponto do script: um
container órfão faria o próximo teste herdar dados do anterior, que é o tipo de
flakiness que só aparece na segunda execução.

### Integração da API

- **Sem porta:** `test/helpers/build-app.ts` registra o `backendPlugin` num
  Fastify e os testes usam `app.inject()`.
- **DB-free por padrão:** o Pool do Prisma é lazy, então os testes que respondem
  antes de qualquer query (401, 503, validação) não precisam de Postgres.
- **Com Redis (`queue.int.test.ts`):** roda só com `TEST_REDIS_URL` setado
  (`describeQueue`). Cada teste usa um `queueName` único, então execuções
  paralelas não disputam a mesma fila.
- **Com banco (`*.int.test.ts`):** rodam só com `TEST_DATABASE_URL` setado —
  senão `describeDb` (= `describe.skip`) os pula. O `fileParallelism` desliga
  nesse modo: os arquivos compartilham o mesmo Postgres e o `resetDb()`
  (TRUNCATE … CASCADE) de um não pode apagar os dados de outro no meio do teste.
- **Env hermético:** o `vitest.config.ts` define `test.env`, então a suíte não
  depende do seu `.env`.

> **Pegadinha do Turbo:** ele roda as tasks com um env **filtrado**. Variável
> não declarada em `turbo.json` não chega no Vitest — e a integração se auto-pula
> em silêncio, deixando a suíte verde sem ter tocado no banco. Por isso as tasks
> `test`/`test:coverage`/`test:watch` declaram `TEST_DATABASE_URL` e
> `TEST_REDIS_URL`. Se você criar uma task de teste nova, declare também.

### E2E

Dois modos, escolhidos pela presença de `TEST_DATABASE_URL`:

- **smoke** (`pnpm test:e2e:smoke`) — só o Vite; os specs interceptam as chamadas
  do Better Auth. Rápido e sem Docker, mas prova só o que o front faz sozinho.
- **completo** (`pnpm test:e2e`) — Postgres efêmero + **API real** + app. O
  `auth-flow.spec.ts` cria conta, cai no dashboard e confere os dados vindos do
  `GET /me`. Se ele passa, o fluxo Zod → OpenAPI → Kubb → React está inteiro.

A readiness da API é o próprio `/health` (que consulta o banco), não a porta
aberta — assim o Playwright só começa quando a stack inteira responde.

> **Build antes do E2E.** A API roda via `tsx` (fonte), mas importa
> `@repo/database` e `@repo/emails` pelo **`dist`** — sem build, ela nem sobe.
> O `pnpm test:e2e` já constrói o necessário (`turbo run build
> --filter=@repo/api --filter=@repo/api-client`), então funciona em clone limpo;
> o Turbo cacheia, e da segunda vez em diante isso é instantâneo. Se você chamar
> o Playwright direto (`pnpm --filter @repo/app test:e2e`), construa antes.

Seletores por `id` (`#signin-email`) são estáveis entre idiomas. No E2E real,
prefira escopar (ex.: o `<dl>` do dashboard): o nome do usuário também aparece no
seletor de organização, e um seletor amplo passaria sem provar nada.

## Cobertura

`pnpm test:coverage` (ou `pnpm test:db:coverage` para incluir a integração).
Relatórios em `<workspace>/coverage` — `text` no terminal, `html` para inspecionar
e `lcov` para o CI, que sobe tudo como artefato.

Com a suíte completa (banco incluído):

| Workspace | Statements | Branches |
|-----------|-----------|----------|
| `@repo/api` | ~59% | ~63% |
| `@repo/ui` | ~31% | ~80% |
| `@repo/app` | ~14% | ~35% |

O número global é **deliberadamente baixo** e não deve ser perseguido. A
cobertura usa `all: true`, ou seja, conta todo arquivo do workspace, inclusive
telas inteiras que ninguém testa (o `/admin` sozinho tem 466 linhas). Um número
alto viria de testar telas CRUD triviais, não de reduzir risco.

O que interessa é o caminho crítico, e ele está coberto:

| Arquivo | Statements |
|---------|-----------|
| `routes/_app/dashboard.tsx` | 97% |
| `modules/me/route.ts` | 87% |
| `components/auth/login-form.tsx` | 85% |
| `utils/environment.ts` | 97% |

## Adicionando testes a um novo package

1. `pnpm --filter <pkg> add -D vitest @repo/vitest-config`
2. Crie o `vitest.config.ts`:
   ```ts
   import { nodeConfig } from '@repo/vitest-config/node' // ou /react
   export default nodeConfig
   ```
   Precisa de alias ou env? Componha com `mergeConfig` (veja `apps/api`).
3. Adicione `"test": "vitest run"`, `"test:watch": "vitest"` e
   `"test:coverage": "vitest run --coverage"` aos scripts — o `pnpm test` da raiz
   já os pega via Turbo.

## Achados registrados como teste

- **`stop()` do runner de jobs é idempotente.** A API chama `jobs.stop()` no hook
  `onClose` enquanto o `closeWithGrace` também encerra o processo; sem a guarda,
  o segundo `quit()` numa conexão já fechada lançava `Connection is closed` — e um
  shutdown que estoura esconde o erro que causou o shutdown. `queue.int.test.ts`
  fixa a propriedade.
- **`cookieCache` sobrevive ao logout.** `session.cookieCache` está ligado
  (5 min) em `better-auth/configs.ts`: nesse intervalo a sessão é validada por um
  cookie assinado, **sem consultar o banco**. Um token capturado antes do logout
  continua valendo até o cache expirar. O browser normal não é afetado (o logout
  apaga os cookies dele), e a troca — uma query a menos por request — é
  legítima. `auth-flow.int.test.ts` registra isso explicitamente para que a
  propriedade seja visível e qualquer mudança apareça no diff.

## Próximos passos

- E2E autenticado das telas de billing/admin (o `auth-flow.spec.ts` já dá o
  molde: cadastro real e navegação a partir dali).
- `--affected` do Turbo para rodar só o que mudou nos PRs.
