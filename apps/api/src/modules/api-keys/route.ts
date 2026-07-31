import { prisma } from '@repo/database'
import { z } from 'zod'
import { requestMeta } from '@/modules/audit/request.js'
import { getAuthSession } from '@/utils/auth.js'
import { tp } from '@/utils/fastify.js'
import { problem } from '@/utils/send-problem.js'
import { requireApiKey } from './guard.js'
import {
  apiKeyErrorSchema,
  apiKeyListResponseSchema,
  apiKeyPingResponseSchema,
  createApiKeyBodySchema,
  createApiKeyResponseSchema,
  revokeApiKeyResponseSchema,
} from './schemas.js'

/** Papel do usuário na org permite gerenciar chaves? (owner/admin). */
async function canManage(userId: string, orgId: string): Promise<boolean> {
  const member = await prisma.member.findFirst({
    where: { userId, organizationId: orgId },
    select: { role: true },
  })
  return member?.role === 'owner' || member?.role === 'admin'
}

function scopesOf(value: unknown): string[] | null {
  return Array.isArray(value) ? (value as string[]) : null
}

/**
 * API keys (#10): gestão por sessão (escopo: organização ativa) + um endpoint
 * de exemplo (`GET /v1/ping`) autenticado pela própria chave. As chaves são
 * escopadas por organização; criar/revogar exige owner/admin. Ver UPGRADES.md.
 */
export const apiKeysRoute = tp(async scope => {
  const { apiKeys, audit } = scope.services

  // GET /api-keys — lista as chaves ativas da org ativa.
  scope.get(
    '/api-keys',
    {
      schema: {
        tags: ['ApiKeys'],
        summary: 'Lista as API keys da organização ativa',
        response: { 200: apiKeyListResponseSchema, 401: apiKeyErrorSchema },
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
        return reply.status(200).send({ keys: [] })
      }
      const keys = await apiKeys.list(session.activeOrganizationId)
      return reply.status(200).send({
        keys: keys.map(k => ({
          id: k.id,
          name: k.name,
          prefix: k.prefix,
          scopes: scopesOf(k.scopes),
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          expiresAt: k.expiresAt?.toISOString() ?? null,
          createdAt: k.createdAt.toISOString(),
        })),
      })
    },
  )

  // POST /api-keys — cria uma chave (owner/admin). Retorna o token UMA vez.
  scope.post(
    '/api-keys',
    {
      schema: {
        tags: ['ApiKeys'],
        summary: 'Cria uma API key (owner/admin) — token exibido uma vez',
        body: createApiKeyBodySchema,
        response: {
          200: createApiKeyResponseSchema,
          401: apiKeyErrorSchema,
          403: apiKeyErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const session = await getAuthSession(scope, request)
      if (!session?.activeOrganizationId) {
        return reply
          .status(401)
          .send(problem(request, 401, request.t('payment:unauthorized')))
      }
      if (!(await canManage(session.userId, session.activeOrganizationId))) {
        return reply
          .status(403)
          .send(problem(request, 403, request.t('apiKeys:forbidden')))
      }
      const { token, record } = await apiKeys.create({
        organizationId: session.activeOrganizationId,
        userId: session.userId,
        name: request.body.name,
        scopes: request.body.scopes ?? null,
        expiresInDays: request.body.expiresInDays ?? null,
      })
      await audit.record({
        action: 'api_key.create',
        actorId: session.userId,
        organizationId: session.activeOrganizationId,
        targetType: 'api_key',
        targetId: record.id,
        metadata: { name: record.name, prefix: record.prefix },
        ...requestMeta(request),
      })
      return reply.status(200).send({
        id: record.id,
        name: record.name,
        key: token,
        prefix: record.prefix,
        createdAt: record.createdAt.toISOString(),
      })
    },
  )

  // DELETE /api-keys/:id — revoga uma chave (owner/admin).
  scope.delete(
    '/api-keys/:id',
    {
      schema: {
        tags: ['ApiKeys'],
        summary: 'Revoga uma API key (owner/admin)',
        params: z.object({ id: z.string() }),
        response: {
          200: revokeApiKeyResponseSchema,
          401: apiKeyErrorSchema,
          403: apiKeyErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const session = await getAuthSession(scope, request)
      if (!session?.activeOrganizationId) {
        return reply
          .status(401)
          .send(problem(request, 401, request.t('payment:unauthorized')))
      }
      if (!(await canManage(session.userId, session.activeOrganizationId))) {
        return reply
          .status(403)
          .send(problem(request, 403, request.t('apiKeys:forbidden')))
      }
      const revoked = await apiKeys.revoke(
        session.activeOrganizationId,
        request.params.id,
      )
      if (revoked) {
        await audit.record({
          action: 'api_key.revoke',
          actorId: session.userId,
          organizationId: session.activeOrganizationId,
          targetType: 'api_key',
          targetId: request.params.id,
          ...requestMeta(request),
        })
      }
      return reply.status(200).send({ revoked })
    },
  )

  // GET /v1/ping — exemplo de acesso PROGRAMÁTICO: autentica pela API key
  // (header `Authorization: Bearer bk_…` ou `x-api-key`), não pela sessão.
  scope.get(
    '/v1/ping',
    {
      preHandler: requireApiKey(),
      schema: {
        tags: ['ApiKeys'],
        summary: 'Exemplo autenticado por API key (Bearer)',
        security: [{ Bearer: [] }],
        response: { 200: apiKeyPingResponseSchema, 401: apiKeyErrorSchema },
      },
    },
    async (request, reply) => {
      return reply.status(200).send({
        organizationId: request.apiKey?.organizationId ?? '',
        message: 'pong',
      })
    },
  )
})
