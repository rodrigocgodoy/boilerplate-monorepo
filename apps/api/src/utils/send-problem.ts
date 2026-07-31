import type { FastifyRequest } from 'fastify'
import { buildProblem, type Problem } from '@/utils/problem.js'

/**
 * Monta um Problem Details para respostas de erro **esperadas** — aquelas que a
 * rota declara no schema (401, 402, 403, 404, 503) e devolve com `reply.send`,
 * sem lançar exceção.
 *
 * O error handler global cobre o que é lançado; isto cobre o que é retornado.
 * Os dois precisam falar a mesma língua, senão o cliente continua com dois
 * formatos — que era exatamente o problema.
 *
 * ```ts
 * return reply.status(401).send(problem(request, 401, request.t('auth:unauthorized')))
 * ```
 */
export function problem(
  request: FastifyRequest,
  status: number,
  detail?: string,
): Problem {
  return buildProblem({
    status,
    detail,
    instance: request.url,
    requestId: String(request.id),
  })
}
