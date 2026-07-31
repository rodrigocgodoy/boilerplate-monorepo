import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { z } from 'zod'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Carrega o .env da raiz do monorepo
config({
  path: path.resolve(__dirname, '../../../../.env'),
})

const envSchema = z.object({
  ENV: z
    .enum(['development', 'production', 'test', 'staging'])
    .default('development'),
  API_LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
  COOKIE_SECRET: z.string(),
  BETTER_AUTH_SECRET: z.string(),
  BETTER_AUTH_URL: z.string(),
  APP_URL: z.string(),
  PORT: z.coerce.number().default(3333),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string(),
  // RBAC de plataforma (plugin `admin` do Better Auth). Lista de e-mails que
  // viram super-admin (role de sistema `admin`): são promovidos no signup e
  // sincronizados no login. Separe por vírgula. Vazio = nenhum admin automático
  // (promova manualmente pelo painel/banco). Ver UPGRADES.md.
  ADMIN_EMAILS: z
    .string()
    .default('')
    .transform(v =>
      v
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  // Google OAuth — opcionais (deixe vazio para usar só email/senha)
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  // E-mail transacional (Resend) — opcional. Vazio = e-mails são logados no
  // console (dev) em vez de enviados. Ver UPGRADES.md.
  RESEND_API_KEY: z.string().default(''),
  EMAIL_FROM: z.string().default('Boilerplate <onboarding@resend.dev>'),
  // AbacatePay — opcionais (deixe vazio para desabilitar pagamentos).
  // ABACATEPAY_WEBHOOK_SECRET é o valor que você define no painel e que chega
  // como query param `?webhookSecret=...` nas chamadas de webhook.
  ABACATEPAY_API_KEY: z.string().default(''),
  ABACATEPAY_WEBHOOK_SECRET: z.string().default(''),
  // Chave usada para validar o header `X-Webhook-Signature` (HMAC-SHA256).
  // Vazio = usa a chave pública padrão do AbacatePay embutida no código.
  ABACATEPAY_WEBHOOK_PUBLIC_KEY: z.string().default(''),
  // Liga o bloqueio de features por plano (guard `requireActivePlan` no server
  // e o layout `_paid` no front). `false` = nada é bloqueado (no-op).
  REQUIRE_ACTIVE_PLAN: z
    .string()
    .default('false')
    .transform(v => ['true', '1', 'yes', 'on'].includes(v.toLowerCase())),
  // Jobs em background (BullMQ) — opcional. Vazio = jobs rodam inline (dev),
  // sem fila. Preencha para ativar a fila/worker/agendador. Ver UPGRADES.md.
  REDIS_URL: z.string().default(''),
  // Sobe o worker de jobs junto da API (in-process). `false` = só enfileira;
  // rode `pnpm worker` num processo separado para processar. Ver UPGRADES.md.
  JOBS_IN_PROCESS: z
    .string()
    .default('true')
    .transform(v => ['true', '1', 'yes', 'on'].includes(v.toLowerCase())),
  // Teto de tempo do shutdown gracioso do worker: quanto ele espera o job em
  // andamento terminar antes de ser morto à força. Precisa ser maior que o job
  // mais lento que você tolera perder no meio. Ajuste ao seu orquestrador —
  // Kubernetes mata em 30s por padrão (`terminationGracePeriodSeconds`).
  JOBS_SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  // Observabilidade (Sentry) — opcional. Vazio = desligado (no-op): nada é
  // enviado. Preencha o DSN para capturar erros e traces. Ver UPGRADES.md.
  SENTRY_DSN: z.string().default(''),
  // Ambiente reportado ao Sentry; vazio = usa ENV.
  SENTRY_ENVIRONMENT: z.string().default(''),
  // Amostragem de traces (0..1). 0 = sem performance/tracing (só erros).
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
  // Upload de arquivos (S3/MinIO) — opcional. Sem `S3_BUCKET`+credenciais, as
  // rotas de upload respondem 503. `S3_ENDPOINT` vazio = AWS S3; preencha para
  // MinIO/R2. `S3_PUBLIC_URL` é a base pública dos objetos. Ver UPGRADES.md.
  S3_ENDPOINT: z.string().default(''),
  S3_ACCESS_KEY: z.string().default(''),
  S3_SECRET_KEY: z.string().default(''),
  S3_BUCKET: z.string().default(''),
  S3_REGION: z.string().default('auto'),
  S3_PUBLIC_URL: z.string().default(''),
  // Tamanho máximo de upload de avatar (bytes). Default 2 MB.
  AVATAR_MAX_BYTES: z.coerce.number().int().positive().default(2_097_152),
})

const _env = envSchema.safeParse(process.env)

if (!_env.success) {
  throw new Error(`Invalid environment variables: ${_env.error}`)
}

export const env = _env.data
