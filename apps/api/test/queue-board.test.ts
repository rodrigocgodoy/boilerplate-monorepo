import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildTestApp } from './helpers/build-app.js'

/**
 * Guard do Bull Board (`/admin/queues`).
 *
 * Neste ambiente de teste não há `REDIS_URL`, então o painel **não é montado** —
 * e é justamente essa a primeira garantia que interessa: sem fila, a rota não
 * existe. O caso com Redis e sessão de admin exige a stack completa; o que não
 * pode acontecer em hipótese alguma é a rota responder algo útil para quem não
 * está autenticado, e isso vale nos dois modos.
 */
let app: FastifyInstance

beforeAll(async () => {
  app = await buildTestApp()
})

afterAll(async () => {
  await app.close()
})

describe('/admin/queues', () => {
  it('não expõe o painel sem sessão', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/queues' })

    // 404 tanto no modo sem Redis (rota inexistente) quanto no modo com Redis
    // (o guard responde 404 de propósito, para não confirmar que o painel
    // existe a quem não deveria alcançá-lo).
    expect(res.statusCode).toBe(404)
    expect(res.body).not.toMatch(/bull/i)
  })

  it('não expõe a API interna do painel sem sessão', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/queues/api/queues',
    })

    expect(res.statusCode).toBe(404)
  })
})
