import fastify, { type FastifyInstance } from 'fastify'
import { backendPlugin } from '@/plugin.js'

/**
 * Sobe a aplicação em memória (sem bind de porta) para testes de integração
 * via `app.inject`. Mesmo registro do servidor real, mas sem `listen()`.
 */
export async function buildTestApp(): Promise<FastifyInstance> {
  const app = fastify({ logger: false })
  await app.register(backendPlugin)
  await app.ready()
  return app
}
