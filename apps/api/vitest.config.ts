import { resolve } from 'node:path'
import { nodeConfig } from '@repo/vitest-config/node'
import { defineConfig, mergeConfig } from 'vitest/config'

// Banco de teste opcional: com `TEST_DATABASE_URL` setado (CI, `pnpm test:db`
// ou export manual), os testes de integração (`*.int.test.ts`) rodam contra
// ele; senão se auto-pulam (`describe.skipIf`) e o `DATABASE_URL` fake nunca é
// consultado. Ver TESTING.md.
const testDbUrl = process.env.TEST_DATABASE_URL

export default mergeConfig(
  nodeConfig,
  defineConfig({
    // Resolve o alias `@/*` (mesmo do tsconfig) para o Vitest.
    resolve: {
      alias: { '@': resolve(__dirname, 'src') },
    },
    test: {
      // Com banco de teste, roda os arquivos em série: eles compartilham o
      // mesmo Postgres e o `resetDb()` (TRUNCATE) de um arquivo não pode apagar
      // os dados de outro no meio do teste. Sem banco (só unitários), mantém o
      // paralelismo.
      fileParallelism: !testDbUrl,
      // Env hermético: não depende do .env real. A API não conecta no banco ao
      // subir (Pool é lazy); só rotas que consultam o DB precisariam dele.
      env: {
        ENV: 'test',
        COOKIE_SECRET: 'test-cookie-secret',
        BETTER_AUTH_SECRET: 'test-better-auth-secret',
        BETTER_AUTH_URL: 'http://localhost:3333',
        APP_URL: 'http://localhost:5173',
        DATABASE_URL: testDbUrl || 'postgresql://test:test@localhost:5432/test',
        // Repassado para os testes decidirem rodar (integração) ou pular.
        TEST_DATABASE_URL: testDbUrl || '',
      },
    },
  }),
)
