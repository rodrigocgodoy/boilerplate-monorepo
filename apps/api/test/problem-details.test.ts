import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildTestApp } from './helpers/build-app.js'

/**
 * Problem Details (RFC 9457) — o contrato de erro da API.
 *
 * Antes existiam três formatos: `{error}` nos módulos, `{message,error,
 * statusCode}` nos 404 do Fastify e `{"error":"Bad Request"}` na validação, que
 * **descartava** o detalhe do Zod. Estes testes fixam a unificação; sem eles,
 * a próxima rota nova volta a inventar o seu próprio formato.
 */
let app: FastifyInstance

beforeAll(async () => {
  app = await buildTestApp()
})

afterAll(async () => {
  await app.close()
})

/** Campos que todo problema carrega, independente do status. */
const baseProblem = {
  type: expect.any(String),
  title: expect.any(String),
  status: expect.any(Number),
  instance: expect.any(String),
  requestId: expect.any(String),
}

describe('Problem Details', () => {
  it('erro de validação devolve o campo que falhou', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/entitlements/track',
      payload: { metric: 123 },
    })

    expect(res.statusCode).toBe(400)
    expect(res.headers['content-type']).toContain('application/problem+json')

    const body = res.json()
    expect(body).toMatchObject({
      ...baseProblem,
      type: 'urn:problem:validation-error',
      status: 400,
    })
    // O ponto do exercício: a API sabia qual campo falhou e agora diz.
    expect(body.errors).toEqual([
      { field: 'body.metric', message: expect.any(String) },
    ])
  })

  it('rota inexistente devolve problem, não o 404 cru do Fastify', async () => {
    const res = await app.inject({ method: 'GET', url: '/nao-existe' })

    expect(res.statusCode).toBe(404)
    expect(res.headers['content-type']).toContain('application/problem+json')
    expect(res.json()).toMatchObject({
      ...baseProblem,
      type: 'urn:problem:not-found',
      status: 404,
    })
  })

  it('erro esperado da rota (401) usa o mesmo formato', async () => {
    const res = await app.inject({ method: 'GET', url: '/me' })

    expect(res.statusCode).toBe(401)
    expect(res.headers['content-type']).toContain('application/problem+json')
    expect(res.json()).toMatchObject({
      ...baseProblem,
      type: 'urn:problem:unauthorized',
      status: 401,
    })
  })

  it('o requestId do corpo bate com o header x-request-id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { 'x-request-id': 'trace-abc-123' },
    })

    // É o que liga a resposta que o cliente recebeu ao log e ao Sentry.
    expect(res.json().requestId).toBe('trace-abc-123')
    expect(res.headers['x-request-id']).toBe('trace-abc-123')
  })

  it('resposta com corpo próprio não é remarcada pelo hook', async () => {
    // `/health` tem corpo próprio (`{status, services}`) e responde 200 com
    // banco ou 503 sem — por isso a asserção não fixa o status. O que importa é
    // que o hook decide pelo **formato do corpo**, não pelo status: marcar como
    // `problem+json` toda resposta de erro mentiria sobre as que não seguem o
    // contrato.
    const res = await app.inject({ method: 'GET', url: '/health' })

    expect(res.headers['content-type']).not.toContain('problem+json')
    expect(res.json()).not.toHaveProperty('type')
    expect(res.json()).toHaveProperty('services')
  })
})
