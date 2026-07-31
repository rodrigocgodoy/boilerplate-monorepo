import { getAuthSession } from '@/utils/auth.js'
import { tp } from '@/utils/fastify.js'
import { rateLimitProfiles } from '@/utils/rate-limit.js'
import { problem } from '@/utils/send-problem.js'
import { meErrorSchema, meResponseSchema } from './schemas.js'

/**
 * Rota de exemplo (além de /auth). Demonstra o fluxo completo:
 * Zod schema → OpenAPI → Kubb gera o hook `useGetMe` consumido no app.
 */
export const meRoute = tp(async scope => {
  scope.get(
    '/me',
    {
      schema: {
        tags: ['Me'],
        operationId: 'getCurrentUser',
        summary: 'Retorna o usuário autenticado',
        response: {
          200: meResponseSchema,
          401: meErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const headers = new Headers()
      for (const [key, value] of Object.entries(request.headers)) {
        if (value) headers.append(key, Array.isArray(value) ? value[0] : value)
      }

      const session = await scope.services.auth.auth.api.getSession({ headers })

      if (!session?.user) {
        return reply
          .status(401)
          .send(problem(request, 401, request.t('auth:unauthorized')))
      }

      const { user } = session
      const createdAt =
        user.createdAt instanceof Date
          ? user.createdAt
          : new Date(user.createdAt)

      return reply.status(200).send({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: Boolean(user.emailVerified),
        image: user.image ?? null,
        createdAt: createdAt.toISOString(),
      })
    },
  )

  // GET /me/export — LGPD/GDPR (#11): baixa os dados pessoais do usuário em
  // JSON. `hide: true` (é um download, não entra no OpenAPI/Kubb); o front faz
  // fetch com credenciais e salva o arquivo.
  scope.get(
    '/me/export',
    {
      schema: { hide: true },
      // Cada chamada varre perfil, contas, sessões, orgs, API keys e audit log.
      // Sob o teto global (100/min) isso é um DoS barato contra o banco.
      config: { rateLimit: rateLimitProfiles.expensive },
    },
    async (request, reply) => {
      const session = await getAuthSession(scope, request)
      if (!session) {
        return reply
          .status(401)
          .send(problem(request, 401, request.t('auth:unauthorized')))
      }
      const data = await scope.services.me.exportUserData(session.userId)
      return reply
        .header('Content-Type', 'application/json; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="meus-dados.json"')
        .status(200)
        .send(JSON.stringify(data, null, 2))
    },
  )
})
