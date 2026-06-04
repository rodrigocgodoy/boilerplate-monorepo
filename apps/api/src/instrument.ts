import * as Sentry from '@sentry/node'
import { env } from './utils/environment.js'

/**
 * Inicializa o Sentry ANTES de qualquer outro módulo da aplicação — assim a
 * auto-instrumentação (Fastify/Prisma/HTTP, via OpenTelemetry) consegue
 * envolver os módulos no carregamento. É importado como **primeira linha** de
 * `index.ts` e, em produção, via `node --import ./dist/instrument.js`.
 *
 * Sem `SENTRY_DSN` é **no-op** — nada é inicializado nem enviado. O guard
 * `getClient()` evita init duplicado (import + `--import`).
 */
if (env.SENTRY_DSN && !Sentry.getClient()) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT || env.ENV,
    // Performance/traces distribuídos (0 = só erros). Ver UPGRADES.md.
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    // Não enviar PII por padrão (IP, cookies, headers sensíveis).
    sendDefaultPii: false,
  })
}
