import { env } from '@repo/env/client'
import posthog from 'posthog-js'
import { useEffect, useState } from 'react'

const key = env.VITE_POSTHOG_KEY
const host = env.VITE_POSTHOG_HOST

/** Analytics (PostHog) ligado? (depende de VITE_POSTHOG_KEY). */
export const analyticsEnabled = Boolean(key)

/**
 * Inicializa o PostHog (analytics de produto + feature flags + session replay).
 * **No-op sem `VITE_POSTHOG_KEY`** — nada carrega/envia. Chamado uma vez em
 * `main.tsx`. Ver UPGRADES.md.
 */
export function initAnalytics(): void {
  if (!key) return
  posthog.init(key, {
    api_host: host,
    // Pageviews são capturados manualmente no router (SPA). Ver main.tsx.
    capture_pageview: false,
    // Session replay liga/desliga no painel do PostHog (projeto).
    autocapture: true,
    persistence: 'localStorage+cookie',
  })
}

/** Identifica o usuário logado (para analytics e flags por usuário). */
export function identifyUser(user: {
  id: string
  email?: string
  name?: string
}): void {
  if (!analyticsEnabled) return
  posthog.identify(user.id, { email: user.email, name: user.name })
}

/** Limpa a identidade (no logout). */
export function resetAnalytics(): void {
  if (!analyticsEnabled) return
  posthog.reset()
}

/** Captura um pageview (chamado a cada navegação resolvida do router). */
export function capturePageview(): void {
  if (!analyticsEnabled) return
  posthog.capture('$pageview')
}

/** Evento de produto arbitrário. */
export function captureEvent(
  event: string,
  props?: Record<string, unknown>,
): void {
  if (!analyticsEnabled) return
  posthog.capture(event, props)
}

/**
 * Hook reativo para uma feature flag do PostHog. Retorna `false` quando o
 * analytics está desligado — degrada com segurança.
 */
export function useFeatureFlag(flag: string): boolean {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    if (!analyticsEnabled) return
    setEnabled(Boolean(posthog.isFeatureEnabled(flag)))
    const unsub = posthog.onFeatureFlags(() => {
      setEnabled(Boolean(posthog.isFeatureEnabled(flag)))
    })
    return () => {
      if (typeof unsub === 'function') unsub()
    }
  }, [flag])
  return enabled
}
