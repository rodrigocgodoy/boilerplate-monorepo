import { enqueue } from '@/jobs/index.js'
import { getAuthenticatedUserId, getAuthSession } from '@/utils/auth.js'
import { tp } from '@/utils/fastify.js'
import type { AppTFunction } from '@/utils/i18n.js'
import { rateLimitProfiles } from '@/utils/rate-limit.js'
import { problem } from '@/utils/send-problem.js'
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
import { billingWebhookJobId, subscriptionWebhookJobId } from './webhook-id.js'

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
          .send(problem(request, 503, request.t('payment:notConfigured')))
      }
      const userId = await getAuthenticatedUserId(scope, request)
      if (!userId) {
        return reply
          .status(401)
          .send(problem(request, 401, request.t('payment:unauthorized')))
      }
      try {
        const pix = await payment.createPixQrCode(request.body, userId)
        return reply.status(200).send(pix)
      } catch (error) {
        const { status, detail } = paymentErrorReply(error, request.t)
        return reply.status(status).send(problem(request, status, detail))
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
          .send(problem(request, 503, request.t('payment:notConfigured')))
      }
      const userId = await getAuthenticatedUserId(scope, request)
      if (!userId) {
        return reply
          .status(401)
          .send(problem(request, 401, request.t('payment:unauthorized')))
      }
      try {
        const checkout = await payment.createCheckout(request.body, userId)
        return reply.status(200).send(checkout)
      } catch (error) {
        const { status, detail } = paymentErrorReply(error, request.t)
        return reply.status(status).send(problem(request, status, detail))
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
          .send(problem(request, 503, request.t('payment:notConfigured')))
      }
      const userId = await getAuthenticatedUserId(scope, request)
      if (!userId) {
        return reply
          .status(401)
          .send(problem(request, 401, request.t('payment:unauthorized')))
      }
      try {
        const record = await payment.getPayment(request.params.id, userId)
        if (!record) {
          return reply
            .status(404)
            .send(problem(request, 404, request.t('payment:notFound')))
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
        const { status, detail } = paymentErrorReply(error, request.t)
        return reply.status(status).send(problem(request, status, detail))
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
          .send(problem(request, 401, request.t('payment:unauthorized')))
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
      // Quem chama aqui não é usuário, é o gateway. Um pico de reentregas
      // legítimas levando 429 faz eventos de cobrança serem descartados — bem
      // pior que o abuso que o teto global evitaria. A autenticidade vem do
      // HMAC / do segredo na query, não do rate limit.
      config: { rateLimit: rateLimitProfiles.webhook },
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
          .send(problem(request, 401, request.t('payment:invalidSignature')))
      }
      // Processa fora do request: com Redis vira job (retries/backoff); sem
      // Redis roda inline (igual antes). O jobId derivado do evento dá
      // idempotência contra reentregas do webhook.
      const event = request.body.event ?? ''
      if (event.startsWith('subscription.')) {
        await enqueue('subscription-webhook', request.body, {
          jobId: subscriptionWebhookJobId(request.body),
        })
      } else {
        // Cobrança avulsa (billing.* / PIX) — também pela fila.
        await enqueue('billing-webhook', request.body, {
          jobId: billingWebhookJobId(request.body),
        })
      }
      return reply.status(200).send({ received: true })
    },
  )
})

/** Mapeia um erro de pagamento para `{ status, body }` a ser enviado. */
function paymentErrorReply(
  error: unknown,
  t: AppTFunction,
): { status: 500 | 502 | 503; detail: string } {
  if (error instanceof PaymentNotConfiguredError) {
    return { status: 503, detail: t('payment:notConfigured') }
  }
  if (error instanceof PaymentError) {
    return { status: 502, detail: error.message }
  }
  return { status: 500, detail: t('payment:createFailed') }
}
