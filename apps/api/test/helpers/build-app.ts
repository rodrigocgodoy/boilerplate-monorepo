import { randomUUID } from 'node:crypto'
import fastify, { type FastifyInstance } from 'fastify'
import { backendPlugin } from '@/plugin.js'

/**
 * Sobe a aplicação em memória (sem bind de porta) para testes de integração
 * via `app.inject`. Mesmo registro do servidor real, mas sem `listen()`.
 *
 * As opções do Fastify espelham as de `src/index.ts` de propósito: o
 * `requestIdHeader`/`genReqId` decide o `requestId` que aparece no corpo dos
 * erros (Problem Details) e no header `x-request-id`. Com o default do Fastify
 * (`req-1`, `req-2`…), o teste validaria um comportamento que não é o de
 * produção — o header de entrada nem seria honrado.
 */
export async function buildTestApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: false,
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
  })
  await app.register(backendPlugin)
  await app.ready()
  return app
}
