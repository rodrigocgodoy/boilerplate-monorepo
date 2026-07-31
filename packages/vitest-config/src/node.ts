import { defineConfig, mergeConfig } from 'vitest/config'
import { baseConfig } from './base.ts'

/**
 * Preset para workspaces de servidor (`apps/api`, packages sem DOM).
 * Sem jsdom e sem plugin de React — só o ambiente Node.
 */
export const nodeConfig = mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    },
  }),
)
