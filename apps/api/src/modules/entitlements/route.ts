import { getAuthSession } from '@/utils/auth.js'
import { tp } from '@/utils/fastify.js'
import { problem } from '@/utils/send-problem.js'
import {
  entitlementsErrorSchema,
  entitlementsResponseSchema,
  quotaSchema,
  trackBodySchema,
} from './schemas.js'

/**
 * Entitlements / limites por plano (#7). Expõe o uso da organização ativa e um
 * endpoint de metering (`track`) que consome uma métrica respeitando a quota do
 * plano (402 ao exceder). Ver UPGRADES.md → "Entitlements / limites por plano".
 */
export const entitlementsRoute = tp(async scope => {
  const { entitlements } = scope.services

  // GET /entitlements — resumo de uso da org ativa (limite/uso por métrica).
  scope.get(
    '/entitlements',
    {
      schema: {
        tags: ['Entitlements'],
        summary: 'Uso e limites do plano da organização ativa',
        response: {
          200: entitlementsResponseSchema,
          401: entitlementsErrorSchema,
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
      if (!session.activeOrganizationId) {
        // Sem org ativa não há escopo de uso — devolve vazio (não é erro).
        return reply.status(200).send({ period: monthKeyNow(), metrics: [] })
      }
      const usage = await entitlements.getUsage(session.activeOrganizationId)
      return reply.status(200).send(usage)
    },
  )

  // POST /entitlements/track — consome uma métrica medida (respeita a quota).
  scope.post(
    '/entitlements/track',
    {
      schema: {
        tags: ['Entitlements'],
        summary: 'Consome uma métrica medida (metering) respeitando a quota',
        body: trackBodySchema,
        response: {
          200: quotaSchema,
          401: entitlementsErrorSchema,
          400: entitlementsErrorSchema,
          402: entitlementsErrorSchema,
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
      if (!session.activeOrganizationId) {
        return reply
          .status(400)
          .send(problem(request, 400, request.t('subscription:noActiveOrg')))
      }
      const quota = await entitlements.consume(
        session.activeOrganizationId,
        request.body.metric,
        request.body.amount ?? 1,
      )
      if (!quota.allowed) {
        return reply
          .status(402)
          .send(problem(request, 402, request.t('entitlements:quotaExceeded')))
      }
      return reply.status(200).send(quota)
    },
  )
})

/** Mesma chave mensal do service (evita expor um util só para isto). */
function monthKeyNow(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}
