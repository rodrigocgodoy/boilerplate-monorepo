import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildTestApp } from './helpers/build-app.js'

/**
 * Liveness (`/health`) e readiness (`/ready`).
 *
 * A distinção é a razão de existirem duas rotas: liveness faz o orquestrador
 * **reiniciar** o container; readiness só o **tira do balanceador**. Se
 * `/health` falhasse por causa do banco, uma queda de 30 segundos do Postgres
 * viraria uma frota inteira em crash loop — e reiniciar não traz banco de volta.
 *
 * Estes testes rodam **sem** Postgres (o `DATABASE_URL` do ambiente de teste é
 * falso), que é justamente o cenário onde a diferença aparece.
 */
let app: FastifyInstance

beforeAll(async () => {
  app = await buildTestApp()
})

afterAll(async () => {
  await app.close()
})

describe('/health (liveness)', () => {
  it('responde 200 mesmo sem banco', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      status: 'healthy',
      uptime: expect.any(Number),
    })
  })

  it('não consulta dependências (é liveness, não readiness)', async () => {
    // Se um dia alguém adicionar um `SELECT 1` aqui, a rota passa a falhar sem
    // banco — e o efeito colateral (reinício em loop) só aparece em produção.
    const res = await app.inject({ method: 'GET', url: '/health' })

    expect(res.json()).not.toHaveProperty('services')
  })
})

describe('/ready (readiness)', () => {
  it('o status HTTP concorda com o estado do banco', async () => {
    // A suíte roda nos dois modos (com e sem Postgres, via `pnpm test:db`), e
    // fixar o status aqui só produziria um teste que falha conforme o ambiente.
    // O que precisa valer sempre é a **coerência**: se o banco não responde, a
    // instância não pode se declarar pronta.
    const res = await app.inject({ method: 'GET', url: '/ready' })
    const body = res.json()

    expect(body.services.database.status).toMatch(/^(healthy|unhealthy)$/)

    if (body.services.database.status === 'healthy') {
      expect(res.statusCode).toBe(200)
      expect(body.status).toBe('ready')
    } else {
      expect(res.statusCode).toBe(503)
      expect(body.status).toBe('not_ready')
      // O motivo vai no corpo: sem ele, um 503 numa readiness probe é um
      // mistério para quem está de plantão.
      expect(body.services.database.error).toEqual(expect.any(String))
    }
  })

  it('não reporta Redis quando ele não está configurado', async () => {
    // Redis é opcional no boilerplate (sem ele os jobs rodam inline). Reportar
    // "unhealthy" para algo que ninguém pediu deixaria a instância fora do
    // balanceador para sempre.
    const res = await app.inject({ method: 'GET', url: '/ready' })

    expect(res.json().services).not.toHaveProperty('redis')
  })
})
