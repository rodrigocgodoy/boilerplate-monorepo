import {
  PaymentError,
  PaymentNotConfiguredError,
} from '@/modules/payment/client.js'
import { env } from '@/utils/environment.js'

/**
 * Adapter ISOLADO para a API de assinaturas (v2) do AbacatePay.
 *
 * O SDK oficial 1.6.0 NÃO expõe assinaturas, então chamamos o endpoint cru.
 * Toda dependência do shape da v2 fica concentrada aqui — se a AbacatePay
 * mudar path/contrato, este é o único arquivo a ajustar.
 *
 * Ref.: https://docs.abacatepay.com/pages/subscriptions/create
 */
const BASE_URL = 'https://api.abacatepay.com/v1'

type AbacateEnvelope<T> =
  | { data: T; error: null }
  | { data: null; error: string }

async function post<T>(path: string, body: unknown): Promise<T> {
  if (!env.ABACATEPAY_API_KEY) {
    throw new PaymentNotConfiguredError()
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.ABACATEPAY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const json = (await res.json().catch(() => null)) as AbacateEnvelope<T> | null

  if (!res.ok || !json || json.error) {
    throw new PaymentError(
      json?.error ?? `AbacatePay respondeu HTTP ${res.status}`,
    )
  }

  return json.data as T
}

export type CreateSubscriptionInput = {
  /** Exatamente um item; o produto deve ter `cycle` definido na loja. */
  items: { id: string; quantity: number }[]
  customerId?: string
  /** Eco-back: usamos o id da assinatura local para casar no webhook. */
  externalId?: string
  completionUrl?: string
  returnUrl?: string
  /** Default do AbacatePay é ['CARD']. */
  methods?: ('PIX' | 'CARD')[]
}

export type AbacateSubscription = {
  id: string
  url?: string
  amount?: number
  status?: string
  customerId?: string
}

/** Cria uma assinatura recorrente e devolve a URL de checkout inicial. */
export function createSubscription(input: CreateSubscriptionInput) {
  return post<AbacateSubscription>('/subscriptions/create', input)
}

/** Cancela uma assinatura (efeito imediato, sem carência). */
export function cancelSubscription(id: string) {
  return post<AbacateSubscription>('/subscriptions/cancel', { id })
}
