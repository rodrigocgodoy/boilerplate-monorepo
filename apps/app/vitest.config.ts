import { resolve } from 'node:path'
import { reactConfig } from '@repo/vitest-config/react'
import { defineConfig, mergeConfig } from 'vitest/config'

/**
 * Testes unitários do app (jsdom + Testing Library). Deliberadamente **não**
 * reaproveita o `vite.config.ts`: o plugin do TanStack Router gera a
 * `routeTree.gen.ts` e o Tailwind processa CSS — nada disso é necessário para
 * testar componentes, e ambos deixariam a suíte lenta e acoplada ao build.
 *
 * Rede em teste unitário é mockada (`@repo/api-client`, `@repo/utils/auth-client`);
 * o caminho real com API de verdade é coberto pelo E2E (`pnpm test:e2e`).
 */
export default mergeConfig(
  reactConfig,
  defineConfig({
    resolve: {
      alias: { '@': resolve(__dirname, 'src') },
    },
    test: {
      env: {
        // `getApiBaseUrl()` (em `@repo/utils`) lança se a var não existir, e ela
        // roda no import do `auth-client`. Fixa aqui para o teste não depender
        // do .env da raiz.
        VITE_API_URL: 'http://localhost:3333',
      },
    },
  }),
)
