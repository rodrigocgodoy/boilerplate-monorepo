import { getAuthSession } from '@/utils/auth.js'
import { tp } from '@/utils/fastify.js'
import { auditErrorSchema, auditListResponseSchema } from './schemas.js'

/**
 * Trilha de auditoria (#8). `GET /audit` devolve as ações sensíveis da
 * organização ativa (mais recentes primeiro). Qualquer membro autenticado da
 * org vê o trail; restrinja por role no front/aqui se o produto exigir.
 */
export const auditRoute = tp(async scope => {
  const { audit } = scope.services

  scope.get(
    '/audit',
    {
      schema: {
        tags: ['Audit'],
        summary: 'Trilha de auditoria da organização ativa',
        response: { 200: auditListResponseSchema, 401: auditErrorSchema },
      },
    },
    async (request, reply) => {
      const session = await getAuthSession(scope, request)
      if (!session) {
        return reply
          .status(401)
          .send({ error: request.t('payment:unauthorized') })
      }
      if (!session.activeOrganizationId) {
        return reply.status(200).send({ entries: [] })
      }
      const logs = await audit.list(session.activeOrganizationId)
      return reply.status(200).send({
        entries: logs.map(log => ({
          id: log.id,
          actorId: log.actorId,
          action: log.action,
          targetType: log.targetType,
          targetId: log.targetId,
          metadata: log.metadata ?? null,
          ip: log.ip,
          createdAt: log.createdAt.toISOString(),
        })),
      })
    },
  )
})
