import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NOTIFICATION_CATEGORIES } from '@/modules/notifications/service.js'
import { buildTestApp } from './helpers/build-app.js'

/**
 * Notificações in-app (#13). Guards de auth (DB-free) + categorias. O fluxo com
 * banco (notify/list/prefs) fica pro setup de banco de teste — ver TESTING.md.
 */
describe('notification categories', () => {
  it('expõe as categorias suportadas', () => {
    expect(NOTIFICATION_CATEGORIES).toContain('system')
    expect(NOTIFICATION_CATEGORIES).toContain('billing')
  })
})

describe('rotas de notifications', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    app = await buildTestApp()
  })
  afterAll(async () => {
    await app.close()
  })

  it('GET /notifications responde 401 sem sessão', async () => {
    const res = await app.inject({ method: 'GET', url: '/notifications' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /notifications/preferences responde 401 sem sessão', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/notifications/preferences',
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /notifications/test responde 401 sem sessão', async () => {
    const res = await app.inject({ method: 'POST', url: '/notifications/test' })
    expect(res.statusCode).toBe(401)
  })
})
