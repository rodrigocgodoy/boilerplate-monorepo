import { getAuthSession } from '@/utils/auth.js'
import { tp } from '@/utils/fastify.js'
import { problem } from '@/utils/send-problem.js'
import { isStorageEnabled } from './client.js'
import {
  presignAvatarBodySchema,
  presignAvatarResponseSchema,
  storageErrorSchema,
} from './schemas.js'

/**
 * Upload de arquivos via **URL pré-assinada** (#14). O servidor só assina o
 * POST; o arquivo vai **direto** do browser pro S3 (não passa pela API). Sem S3
 * configurado, responde 503. Ver UPGRADES.md → "MinIO / S3".
 */
export const storageRoute = tp(async scope => {
  const { storage } = scope.services

  // POST /uploads/avatar — gera o POST pré-assinado para o avatar do usuário.
  scope.post(
    '/uploads/avatar',
    {
      schema: {
        tags: ['Storage'],
        summary: 'Gera um upload pré-assinado para o avatar (S3)',
        body: presignAvatarBodySchema,
        response: {
          200: presignAvatarResponseSchema,
          400: storageErrorSchema,
          401: storageErrorSchema,
          503: storageErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (!isStorageEnabled) {
        return reply
          .status(503)
          .send(problem(request, 503, request.t('storage:notConfigured')))
      }
      const session = await getAuthSession(scope, request)
      if (!session) {
        return reply
          .status(401)
          .send(problem(request, 401, request.t('payment:unauthorized')))
      }
      if (!storage.isAllowedAvatarType(request.body.contentType)) {
        return reply
          .status(400)
          .send(problem(request, 400, request.t('storage:invalidType')))
      }
      const presign = await storage.presignAvatar(
        session.userId,
        request.body.contentType,
      )
      return reply.status(200).send(presign)
    },
  )
})
