import { resolve } from 'node:path'
import { reactConfig } from '@repo/vitest-config/react'
import { defineConfig, mergeConfig } from 'vitest/config'

/** Mesma configuração do `apps/app` — ver a nota lá sobre não reusar o vite.config. */
export default mergeConfig(
  reactConfig,
  defineConfig({
    resolve: {
      alias: { '@': resolve(__dirname, 'src') },
    },
    test: {
      env: { VITE_API_URL: 'http://localhost:3333' },
    },
  }),
)
