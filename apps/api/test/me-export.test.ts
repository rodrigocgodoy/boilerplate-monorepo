import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildTestApp } from './helpers/build-app.js'

/**
 * Export de dados pessoais (LGPD/GDPR, #11). O guard de auth é DB-free; a
 * compilação dos dados (com banco) fica pro setup de banco de teste — ver
 * TESTING.md.
 */
let app: FastifyInstance

beforeAll(async () => {
  app = await buildTestApp()
})

afterAll(async () => {
  await app.close()
})

describe('GET /me/export', () => {
  it('responde 401 sem sessão', async () => {
    const res = await app.inject({ method: 'GET', url: '/me/export' })
    expect(res.statusCode).toBe(401)
  })
})
