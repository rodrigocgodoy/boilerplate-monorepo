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
    },
    server: {
      host: '0.0.0.0',
      port: env.APP_PORT ? Number(env.APP_PORT) : 5173,
      strictPort: true,
    },
  }
})
