import type { FastifyReply, FastifyRequest } from 'fastify'
import { getAuthenticatedUserId } from '@/utils/auth.js'
import { env } from '@/utils/environment.js'

/**
 * preHandler do Fastify que bloqueia uma feature por plano.
 *
 * - Sempre exige usuário autenticado (401 caso contrário).
 * - `REQUIRE_ACTIVE_PLAN=false` → no-op: só a autenticação é exigida.
 * - `REQUIRE_ACTIVE_PLAN=true` e sem plano ativo → 402 (Payment Required).
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

  const userId = await getAuthenticatedUserId(app, request)
  if (!userId) {
    reply.status(401).send({ error: request.t('payment:unauthorized') })
    return
  }

  // Gating desligado → libera (mantém apenas a checagem de autenticação).
  if (!env.REQUIRE_ACTIVE_PLAN) return

  const { isActive } = await app.services.subscription.getActive(userId)
  if (!isActive) {
    reply.status(402).send({ error: request.t('subscription:planRequired') })
  }
}
