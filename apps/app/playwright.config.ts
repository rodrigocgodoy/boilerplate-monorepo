import { defineConfig, devices } from '@playwright/test'

const PORT = 5173

/**
 * E2E do app. Sobe o dev server do Vite (carrega o .env da raiz via envDir).
 * Para fluxos autenticados (login → dashboard), suba também a API + Postgres
 * (`pnpm dev` na raiz) — ver TESTING.md.
 */
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
  webServer: {
    command: 'pnpm dev',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
