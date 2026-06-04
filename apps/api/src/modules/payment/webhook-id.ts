/**
 * jobIds estáveis para os webhooks → idempotência contra reentregas. Quando há
 * Redis, o BullMQ deduplica jobs com o mesmo id; sem id, gera um novo (sem
 * dedupe). Funções puras (sem I/O) — fáceis de testar.
 */

type WebhookBody = {
  event?: string
  data?: Record<string, unknown>
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Sanitiza para uma chave de job válida (sem ':', que o BullMQ usa internamente). */
function jobIdFrom(event: string | undefined, id: string): string | undefined {
  if (!event || !id) return undefined
  return `wh_${event}_${id}`.replace(/[^a-zA-Z0-9_-]/g, '-')
}

/**
 * jobId do webhook de assinatura. Usa o id do pagamento (cada ciclo tem o seu)
 * ou o id/externalId da assinatura.
 */
export function subscriptionWebhookJobId(
  body: WebhookBody,
): string | undefined {
  const data = body.data ?? {}
  const sub = (data.subscription ?? {}) as Record<string, unknown>
  const payment = (data.payment ?? {}) as Record<string, unknown>
  const id =
    asString(payment.id) || asString(sub.externalId) || asString(sub.id)
  return jobIdFrom(body.event, id)
}

/**
 * jobId do webhook de cobrança avulsa (`billing.*` / PIX). Extrai o id da
 * entidade da mesma forma que `PaymentService.handleBillingEvent` (pixQrCode →
 * billing → payment).
 */
export function billingWebhookJobId(body: WebhookBody): string | undefined {
  const data = (body.data ?? {}) as Record<
    string,
    Record<string, unknown> | undefined
  >
  const entity = data.pixQrCode ?? data.billing ?? data.payment ?? {}
  return jobIdFrom(body.event, asString(entity.id))
}
