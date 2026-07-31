import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { z } from 'zod'
import { parseEnv } from './parse.js'

/**
 * Ambiente do **servidor** (API e worker). Validado no import — se faltar
 * variável ou o tipo estiver errado, o processo não sobe.
 *
 * Separado de `./client` de propósito: o bundle do browser não pode nem
 * enxergar este schema, senão exigiria `DATABASE_URL` no front e arrastaria
 * `dotenv` (e `node:path`) para dentro do Vite.
 */

// Carrega o .env da raiz do monorepo. `dotenv` não sobrescreve o que já existe
// em `process.env`, então variável injetada pelo orquestrador continua vencendo.
config({
  path: path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../.env',
  ),
  // Em produção as variáveis vêm do orquestrador, não de um arquivo: o log
  // "injected env (0) from …/.env" só confundiria quem lê o boot do container.
  quiet: process.env.NODE_ENV === 'production',
})

/** Lista separada por vírgula → array de strings limpas. */
const csv = z
  .string()
  .default('')
  .transform(v =>
    v
      .split(',')
      .map(item => item.trim())
      .filter(Boolean),
  )

/** `"true" | "1" | "yes" | "on"` → boolean. */
const bool = (fallback: 'true' | 'false') =>
  z
    .string()
    .default(fallback)
    .transform(v => ['true', '1', 'yes', 'on'].includes(v.toLowerCase()))

export const serverEnvSchema = z.object({
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
  // Origens autorizadas no CORS, separadas por vírgula. Vazio = só o APP_URL.
  // Nunca use `*`: com `credentials: true` o browser recusaria, e refletir a
  // origem da requisição (o antigo `origin: true`) é ainda pior — libera
  // qualquer site a fazer requisição autenticada com o cookie do usuário.
  CORS_ORIGINS: csv,
  // Teto global do rate limit (req/min por IP) nas rotas da API. As rotas de
  // autenticação têm limites próprios (do Better Auth) e o webhook é isento —
  // ver `apps/api/src/plugin.ts`.
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  // RBAC de plataforma (plugin `admin` do Better Auth). Lista de e-mails que
  // viram super-admin (role de sistema `admin`): são promovidos no signup e
  // sincronizados no login. Separe por vírgula. Vazio = nenhum admin automático
  // (promova manualmente pelo painel/banco). Ver UPGRADES.md.
  ADMIN_EMAILS: csv.transform(list => list.map(e => e.toLowerCase())),
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
  REQUIRE_ACTIVE_PLAN: bool('false'),
  // Jobs em background (BullMQ) — opcional. Vazio = jobs rodam inline (dev),
  // sem fila. Preencha para ativar a fila/worker/agendador. Ver UPGRADES.md.
  REDIS_URL: z.string().default(''),
  // Sobe o worker de jobs junto da API (in-process). `false` = só enfileira;
  // rode `pnpm worker` num processo separado para processar. Ver UPGRADES.md.
  JOBS_IN_PROCESS: bool('true'),
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
  // Release tracking: liga cada erro à versão que o produziu. Injete o SHA do
  // commit no deploy (`SENTRY_RELEASE=$(git rev-parse HEAD)`). Vazio = todos os
  // erros caem numa release só, e some a informação de qual deploy quebrou.
  SENTRY_RELEASE: z.string().default(''),
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

export type ServerEnv = z.infer<typeof serverEnvSchema>

const parsed = parseEnv(serverEnvSchema, process.env, {
  scope: 'API/worker',
  hint: 'Confira o .env na raiz do monorepo — `cp .env.example .env` lista todas com explicação.',
})

/**
 * Dependências de terceiros leem `NODE_ENV`, não o nosso `ENV`.
 *
 * O caso concreto que motivou esta checagem: o rate limit do Better Auth é
 * ligado por `enabled: isProduction`, e `isProduction` vem de
 * `NODE_ENV === 'production'`. Subir com `ENV=production` e esquecer o
 * `NODE_ENV` deixa a proteção de força bruta no login **silenciosamente
 * desligada** — sem erro, sem log, sem sintoma até alguém abusar.
 *
 * Barato demais para virar incidente: falha no boot.
 */
if (parsed.ENV === 'production' && process.env.NODE_ENV !== 'production') {
  throw new Error(
    [
      '',
      'ENV=production mas NODE_ENV não é "production" ' +
        `(valor atual: ${process.env.NODE_ENV ?? 'não definido'}).`,
      '',
      '  Bibliotecas de terceiros decidem o modo por NODE_ENV. Em especial, o',
      '  rate limit do Better Auth (3 tentativas de login por 10s) só liga com',
      '  NODE_ENV=production — sem ele, o login fica sem proteção de força bruta.',
      '',
      '  Defina NODE_ENV=production no ambiente de produção.',
      '',
    ].join('\n'),
  )
}

export const env: ServerEnv = parsed
