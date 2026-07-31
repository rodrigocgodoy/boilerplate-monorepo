import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const PORT = 5173
const API_PORT = 3333
// O Playwright carrega este arquivo como ESM nativo (o app é `type: module`),
// onde `__dirname` não existe — diferente do `vite.config.ts`, que passa pelo
// transpile do Vite.
const rootDir = fileURLToPath(new URL('../..', import.meta.url))

/**
 * E2E do app.
 *
 * Roda em dois modos, de propósito:
 *
 * - **smoke (sem infra)** — `pnpm --filter @repo/app test:e2e`. Sobe só o Vite;
 *   os specs interceptam as chamadas do Better Auth. Rápido, roda em qualquer
 *   máquina, mas prova só o que o front faz sozinho.
 * - **completo** — `pnpm test:e2e` na raiz. Um Postgres efêmero é criado
 *   (`scripts/test-db.ts`), a API sobe contra ele e o `auth-flow.spec.ts`
 *   exercita cadastro → sessão → dashboard **de verdade**, sem mock nenhum.
 *
 * A chave é a `TEST_DATABASE_URL`: com ela, a API entra na jogada.
 */
const testDbUrl = process.env.TEST_DATABASE_URL
const withApi = Boolean(testDbUrl)

const appServer = {
  command: 'pnpm dev',
  url: `http://localhost:${PORT}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
}

/**
 * API real apontada para o banco de teste. O `/health` consulta o Postgres, ou
 * seja, só responde 200 quando a stack inteira está de pé — é o sinal de
 * readiness certo, melhor que esperar a porta abrir.
 */
const apiServer = {
  command: 'pnpm --filter @repo/api exec tsx src/index.ts',
  cwd: rootDir,
  url: `http://localhost:${API_PORT}/health`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
  env: {
    ...process.env,
    DATABASE_URL: testDbUrl ?? '',
    // Sem Redis, os jobs (e-mail de verificação no signup) rodam inline e são
    // logados — o E2E não depende de fila nem de provedor de e-mail.
    REDIS_URL: '',
    API_LOG_LEVEL: 'warn',
  },
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: withApi ? [apiServer, appServer] : [appServer],
})
