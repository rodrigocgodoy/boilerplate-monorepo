import { z } from 'zod'
import { parseEnv } from './parse.js'

/**
 * Ambiente do **frontend**. Só variáveis `VITE_*` — as demais nem chegam aqui
 * (o Vite expõe apenas esse prefixo, e é bom que seja assim: `DATABASE_URL` num
 * bundle público é vazamento).
 *
 * Sem `node:*` e sem `dotenv`: este módulo entra no bundle do browser. Os
 * valores são substituídos em **build time** pelo `define` do Vite, então a
 * validação roda no boot do app e falha na hora — em vez de a tela quebrar mais
 * tarde, quando alguém finalmente chamar `getApiBaseUrl()`.
 */

export const clientEnvSchema = z.object({
  // Base da API. Sem ela o app não conversa com nada — é a única obrigatória.
  VITE_API_URL: z.url({
    error: 'precisa ser uma URL completa (ex.: http://localhost:3333)',
  }),
  // Observabilidade (Sentry) — vazio = desligado.
  VITE_SENTRY_DSN: z.string().default(''),
  VITE_SENTRY_ENVIRONMENT: z.string().default(''),
  // Release tracking do front. Precisa bater com a release usada no upload dos
  // source maps, senão o Sentry não consegue desminificar o stack trace.
  VITE_SENTRY_RELEASE: z.string().default(''),
  VITE_SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
  // Amostragem do Session Replay para sessões **sem** erro. 0 = desligado
  // (default): o replay do Sentry grava só quando há exceção, e o replay de
  // produto fica com o PostHog. Ver `observability.tsx`.
  VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE: z.coerce
    .number()
    .min(0)
    .max(1)
    .default(0),
  // Product analytics (PostHog) — vazio = desligado.
  VITE_POSTHOG_KEY: z.string().default(''),
  VITE_POSTHOG_HOST: z.url().default('https://us.i.posthog.com'),
})

export type ClientEnv = z.infer<typeof clientEnvSchema>

/**
 * O Vite substitui `process.env` por um objeto literal no bundle, então ler
 * campo a campo funciona tanto no browser quanto no Node (testes, SSR).
 * Passar `process.env` inteiro não funcionaria: a substituição é textual e só
 * acontece nos acessos que o Vite enxerga.
 */
const source = {
  VITE_API_URL: process.env.VITE_API_URL,
  VITE_SENTRY_DSN: process.env.VITE_SENTRY_DSN,
  VITE_SENTRY_ENVIRONMENT: process.env.VITE_SENTRY_ENVIRONMENT,
  VITE_SENTRY_TRACES_SAMPLE_RATE: process.env.VITE_SENTRY_TRACES_SAMPLE_RATE,
  VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE:
    process.env.VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE,
  VITE_POSTHOG_KEY: process.env.VITE_POSTHOG_KEY,
  VITE_POSTHOG_HOST: process.env.VITE_POSTHOG_HOST,
}

// Campo ausente vira `undefined` para o Zod aplicar o default; string vazia
// (`VITE_SENTRY_DSN=` no .env) também, senão `z.url()` reprovaria o vazio.
const normalized = Object.fromEntries(
  Object.entries(source).filter(
    ([, value]) => value !== undefined && value !== '',
  ),
)

export const env: ClientEnv = parseEnv(clientEnvSchema, normalized, {
  scope: 'app',
  hint: 'Confira as variáveis VITE_* no .env da raiz do monorepo (cp .env.example .env). Elas são lidas em build time — depois de mudar, reinicie o Vite.',
})
