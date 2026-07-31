import { prisma } from '@repo/database'
import type { FastifyInstance } from 'fastify'
import { jobs } from '@/jobs/index.js'
import { rateLimitRedis } from '@/utils/rate-limit.js'

/**
 * `/health` e `/ready` — duas perguntas diferentes, que orquestradores usam
 * para decisões diferentes.
 *
 * - **`/health` (liveness)**: "este processo está são?" Se responder mal, o
 *   orquestrador **reinicia** o container. Por isso ele não pode falhar por
 *   causa de dependência externa: se o Postgres cai, reiniciar a API não
 *   resolve nada — só troca uma indisponibilidade por um crash loop que atrasa
 *   a recuperação quando o banco voltar.
 * - **`/ready` (readiness)**: "posso receber tráfego agora?" Se responder mal,
 *   o balanceador **tira a instância do pool** sem matá-la. É aqui que as
 *   dependências entram: sem banco, esta instância não serve requisição útil,
 *   mas continua viva para voltar sozinha quando o banco voltar.
 *
 * Misturar os dois é o erro comum, e o sintoma é caro: uma queda de banco de 30
 * segundos vira uma frota inteira reiniciando em loop.
 */

type Check = { status: 'healthy' | 'unhealthy'; error?: string }

async function checkDatabase(): Promise<Check> {
  try {
    await prisma.$executeRaw`SELECT 1`
    return { status: 'healthy' }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'erro desconhecido',
    }
  }
}

/**
 * Redis é **opcional** no boilerplate: sem `REDIS_URL` os jobs rodam inline.
 * Nesse caso não há o que checar, e reportar "unhealthy" seria mentira.
 */
async function checkRedis(): Promise<Check | null> {
  if (!jobs.enabled || !rateLimitRedis) return null
  try {
    await rateLimitRedis.ping()
    return { status: 'healthy' }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'erro desconhecido',
    }
  }
}

export function registerHealthRoutes(app: FastifyInstance): void {
  // Liveness: o processo respondeu, logo está vivo. Deliberadamente sem I/O.
  app.get('/health', { schema: { hide: true } }, async (_request, reply) => {
    return reply
      .status(200)
      .send({ status: 'healthy', uptime: process.uptime() })
  })

  // Readiness: só reporta pronto se as dependências responderem.
  app.get('/ready', { schema: { hide: true } }, async (request, reply) => {
    const [database, redis] = await Promise.all([checkDatabase(), checkRedis()])

    const services = {
      database,
      ...(redis ? { redis } : {}),
    }
    const ready = Object.values(services).every(s => s.status === 'healthy')

    if (!ready) {
      request.log.warn({ services }, 'readiness falhou')
    }

    return reply
      .status(ready ? 200 : 503)
      .send({ status: ready ? 'ready' : 'not_ready', services })
  })
}
