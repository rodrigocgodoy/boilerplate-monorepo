import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildTestApp } from './helpers/build-app.js'

/**
 * Integração das rotas de pagamento via app.inject (sem banco). Cobre os guards
 * que rodam ANTES de qualquer acesso ao DB: config (503), validação Zod (400) e
 * autenticação do webhook (401).
 */
let app: FastifyInstance

beforeAll(async () => {
  app = await buildTestApp()
})

afterAll(async () => {
  await app.close()
})

describe('rotas de pagamento (sem ABACATEPAY_API_KEY)', () => {
  it('POST /payments/pix responde 503 quando pagamentos não estão configurados', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/payments/pix',
      payload: { amount: 1000, description: 'teste' },
    })
    expect(res.statusCode).toBe(503)
  })

  it('POST /payments/pix responde 400 quando o body é inválido (Zod: amount < 100)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/payments/pix',
      payload: { amount: 10, description: 'x' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /payments/webhook responde 401 sem assinatura nem segredo', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/payments/webhook',
      payload: { event: 'billing.paid', data: {} },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('rotas protegidas exigem autenticação', () => {
  it('GET /subscription responde 401 sem sessão', async () => {
    const res = await app.inject({ method: 'GET', url: '/subscription' })
    expect(res.statusCode).toBe(401)
  })
})
