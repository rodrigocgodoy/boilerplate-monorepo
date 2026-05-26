import { tp } from '@/utils/fastify.js'
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
        return reply.status(401).send({ error: request.t('auth:unauthorized') })
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
})
