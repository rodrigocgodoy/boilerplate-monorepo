import fs from 'node:fs'
import cookie from '@fastify/cookie'
import { fastifyCors } from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import FastifySensible from '@fastify/sensible'
import fastifySwagger from '@fastify/swagger'
import { prisma } from '@repo/database'
import fastifyScalar from '@scalar/fastify-api-reference'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import { routesPlugin } from '@/routes.js'
import { servicePlugin } from '@/services.js'
import { env } from '@/utils/environment.js'
import { tp } from '@/utils/fastify.js'

export const backendPlugin = tp(async app => {
  // Validator/serializer do Zod
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  if (env.ENV === 'development') {
    await app.register(fastifySwagger, {
      mode: 'dynamic',
      openapi: {
        openapi: '3.1.0',
        info: {
          title: 'Boilerplate API',
          description: 'API do boilerplate',
          version: '1.0.0',
        },
        components: {
          securitySchemes: {
            Bearer: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
      },
      transform: jsonSchemaTransform,
      refResolver: {
        buildLocalReference(json, _, __, i) {
          return String(json.$id || json.$title || json.name || `def-${i}`)
        },
      },
    })

    await app.register(fastifyScalar, {
      routePrefix: '/reference',
      configuration: {
        url: '/openapi.yaml',
      },
    })

    // Escreve o openapi.yaml ao subir (consumido pelo Kubb)
    app.addHook('onListen', async () => {
      await fs.promises.writeFile(
        'openapi.yaml',
        JSON.stringify(app.swagger(), null, 2),
      )
      app.log.debug('OpenAPI file created')
    })

    // Serve o spec
    app.get('/openapi.yaml', { schema: { hide: true } }, async () => {
      return app.swagger()
    })

    // CSP específico pra rota /reference (Scalar)
    app.addHook('onRequest', async (request, reply) => {
      if (request.url.startsWith('/reference')) {
        reply.header(
          'Content-Security-Policy',
          "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: https:; " +
            "font-src 'self' https: data:; " +
            "connect-src 'self'; " +
            "object-src 'none'; " +
            "media-src 'self'; " +
            "frame-src 'none';",
        )
      }
    })
  }

  // Cookie
  await app.register(cookie, {
    secret: env.COOKIE_SECRET,
    parseOptions: {},
  })

  // Rate limit (in-memory; veja UPGRADES.md para storage distribuído via Redis)
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  })

  // Helmet
  await app.register(helmet)

  // CORS
  app.register(fastifyCors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400,
  })

  // Http errors helpers
  await app.register(FastifySensible)

  // Services
  await app.register(servicePlugin)

  // Routes
  await app.register(routesPlugin)

  // Health check
  app.get('/health', { schema: { hide: true } }, async (_, reply) => {
    try {
      await prisma.$executeRaw`SELECT 1`
      return reply.status(200).send({
        status: 'healthy',
        services: { database: { status: 'healthy' } },
      })
    } catch (error) {
      app.log.error({ error }, 'Health check failed')
      return reply.status(503).send({
        status: 'unhealthy',
        services: { database: { status: 'unhealthy' } },
      })
    }
  })
})
