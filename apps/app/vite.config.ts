import path from 'node:path'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // Carrega as variáveis de ambiente do .env na raiz do monorepo
  const env = loadEnv(mode, path.resolve(__dirname, '../../'), '')

  // Credenciais de build do Sentry. **Sem prefixo `VITE_` de propósito**: elas
  // não podem entrar no bundle. O `SENTRY_AUTH_TOKEN` dá acesso de escrita ao
  // seu projeto — publicá-lo seria entregar a chave junto com o site.
  const sentryAuthToken = env.SENTRY_AUTH_TOKEN
  const sentryOrg = env.SENTRY_ORG
  const sentryProject = env.SENTRY_PROJECT

  return {
    plugins: [
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
        // biome-ignore lint/suspicious/noExplicitAny: tipo do plugin
      }) as any,
      react(),
      tailwindcss(),
      // Envia os source maps ao Sentry no build e os apaga em seguida.
      //
      // Sem upload, o stack trace de produção aponta para `index-7hNUh92Z.js:48`
      // — um arquivo minificado que não existe no repositório. Com upload, o
      // Sentry mostra o `.tsx` original com a linha certa. Ou seja: gerar o
      // source map sem enviá-lo não serve para nada, e enviar à mão é o passo
      // que todo mundo esquece.
      //
      // **No-op sem `SENTRY_AUTH_TOKEN`** — quem clona o repo sem Sentry não
      // sente diferença, e o build não quebra por falta de credencial.
      sentryVitePlugin({
        disable: !sentryAuthToken,
        authToken: sentryAuthToken,
        org: sentryOrg,
        project: sentryProject,
        // Precisa bater com o `release` passado ao `Sentry.init` no client,
        // senão o Sentry não associa o mapa ao evento.
        release: { name: env.VITE_SENTRY_RELEASE || undefined },
        sourcemaps: {
          // Apaga os `.map` depois do upload: eles cumpriram o papel, e servi-los
          // publicamente entregaria o código-fonte a qualquer visitante.
          filesToDeleteAfterUpload: ['./dist/**/*.map'],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve('.', './src'),
      },
      // Força uma única instância dessas libs no bundle (evita quebrar
      // context/QueryClientProvider por cópias via peer deps do pnpm).
      dedupe: [
        'react',
        'react-dom',
        '@tanstack/react-query',
        '@tanstack/react-router',
      ],
    },
    root: './',
    envDir: '../../',
    define: {
      'process.env': { ...process.env, ...env },
    },
    build: {
      outDir: './dist',
      emptyOutDir: true,
      // `hidden`: gera os `.map` mas NÃO adiciona o comentário
      // `//# sourceMappingURL` no bundle. Assim o Sentry consegue desminificar
      // o stack trace depois do upload, sem que o código-fonte fique servido
      // publicamente para quem abrir o devtools.
      //
      // Faça o upload no deploy e **não publique** os `.map`:
      //   npx @sentry/cli sourcemaps inject --org X --project Y dist
      //   npx @sentry/cli sourcemaps upload --org X --project Y \
      //     --release "$VITE_SENTRY_RELEASE" dist
      // Ver DEPLOYING.md.
      sourcemap: 'hidden',
    },
    server: {
      host: '0.0.0.0',
      port: env.APP_PORT ? Number(env.APP_PORT) : 5173,
      strictPort: true,
    },
  }
})
