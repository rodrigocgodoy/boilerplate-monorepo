import type { FastifyRequest } from 'fastify'

/** Extrai IP e User-Agent de um request Fastify para a trilha de auditoria. */
export function requestMeta(request: FastifyRequest): {
  ip: string | null
  userAgent: string | null
} {
  const xff = request.headers['x-forwarded-for']
  return {
    ip: (Array.isArray(xff) ? xff[0] : xff) ?? request.ip ?? null,
    userAgent: (request.headers['user-agent'] as string | undefined) ?? null,
  }
}
