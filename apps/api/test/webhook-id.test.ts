import { describe, expect, it } from 'vitest'
import {
  billingWebhookJobId,
  subscriptionWebhookJobId,
} from '@/modules/payment/webhook-id.js'

/**
 * jobIds estáveis dão idempotência contra reentregas do webhook (o BullMQ
 * deduplica jobs com o mesmo id). Funções puras — sem fila nem banco.
 */
describe('subscriptionWebhookJobId', () => {
  it('usa o id do pagamento quando presente (cada ciclo tem o seu)', () => {
    const id = subscriptionWebhookJobId({
      event: 'subscription.renewed',
      data: { payment: { id: 'pay_123' }, subscription: { id: 'subs_9' } },
    })
    expect(id).toBe('wh_subscription-renewed_pay_123')
  })

  it('cai pra externalId/id da assinatura sem pagamento', () => {
    expect(
      subscriptionWebhookJobId({
        event: 'subscription.completed',
        data: { subscription: { externalId: 'subs_ext' } },
      }),
    ).toBe('wh_subscription-completed_subs_ext')
  })

  it('é estável (mesmo input → mesmo id)', () => {
    const body = {
      event: 'subscription.cancelled',
      data: { subscription: { id: 'subs_1' } },
    }
    expect(subscriptionWebhookJobId(body)).toBe(subscriptionWebhookJobId(body))
  })

  it('retorna undefined sem evento ou sem id (não deduplica)', () => {
    expect(
      subscriptionWebhookJobId({ data: { subscription: { id: 'x' } } }),
    ).toBeUndefined()
    expect(
      subscriptionWebhookJobId({ event: 'subscription.renewed', data: {} }),
    ).toBeUndefined()
  })
})

describe('billingWebhookJobId', () => {
  it('extrai o id do pixQrCode/billing/payment (nessa ordem)', () => {
    expect(
      billingWebhookJobId({
        event: 'billing.paid',
        data: { pixQrCode: { id: 'pix_1' }, billing: { id: 'bill_1' } },
      }),
    ).toBe('wh_billing-paid_pix_1')

    expect(
      billingWebhookJobId({
        event: 'billing.paid',
        data: { billing: { id: 'bill_1' } },
      }),
    ).toBe('wh_billing-paid_bill_1')
  })

  it('sanitiza caracteres que o BullMQ usa nas chaves (ex.: ":")', () => {
    const id = billingWebhookJobId({
      event: 'billing.paid',
      data: { billing: { id: 'a:b/c' } },
    })
    expect(id).toBe('wh_billing-paid_a-b-c')
    expect(id).not.toContain(':')
  })

  it('retorna undefined sem id', () => {
    expect(
      billingWebhookJobId({ event: 'billing.paid', data: {} }),
    ).toBeUndefined()
  })
})
