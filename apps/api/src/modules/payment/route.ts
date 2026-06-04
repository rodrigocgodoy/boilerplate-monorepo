import { getAuthenticatedUserId, getAuthSession } from '@/utils/auth.js'
import { tp } from '@/utils/fastify.js'
import type { AppTFunction } from '@/utils/i18n.js'
import {
  isPaymentEnabled,
  isWebhookSecretValid,
  isWebhookSignatureValid,
  PaymentError,
  PaymentNotConfiguredError,
} from './client.js'
import {
  checkoutResponseSchema,
  createCheckoutBodySchema,
  createPixBodySchema,
  type PaymentStatus,
  paymentErrorSchema,
  paymentListResponseSchema,
  paymentParamsSchema,
  paymentResponseSchema,
  pixResponseSchema,
  webhookBodySchema,
  webhookQuerySchema,
  webhookResponseSchema,
} from './schemas.js'

/**
 * Rotas de pagamento (AbacatePay). As rotas existem sempre — para o OpenAPI/Kubb
 * gerarem os hooks — mas retornam 503 quando a API key não está configurada
 * (`isPaymentEnabled === false`). Ver UPGRADES.md.
 */
export const paymentRoute = tp(async scope => {
  const { payment } = scope.services

  // POST /payments/pix — cria QR Code PIX (checkout transparente).
  scope.post(
    '/payments/pix',
    {
      schema: {
        tags: ['Payment'],
        summary: 'Cria uma cobrança PIX (QR Code)',
        body: createPixBodySchema,
        response: {
          200: pixResponseSchema,
          401: paymentErrorSchema,
          500: paymentErrorSchema,
          502: paymentErrorSchema,
          503: paymentErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (!isPaymentEnabled) {
        return reply
          .status(503)
          .send({ error: request.t('payment:notConfigured') })
      }
      const userId = await getAuthenticatedUserId(scope, request)
      if (!userId) {
        return reply
          .status(401)
          .send({ error: request.t('payment:unauthorized') })
      }
      try {
        const pix = await payment.createPixQrCode(request.body, userId)
        return reply.status(200).send(pix)
      } catch (error) {
        const { status, body } = paymentErrorReply(error, request.t)
        return reply.status(status).send(body)
      }
    },
  )

  // POST /payments/checkout — cria checkout hospedado (PIX + cartão).
  scope.post(
    '/payments/checkout',
    {
      schema: {
        tags: ['Payment'],
        summary: 'Cria um checkout (PIX + cartão)',
        body: createCheckoutBodySchema,
        response: {
          200: checkoutResponseSchema,
          401: paymentErrorSchema,
          500: paymentErrorSchema,
          502: paymentErrorSchema,
          503: paymentErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (!isPaymentEnabled) {
        return reply
          .status(503)
          .send({ error: request.t('payment:notConfigured') })
      }
      const userId = await getAuthenticatedUserId(scope, request)
      if (!userId) {
        return reply
          .status(401)
          .send({ error: request.t('payment:unauthorized') })
      }
      try {
        const checkout = await payment.createCheckout(request.body, userId)
        return reply.status(200).send(checkout)
      } catch (error) {
        const { status, body } = paymentErrorReply(error, request.t)
        return reply.status(status).send(body)
      }
    },
  )

  // GET /payments/:id — status de uma cobrança (reconsulta PIX pendente).
  scope.get(
    '/payments/:id',
    {
      schema: {
        tags: ['Payment'],
        summary: 'Retorna o status de uma cobrança',
        params: paymentParamsSchema,
        response: {
          200: paymentResponseSchema,
          401: paymentErrorSchema,
          404: paymentErrorSchema,
          500: paymentErrorSchema,
          502: paymentErrorSchema,
          503: paymentErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (!isPaymentEnabled) {
        return reply
          .status(503)
          .send({ error: request.t('payment:notConfigured') })
      }
      const userId = await getAuthenticatedUserId(scope, request)
      if (!userId) {
        return reply
          .status(401)
          .send({ error: request.t('payment:unauthorized') })
      }
      try {
        const record = await payment.getPayment(request.params.id, userId)
        if (!record) {
          return reply
            .status(404)
            .send({ error: request.t('payment:notFound') })
        }
        return reply.status(200).send({
          id: record.id,
          externalId: record.externalId,
          kind: record.kind,
          status: record.status as PaymentStatus,
          amount: record.amount,
          method: record.method,
          brCode: record.brCode,
          url: record.url,
        })
      } catch (error) {
        const { status, body } = paymentErrorReply(error, request.t)
        return reply.status(status).send(body)
      }
    },
  )

  // GET /payments — histórico de cobranças do usuário.
  scope.get(
    '/payments',
    {
      schema: {
        tags: ['Payment'],
        summary: 'Histórico de pagamentos (usuário + organização ativa)',
        response: {
          200: paymentListResponseSchema,
          401: paymentErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const session = await getAuthSession(scope, request)
      if (!session) {
        return reply
          .status(401)
          .send({ error: request.t('payment:unauthorized') })
      }
      const payments = await payment.listForUserAndOrg(
        session.userId,
        session.activeOrganizationId,
      )
      return reply.status(200).send({
        payments: payments.map(p => ({
          id: p.id,
          kind: p.kind,
          status: p.status as PaymentStatus,
          amount: p.amount,
          method: p.method,
          description: p.description,
          subscriptionId: p.subscriptionId,
          createdAt: p.createdAt.toISOString(),
        })),
      })
    },
  )

  // POST /payments/webhook — público; valida o segredo via query param e
  // despacha por tipo de evento. `hide: true` mantém fora do OpenAPI.
  scope.post(
    '/payments/webhook',
    {
      schema: {
        hide: true,
        querystring: webhookQuerySchema,
        body: webhookBodySchema,
        response: { 200: webhookResponseSchema, 401: paymentErrorSchema },
      },
    },
    async (request, reply) => {
      // Aceita se a assinatura HMAC for válida (integridade) OU o segredo da
      // query bater (autenticidade). Configure ao menos um (ver UPGRADES.md).
      const signature = request.headers['x-webhook-signature'] as
        | string
        | undefined
      const authenticated =
        isWebhookSignatureValid(request.rawBody, signature) ||
        isWebhookSecretValid(request.query.webhookSecret)
      if (!authenticated) {
        return reply
          .status(401)
          .send({ error: request.t('payment:invalidSignature') })
      }
      const event = request.body.event ?? ''
      if (event.startsWith('subscription.')) {
        await scope.services.subscription.handleWebhookEvent(request.body)
      } else {
        await payment.handleBillingEvent(request.body)
      }
      return reply.status(200).send({ received: true })
    },
  )
})

/** Mapeia um erro de pagamento para `{ status, body }` a ser enviado. */
function paymentErrorReply(
  error: unknown,
  t: AppTFunction,
): { status: 500 | 502 | 503; body: { error: string } } {
  if (error instanceof PaymentNotConfiguredError) {
    return { status: 503, body: { error: t('payment:notConfigured') } }
  }
  if (error instanceof PaymentError) {
    return { status: 502, body: { error: error.message } }
  }
  return { status: 500, body: { error: t('payment:createFailed') } }
}
