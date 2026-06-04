import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildTestApp } from './helpers/build-app.js'

/**
 * Plugin `admin` do Better Auth: os endpoints ficam sob `/auth/admin/*`,
 * servidos pelo handler wildcard. Sem sessão, qualquer ação de admin é negada
 * (401) antes de tocar o banco — o que valida que o plugin está montado e
 * guardado. A barreira por role (403) é coberta em testes autenticados (ver
 * TESTING.md → próximos passos com banco de teste).
 */
let app: FastifyInstance

beforeAll(async () => {
  app = await buildTestApp()
})

afterAll(async () => {
  await app.close()
})

describe('rotas de admin (plugin admin do Better Auth)', () => {
  it('GET /auth/admin/list-users responde 401 sem sessão', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/admin/list-users',
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /auth/admin/set-role responde 401 sem sessão', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/admin/set-role',
      payload: { userId: 'nope', role: 'admin' },
    })
    expect(res.statusCode).toBe(401)
  })
})
