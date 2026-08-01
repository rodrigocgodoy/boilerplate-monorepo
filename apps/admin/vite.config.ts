import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // Carrega as variáveis de ambiente do .env na raiz do monorepo
  const env = loadEnv(mode, path.resolve(__dirname, '../../'), '')

  return {
    plugins: [
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
        // biome-ignore lint/suspicious/noExplicitAny: tipo do plugin
      }) as any,
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve('.', './src'),
      },
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
      // Mesma escolha do app: os `.map` existem para o Sentry desminificar, mas
      // não são referenciados pelo bundle nem servidos. Ver UPGRADES.md.
      sourcemap: 'hidden',
    },
    server: {
      host: '0.0.0.0',
      // Porta própria: o admin roda ao lado do app em desenvolvimento
      // (`pnpm dev` sobe os dois), e em produção vira outro host/subdomínio.
      port: env.ADMIN_PORT ? Number(env.ADMIN_PORT) : 5174,
      strictPort: true,
    },
  }
})
