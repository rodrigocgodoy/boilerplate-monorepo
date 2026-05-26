import { createHmac, timingSafeEqual } from 'node:crypto'
import AbacatePay from 'abacatepay-nodejs-sdk'
import { env } from '@/utils/environment.js'

/**
 * Chave pública padrão do AbacatePay para validar webhooks (HMAC-SHA256).
 * É fixa e documentada; sobrescreva via ABACATEPAY_WEBHOOK_PUBLIC_KEY se a
 * AbacatePay rotacioná-la. Ref.: https://docs.abacatepay.com/pages/webhooks/security
 */
const DEFAULT_WEBHOOK_PUBLIC_KEY =
  't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9'

/**
 * Pagamentos só ficam ativos quando a API key do AbacatePay está presente.
 * As rotas continuam existindo (para o OpenAPI/Kubb gerarem os hooks), mas os
 * handlers retornam erro amigável quando isto é `false`. Ver UPGRADES.md.
 */
export const isPaymentEnabled = Boolean(env.ABACATEPAY_API_KEY)

let client: ReturnType<typeof AbacatePay> | null = null

/** Erro lançado quando se tenta usar pagamentos sem a API key configurada. */
export class PaymentNotConfiguredError extends Error {
  constructor() {
    super('AbacatePay API key is not configured')
    this.name = 'PaymentNotConfiguredError'
  }
}

/** Erro lançado quando o AbacatePay responde com `error`. */
export class PaymentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PaymentError'
  }
}

/**
 * Valida o segredo do webhook que chega como query param `?webhookSecret=...`.
 * Funciona como âncora de autenticidade (só você e o AbacatePay o conhecem).
 */
export function isWebhookSecretValid(provided: string | undefined): boolean {
  return (
    Boolean(env.ABACATEPAY_WEBHOOK_SECRET) &&
    provided === env.ABACATEPAY_WEBHOOK_SECRET
  )
}

/**
 * Valida o header `X-Webhook-Signature` (HMAC-SHA256 base64 do corpo RAW, com a
 * chave pública do AbacatePay). Garante integridade — o corpo não foi alterado.
 * Comparação em tempo constante (`timingSafeEqual`) contra timing attacks.
 */
export function isWebhookSignatureValid(
  rawBody: string | undefined,
  signature: string | undefined,
): boolean {
  if (!rawBody || !signature) return false

  const key = env.ABACATEPAY_WEBHOOK_PUBLIC_KEY || DEFAULT_WEBHOOK_PUBLIC_KEY
  const expected = createHmac('sha256', key)
    .update(Buffer.from(rawBody, 'utf8'))
    .digest('base64')

  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  // timingSafeEqual exige buffers do mesmo tamanho.
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Retorna o cliente do AbacatePay (instanciado sob demanda). Lança
 * `PaymentNotConfiguredError` se a API key não estiver definida.
 */
export function getAbacatePay() {
  if (!isPaymentEnabled) {
    throw new PaymentNotConfiguredError()
  }
  if (!client) {
    client = AbacatePay(env.ABACATEPAY_API_KEY)
  }
  return client
}
