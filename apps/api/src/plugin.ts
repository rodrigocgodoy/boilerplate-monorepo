import fs from 'node:fs'
import cookie from '@fastify/cookie'
import { fastifyCors } from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import FastifySensible from '@fastify/sensible'
import fastifySwagger from '@fastify/swagger'
import { prisma } from '@repo/database'
import { defaultLocale, type Locale } from '@repo/i18n'
import fastifyScalar from '@scalar/fastify-api-reference'
import * as Sentry from '@sentry/node'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import { jobs } from '@/jobs/index.js'
import { registerQueueBoard } from '@/modules/queues/board.js'
import { routesPlugin } from '@/routes.js'
import { servicePlugin } from '@/services.js'
import { env } from '@/utils/environment.js'
import { registerErrorHandler } from '@/utils/error-handler.js'
import { tp } from '@/utils/fastify.js'
import { type AppTFunction, getT, resolveLanguage } from '@/utils/i18n.js'
import { rateLimitRedis } from '@/utils/rate-limit.js'

declare module 'fastify' {
  interface FastifyRequest {
    /** Idioma resolvido a partir do header Accept-Language */
    lang: Locale
    /** Função de tradução fixada no idioma da request */
    t: AppTFunction
    /** Corpo cru da requisição (string), usado na validação HMAC do webhook */
    rawBody?: string
  }
}

export const backendPlugin = tp(async app => {
  // Validator/serializer do Zod
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // Observabilidade: o Sentry captura os erros via hook `onError` (não altera o
  // formato das respostas). Só ativa com SENTRY_DSN — o init está em
  // instrument.ts (importado no 1º import de index.ts). Ver UPGRADES.md.
  if (env.SENTRY_DSN) {
    Sentry.setupFastifyErrorHandler(app)
  }

  // Mantém o parse JSON padrão, mas preserva o corpo cru em request.rawBody
  // (necessário para validar a assinatura HMAC do webhook sobre os bytes
  // exatos recebidos — re-serializar mudaria a string e quebraria o HMAC).
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (request, body: string, done) => {
      request.rawBody = body
      if (!body) {
        done(null, undefined)
        return
      }
      try {
        done(null, JSON.parse(body))
      } catch (err) {
        ;(err as { statusCode?: number }).statusCode = 400
        done(err as Error, undefined)
      }
    },
  )

  // i18n: resolve o idioma por request (Accept-Language) e expõe request.t.
  // Defaults são sobrescritos no onRequest abaixo, a cada request.
  app.decorateRequest('lang', defaultLocale)
  app.decorateRequest('t', getT(defaultLocale))
  app.addHook('onRequest', async (request, reply) => {
    const lang = resolveLanguage(request.headers['accept-language'])
    request.lang = lang
    request.t = getT(lang)
    reply.header('Content-Language', lang)
    // Expõe o requestId ao cliente (correlação com logs/Sentry). Já presente em
    // todo log da request como `reqId`.
    reply.header('x-request-id', String(request.id))
  })

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

    // Dev-only: dispara um erro para validar a captura no Sentry.
    app.get('/debug/sentry', { schema: { hide: true } }, async () => {
      throw new Error('Sentry debug error (rota de teste)')
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

  // ── Rate limit ────────────────────────────────────────────────────────────
  // Teto global por IP. As rotas com perfil diferente sobrescrevem via
  // `config.rateLimit` na própria definição (ver `rate-limit.ts`):
  //   • `/auth/*` — o Better Auth já aplica limites próprios e bem mais
  //     restritos (3 tentativas de login por 10s), então aqui só existe o teto.
  //   • webhook — folgado: 429 num pico de reentrega faz o gateway desistir de
  //     eventos de pagamento, que é pior do que o abuso que o limite evitaria.
  //   • export LGPD — apertado: cada chamada varre várias tabelas.
  //
  // Com Redis, o contador é compartilhado entre réplicas. Em memória (default),
  // cada instância conta sozinha: com N réplicas o limite efetivo vira N× e
  // zera a cada deploy — aceitável em dev, frágil como defesa em produção.
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    ...(rateLimitRedis ? { redis: rateLimitRedis } : {}),
  })

  // Helmet
  await app.register(helmet)

  // ── CORS ──────────────────────────────────────────────────────────────────
  // Lista explícita, vinda do env validado. Antes era `origin: true`, que
  // **reflete a origem da requisição** — combinado com `credentials: true`,
  // isso autoriza qualquer site a chamar a API com o cookie de sessão do
  // usuário logado. É pior que `*`, porque o browser bloqueia `*` com
  // credenciais, mas aceita a origem refletida.
  const allowedOrigins =
    env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : [env.APP_URL]

  app.register(fastifyCors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400,
  })
  app.log.info(`[cors] origens autorizadas: ${allowedOrigins.join(', ')}`)

  // Http errors helpers
  await app.register(FastifySensible)

  // Error handler global: todo erro lançado (validação Zod, 404, 429, 5xx) sai
  // como Problem Details (RFC 9457). Ver `utils/problem.ts`.
  registerErrorHandler(app)

  // Services
  await app.register(servicePlugin)

  // Jobs em background: sobe o worker in-process (default) e agenda os jobs
  // periódicos. Sem REDIS_URL é no-op (jobs rodam inline). Para escalar com um
  // worker dedicado, rode `pnpm worker` com JOBS_IN_PROCESS=false aqui.
  if (env.JOBS_IN_PROCESS) {
    await jobs.start(app.log)
    app.addHook('onClose', async () => {
      await jobs.stop()
    })
  }

  // Bull Board (inspeção das filas) em /admin/queues, guardado pela role de
  // plataforma. No-op sem REDIS_URL. Registrado antes das rotas por servir a
  // própria árvore de assets, fora do OpenAPI/Kubb.
  await registerQueueBoard(app)

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
