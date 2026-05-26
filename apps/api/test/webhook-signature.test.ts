import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  isWebhookSecretValid,
  isWebhookSignatureValid,
} from '@/modules/payment/client.js'

// Chave pública padrão do AbacatePay embutida no client (usada quando
// ABACATEPAY_WEBHOOK_PUBLIC_KEY não está setada — caso do env de teste).
const PUBLIC_KEY =
  't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9'

const body = JSON.stringify({ event: 'subscription.completed', data: {} })
const sign = (raw: string) =>
  createHmac('sha256', PUBLIC_KEY)
    .update(Buffer.from(raw, 'utf8'))
    .digest('base64')

describe('isWebhookSignatureValid', () => {
  it('aceita uma assinatura válida', () => {
    expect(isWebhookSignatureValid(body, sign(body))).toBe(true)
  })

  it('rejeita assinatura incorreta', () => {
    expect(isWebhookSignatureValid(body, 'assinatura-errada')).toBe(false)
  })

  it('rejeita corpo adulterado (integridade)', () => {
    expect(isWebhookSignatureValid(`${body} `, sign(body))).toBe(false)
  })

  it('rejeita quando falta assinatura ou corpo', () => {
    expect(isWebhookSignatureValid(body, undefined)).toBe(false)
    expect(isWebhookSignatureValid(undefined, sign(body))).toBe(false)
  })
})

describe('isWebhookSecretValid', () => {
  it('rejeita quando o segredo não está configurado (env de teste)', () => {
    expect(isWebhookSecretValid('qualquer-coisa')).toBe(false)
  })
})
