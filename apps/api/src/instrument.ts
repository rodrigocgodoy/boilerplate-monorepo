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

/** Chaves que nunca devem sair daqui, em qualquer profundidade do evento. */
const SENSITIVE_KEY =
  /pass(word)?|token|secret|cookie|authorization|api[-_]?key|otp|keyhash/i

/**
 * Remove valores sensíveis de qualquer objeto do evento, recursivamente.
 *
 * A redaction do Pino protege o **log**; esta protege o que vai para o
 * **Sentry** — destino diferente, de um terceiro, e normalmente com mais gente
 * com acesso. O `sendDefaultPii: false` já evita o óbvio (IP, cookies), mas não
 * cobre o que a aplicação anexa por conta própria, como o corpo de um webhook
 * em `extra`.
 */
function scrub(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(item => scrub(item, depth + 1))

  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : scrub(item, depth + 1)
  }
  return out
}

if (env.SENTRY_DSN && !Sentry.getClient()) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT || env.ENV,
    // Release tracking: liga o erro à versão que o produziu e habilita
    // "regression"/"resolved in next release". Injete o SHA do commit no deploy
    // (ver DEPLOYING.md); vazio = tudo cai numa release só e se perde a noção
    // de qual deploy quebrou.
    release: env.SENTRY_RELEASE || undefined,
    // Performance/traces distribuídos (0 = só erros). Ver UPGRADES.md.
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    // Não enviar PII por padrão (IP, cookies, headers sensíveis).
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.headers) {
        event.request.headers = scrub(event.request.headers) as Record<
          string,
          string
        >
      }
      if (event.request) {
        // Cookies inteiros nunca ajudam a depurar e carregam a sessão.
        event.request.cookies = undefined
        // Query string pode carregar segredo: o webhook do AbacatePay recebe
        // `?webhookSecret=…`, e a URL inteira iria no evento.
        event.request.query_string = undefined
      }

      if (event.extra) {
        event.extra = scrub(event.extra) as Record<string, unknown>
      }
      if (event.contexts) {
        event.contexts = scrub(event.contexts) as typeof event.contexts
      }
      return event
    },
  })
}
