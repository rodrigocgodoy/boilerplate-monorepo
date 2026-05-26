import type { Plans, Subscriptions } from '@repo/database'
import {
  isPaymentEnabled,
  PaymentError,
  PaymentNotConfiguredError,
} from '@/modules/payment/client.js'
import { getAuthenticatedUserId } from '@/utils/auth.js'
import { env } from '@/utils/environment.js'
import { tp } from '@/utils/fastify.js'
import type { AppTFunction } from '@/utils/i18n.js'
import { requireActivePlan } from './guard.js'
import {
  cancelResponseSchema,
  plansResponseSchema,
  premiumResponseSchema,
  subscribeBodySchema,
  subscribeResponseSchema,
  subscriptionErrorSchema,
  subscriptionResponseSchema,
} from './schemas.js'

function mapPlan(plan: Plans) {
  return {
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    description: plan.description,
    priceCents: plan.priceCents,
    currency: plan.currency,
    interval: plan.interval,
    trialDays: plan.trialDays,
    features: plan.features ?? null,
  }
}

function mapSubscription(sub: Subscriptions & { plan: Plans }) {
  return {
    id: sub.id,
    status: sub.status as never,
    plan: mapPlan(sub.plan),
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
  }
}

/**
 * Rotas de assinatura (planos, plano ativo, assinar, cancelar). Leituras
 * (`GET /plans`, `GET /subscription`) funcionam sempre; as que tocam a v2 do
 * AbacatePay exigem a API key configurada.
 */
export const subscriptionRoute = tp(async scope => {
  const { subscription } = scope.services

  // GET /plans — catálogo de planos.
  scope.get(
    '/plans',
    {
      schema: {
        tags: ['Subscription'],
        summary: 'Lista os planos disponíveis',
        response: { 200: plansResponseSchema, 401: subscriptionErrorSchema },
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(scope, request)
      if (!userId) {
        return reply
          .status(401)
          .send({ error: request.t('payment:unauthorized') })
      }
      const plans = await subscription.listPlans()
      return reply.status(200).send({ plans: plans.map(mapPlan) })
    },
  )

  // GET /subscription — assinatura atual do usuário + se está ativa.
  scope.get(
    '/subscription',
    {
      schema: {
        tags: ['Subscription'],
        summary: 'Retorna a assinatura atual do usuário',
        response: {
          200: subscriptionResponseSchema,
          401: subscriptionErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = await getAuthenticatedUserId(scope, request)
      if (!userId) {
        return reply
          .status(401)
          .send({ error: request.t('payment:unauthorized') })
      }
      const { subscription: sub, isActive } =
        await subscription.getActive(userId)
      return reply.status(200).send({
        subscription: sub
          ? mapSubscription(sub as Subscriptions & { plan: Plans })
          : null,
        isActive,
        gatingEnabled: env.REQUIRE_ACTIVE_PLAN,
      })
    },
  )

  // POST /subscription — assina um plano (retorna URL de checkout).
  scope.post(
    '/subscription',
    {
      schema: {
        tags: ['Subscription'],
        summary: 'Assina um plano',
        body: subscribeBodySchema,
        response: {
          200: subscribeResponseSchema,
          401: subscriptionErrorSchema,
          404: subscriptionErrorSchema,
          500: subscriptionErrorSchema,
          502: subscriptionErrorSchema,
          503: subscriptionErrorSchema,
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
        const result = await subscription.subscribe(
          userId,
          request.body.planSlug,
        )
        return reply.status(200).send(result)
      } catch (error) {
        const { status, body } = subscriptionErrorReply(error, request.t)
        return reply.status(status).send(body)
      }
    },
  )

  // POST /subscription/cancel — cancela a assinatura ativa.
  scope.post(
    '/subscription/cancel',
    {
      schema: {
        tags: ['Subscription'],
        summary: 'Cancela a assinatura ativa',
        response: {
          200: cancelResponseSchema,
          401: subscriptionErrorSchema,
          404: subscriptionErrorSchema,
          500: subscriptionErrorSchema,
          502: subscriptionErrorSchema,
          503: subscriptionErrorSchema,
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
        const cancelled = await subscription.cancel(userId)
        return reply.status(200).send({ cancelled })
      } catch (error) {
        const { status, body } = subscriptionErrorReply(error, request.t)
        return reply.status(status).send(body)
      }
    },
  )

  // GET /premium — feature de exemplo protegida por plano. O guard
  // `requireActivePlan` roda antes: 401 sem login, 402 sem plano ativo (quando
  // REQUIRE_ACTIVE_PLAN=true); caso contrário libera.
  scope.get(
    '/premium',
    {
      preHandler: requireActivePlan,
      schema: {
        tags: ['Subscription'],
        summary: 'Feature de exemplo que exige plano ativo',
        response: {
          200: premiumResponseSchema,
          401: subscriptionErrorSchema,
          402: subscriptionErrorSchema,
        },
      },
    },
    async (request, reply) => {
      return reply
        .status(200)
        .send({ message: request.t('subscription:premiumUnlocked') })
    },
  )
})

/** Mapeia erros de assinatura para `{ status, body }`. */
function subscriptionErrorReply(
  error: unknown,
  t: AppTFunction,
): { status: 404 | 500 | 502 | 503; body: { error: string } } {
  if (error instanceof PaymentNotConfiguredError) {
    return { status: 503, body: { error: t('payment:notConfigured') } }
  }
  if (error instanceof PaymentError) {
    if (error.message === 'plan_not_found') {
      return { status: 404, body: { error: t('subscription:planNotFound') } }
    }
    if (error.message === 'plan_not_linked') {
      return { status: 503, body: { error: t('subscription:planNotLinked') } }
    }
    return { status: 502, body: { error: t('subscription:subscribeFailed') } }
  }
  return { status: 500, body: { error: t('subscription:subscribeFailed') } }
}
