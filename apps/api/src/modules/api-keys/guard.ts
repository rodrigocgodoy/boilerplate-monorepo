import type { FastifyReply, FastifyRequest } from 'fastify'
import { problem } from '@/utils/send-problem.js'
import { hasScope } from './keys.js'
import type { VerifiedApiKey } from './service.js'

declare module 'fastify' {
  interface FastifyRequest {
    /** Contexto da API key autenticada (preenchido por `requireApiKey`). */
    apiKey?: VerifiedApiKey
  }
}

/** Extrai o token de `Authorization: Bearer …` ou do header `x-api-key`. */
function extractToken(request: FastifyRequest): string | undefined {
  const auth = request.headers.authorization
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim()
  const header = request.headers['x-api-key']
  return typeof header === 'string' ? header : undefined
}

/**
 * preHandler para **acesso programático**: exige uma API key válida (e,
 * opcionalmente, um escopo). Anexa `request.apiKey` com `{ organizationId,
 * userId, scopes }` para o handler escopar por organização.
 *
 * ```ts
 * scope.get('/v1/things', { preHandler: requireApiKey('things:read'), schema }, h)
 * ```
 */
export function requireApiKey(scope?: string) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const token = extractToken(request)
    if (!token) {
      reply
        .status(401)
        .send(problem(request, 401, request.t('apiKeys:missing')))
      return
    }
    const verified = await request.server.services.apiKeys.verify(token)
    if (!verified) {
      reply
        .status(401)
        .send(problem(request, 401, request.t('apiKeys:invalid')))
      return
    }
    if (!hasScope(verified.scopes, scope)) {
      reply
        .status(403)
        .send(problem(request, 403, request.t('apiKeys:forbidden')))
      return
    }
    request.apiKey = verified
  }
}
