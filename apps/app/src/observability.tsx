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
    // Precisa bater com a release usada no upload dos source maps, senão o
    // Sentry mostra o stack trace minificado — que é o mesmo que nada.
    release: env.VITE_SENTRY_RELEASE || undefined,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: env.VITE_SENTRY_TRACES_SAMPLE_RATE,
    sendDefaultPii: false,
    beforeSend(event) {
      // O front não deveria anexar segredo a evento nenhum, mas a URL entra
      // automaticamente — e o `?redirect=` do login pode carregar caminho de
      // convite, enquanto um reset de senha pode trazer o código na query.
      if (event.request?.url) {
        try {
          const url = new URL(event.request.url)
          for (const key of [...url.searchParams.keys()]) {
            if (/token|otp|secret|code|key/i.test(key)) {
              url.searchParams.set(key, '[REDACTED]')
            }
          }
          event.request.url = url.toString()
        } catch {
          // URL não parseável: melhor remover do que enviar às cegas.
          event.request.url = undefined
        }
      }
      return event
    },
  })
}

/**
 * Identifica o usuário nos eventos. Só o `id`: e-mail e nome são dados
 * pessoais, e `sendDefaultPii` está desligado de propósito. O id basta para
 * saber quantos usuários um erro atingiu.
 */
export function setObservabilityUser(userId: string | null): void {
  if (!dsn) return
  Sentry.setUser(userId ? { id: userId } : null)
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
