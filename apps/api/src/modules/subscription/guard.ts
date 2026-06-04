import type { FastifyReply, FastifyRequest } from 'fastify'
import { getAuthSession } from '@/utils/auth.js'
import { env } from '@/utils/environment.js'

/**
 * preHandler do Fastify que bloqueia uma feature por plano (escopo: organização
 * ativa).
 *
 * - Sempre exige usuário autenticado (401 caso contrário).
 * - `REQUIRE_ACTIVE_PLAN=false` → no-op: só a autenticação é exigida.
 * - `REQUIRE_ACTIVE_PLAN=true` e a org ativa sem plano ativo → 402.
 *
 * Esta é a fronteira de segurança real (o guard do front é só UX). Uso:
 *
 * ```ts
 * scope.get('/premium', { preHandler: requireActivePlan, schema }, handler)
 * ```
 */
export async function requireActivePlan(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const app = request.server

  const session = await getAuthSession(app, request)
  if (!session) {
    reply.status(401).send({ error: request.t('payment:unauthorized') })
    return
  }

  // Gating desligado → libera (mantém apenas a checagem de autenticação).
  if (!env.REQUIRE_ACTIVE_PLAN) return

  const orgId = session.activeOrganizationId
  const isActive = orgId
    ? (await app.services.subscription.getActive(orgId, 'ORGANIZATION'))
        .isActive
    : false
  if (!isActive) {
    reply.status(402).send({ error: request.t('subscription:planRequired') })
  }
}
