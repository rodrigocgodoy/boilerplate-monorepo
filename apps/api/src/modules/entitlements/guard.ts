import type { FastifyReply, FastifyRequest } from 'fastify'
import { getAuthSession } from '@/utils/auth.js'

/**
 * Factory de preHandler que bloqueia uma ação quando a quota da métrica já foi
 * atingida (escopo: organização ativa). Building block para o dev aplicar em
 * rotas que criam recursos limitados (ex.: `requireQuota('seats')` antes de
 * adicionar um membro). Não consome a métrica — só checa.
 *
 * ```ts
 * scope.post('/projects', { preHandler: requireQuota('projects'), schema }, h)
 * ```
 *
 * Para métricas medidas (ex.: apiCalls), prefira `entitlements.consume(...)`
 * dentro do handler (incrementa e valida atômico) — ver `POST /entitlements/track`.
 */
export function requireQuota(metric: string) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const app = request.server
    const session = await getAuthSession(app, request)
    if (!session) {
      reply.status(401).send({ error: request.t('payment:unauthorized') })
      return
    }
    const orgId = session.activeOrganizationId
    if (!orgId) {
      reply.status(400).send({ error: request.t('subscription:noActiveOrg') })
      return
    }
    const quota = await app.services.entitlements.checkQuota(orgId, metric)
    if (!quota.allowed) {
      reply.status(402).send({ error: request.t('entitlements:quotaExceeded') })
    }
  }
}
