import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Resolve o alias `@/*` (mesmo do tsconfig) para o Vitest.
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    // Env hermético: não depende do .env real. A API não conecta no banco ao
    // subir (Pool é lazy); só rotas que consultam o DB precisariam dele.
    env: {
      ENV: 'test',
      COOKIE_SECRET: 'test-cookie-secret',
      BETTER_AUTH_SECRET: 'test-better-auth-secret',
      BETTER_AUTH_URL: 'http://localhost:3333',
      APP_URL: 'http://localhost:5173',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    },
  },
})
