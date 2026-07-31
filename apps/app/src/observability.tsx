import { env } from '@repo/env/client'
import * as Sentry from '@sentry/react'
import type { ReactNode } from 'react'

const dsn = env.VITE_SENTRY_DSN

/** Observabilidade do client está ligada? (depende de VITE_SENTRY_DSN). */
export const observabilityEnabled = Boolean(dsn)

/**
 * Inicializa o Sentry no client. **No-op sem `VITE_SENTRY_DSN`** — nada é
 * carregado/enviado. Chamado uma vez em `main.tsx`, antes do render. Ver
 * UPGRADES.md.
 */
export function initObservability(): void {
  if (!dsn) return
  Sentry.init({
    dsn,
    environment:
      env.VITE_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'production',
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: env.VITE_SENTRY_TRACES_SAMPLE_RATE,
  })
}

function Fallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="font-semibold text-lg">Algo deu errado</h1>
      <p className="text-muted-foreground text-sm">
        Recarregue a página. Se persistir, contate o suporte.
      </p>
    </div>
  )
}

/**
 * Envolve a árvore com o ErrorBoundary do Sentry quando a observabilidade está
 * ligada; senão, repassa os filhos sem overhead.
 */
export function ObservabilityBoundary({ children }: { children: ReactNode }) {
  if (!dsn) return children
  return (
    <Sentry.ErrorBoundary fallback={<Fallback />}>
      {children}
    </Sentry.ErrorBoundary>
  )
}
