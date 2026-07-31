import { tp } from '@/utils/fastify.js'
import { problem } from '@/utils/send-problem.js'

export const betterAuthRoute = tp(async scope => {
  scope.route({
    schema: {
      hide: true,
    },
    method: ['GET', 'POST'],
    url: '/auth/*',
    async handler(request, reply) {
      try {
        // Construct request URL — respeita x-forwarded-proto pra Better Auth
        // saber que esta atras de proxy https (Railway termina SSL no edge).
        const proto =
          (request.headers['x-forwarded-proto'] as string | undefined) ||
          request.protocol ||
          'http'
        const url = new URL(request.url, `${proto}://${request.headers.host}`)

        // Convert Fastify headers to standard Headers object
        const headers = new Headers()
        for (const [key, value] of Object.entries(request.headers)) {
          if (value) headers.append(key, value.toString())
        }

        // Create Fetch API-compatible request
        const req = new Request(url.toString(), {
          method: request.method,
          headers,
          body: request.body ? JSON.stringify(request.body) : undefined,
        })

        // Process authentication request
        const response = await scope.services.auth.auth.handler(req)

        // Forward response to client
        reply.status(response.status)
        for (const [key, value] of response.headers.entries()) {
          reply.header(key, value)
        }
        reply.send(response.body ? await response.text() : null)
      } catch (error) {
        scope.log.error('Authentication Error:')
        scope.log.error(error)
        reply
          .status(500)
          .send(problem(request, 500, 'Internal authentication error'))
      }
    },
  })
})
