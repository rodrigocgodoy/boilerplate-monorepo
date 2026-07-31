import { defineConfig } from 'vitest/config'

/**
 * Nunca contam para a cobertura: código **gerado** (Kubb, Prisma, TanStack
 * Router), configs, entrypoints de build/bootstrap e os próprios testes.
 * Medir código gerado infla o número sem dizer nada sobre o nosso código.
 */
export const coverageExclude = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.turbo/**',
  '**/gen/**',
  '**/generated/**',
  '**/*.gen.ts',
  '**/routeTree.gen.ts',
  '**/*.config.{ts,js,mjs}',
  '**/test/**',
  '**/e2e/**',
  '**/*.test.{ts,tsx}',
  '**/*.d.ts',
  '**/prisma/**',
]

/**
 * Base compartilhada por todos os workspaces. Só define o que deve ser igual em
 * todo lugar (mocks limpos entre testes, formato do relatório de cobertura);
 * ambiente e plugins ficam nos presets `node`/`react`.
 *
 * O provider de cobertura é o **v8** (nativo do Node, sem instrumentar o
 * bundle) — o default recomendado pelo Vitest; `istanbul` seria mais preciso em
 * branches, mas custa uma passada de instrumentação em cada arquivo.
 */
export const baseConfig = defineConfig({
  test: {
    // Restaura spies/mocks entre testes: evita que um `vi.fn()` de um teste
    // vaze estado para o próximo (fonte clássica de teste "flaky por ordem").
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      // `text` no terminal, `html` para inspeção local, `lcov` para o CI.
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: coverageExclude,
      // Reporta também os arquivos que nenhum teste tocou — sem isso a
      // cobertura mede só o que já é testado, e o número mente.
      all: true,
    },
  },
})
