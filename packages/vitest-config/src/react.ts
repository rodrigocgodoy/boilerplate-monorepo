import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, mergeConfig } from 'vitest/config'
import { baseConfig } from './base.ts'

/**
 * Caminho absoluto do setup compartilhado. Resolvido a partir deste módulo (e
 * não do cwd) para que cada workspace herde o mesmo setup sem copiar arquivo.
 */
const setupFile = fileURLToPath(new URL('./setup-react.ts', import.meta.url))

/**
 * Preset para workspaces de UI (`apps/app`, `packages/ui`): jsdom + plugin de
 * React + matchers do jest-dom.
 *
 * O `dedupe` repete o do `vite.config.ts` do app de propósito: sob pnpm, React
 * e os pacotes do TanStack podem ser resolvidos em cópias diferentes (peer deps
 * por workspace) e duas instâncias de React quebram hooks/context em teste com
 * um erro que não aponta para a causa.
 */
export const reactConfig = mergeConfig(
  baseConfig,
  defineConfig({
    plugins: [react()],
    resolve: {
      dedupe: [
        'react',
        'react-dom',
        '@tanstack/react-query',
        '@tanstack/react-router',
      ],
    },
    test: {
      environment: 'jsdom',
      setupFiles: [setupFile],
      include: ['test/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    },
  }),
)
