import { defineConfig } from 'tsup'

/**
 * Bundle da API para produção (`node dist/...`).
 *
 * Por quê bundlar: alguns pacotes internos (`@repo/i18n`, `@repo/utils`,
 * `@repo/jobs`, `@repo/emails`) são consumidos como **fonte TS** (ótima DX no
 * dev com tsx/Vite). O Node puro não roda TS, então em produção nós os
 * **inlinamos** no bundle.
 *
 * Tudo o mais — `@repo/database`/Prisma e todo o node_modules (bullmq,
 * react-email, better-auth, fastify…) — fica **externo** (resolvido de
 * node_modules em runtime). Isso evita arrastar libs CJS pesadas pro bundle ESM
 * (que quebram com "Dynamic require"). O plugin abaixo externaliza qualquer
 * import "bare" que não seja `@repo/*`.
 */
export default defineConfig({
  entry: ['src/index.ts', 'src/worker.ts', 'src/instrument.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  // Força bundlar os pacotes consumidos como fonte (o tsup, por padrão,
  // externaliza deps declaradas). `@repo/database` fica de fora de propósito —
  // continua externo para o Prisma resolver o client gerado em node_modules.
  noExternal: ['@repo/i18n', '@repo/utils', '@repo/jobs', '@repo/emails'],
  esbuildPlugins: [
    {
      name: 'external-except-repo',
      setup(build) {
        // Imports "bare" (não começam com . ou /): externaliza, exceto a nossa
        // fonte — `@repo/*` (pacotes do workspace) e `@/*` (alias do tsconfig
        // da própria API → src/*).
        build.onResolve({ filter: /^[^./]/ }, args => {
          if (args.path.startsWith('@repo/') || args.path.startsWith('@/')) {
            return null // deixa o esbuild resolver/bundlar
          }
          return { path: args.path, external: true }
        })
      },
    },
  ],
})
