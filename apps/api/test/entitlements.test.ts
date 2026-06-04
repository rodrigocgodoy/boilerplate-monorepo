import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  canUseFeature,
  evaluateQuota,
  numericLimit,
  toFeatures,
} from '@/modules/entitlements/quota.js'
import { buildTestApp } from './helpers/build-app.js'

/**
 * Núcleo puro dos entitlements (sem banco): limites vs uso, parsing de features
 * e feature flags. As partes com banco (contadores, consume) ficam pro setup de
 * banco de teste — ver TESTING.md.
 */
describe('evaluateQuota', () => {
  it('limite definido: calcula remaining e allowed', () => {
    expect(evaluateQuota(5, 3, 'seats')).toEqual({
      metric: 'seats',
      limit: 5,
      used: 3,
      remaining: 2,
      unlimited: false,
      allowed: true,
    })
  })

  it('no limite: allowed=false e remaining=0', () => {
    const q = evaluateQuota(5, 5)
    expect(q.allowed).toBe(false)
    expect(q.remaining).toBe(0)
  })

  it('acima do limite: remaining nunca fica negativo', () => {
    expect(evaluateQuota(5, 9).remaining).toBe(0)
  })

  it('limite null ou negativo = ilimitado', () => {
    for (const limit of [null, -1]) {
      const q = evaluateQuota(limit, 1000)
      expect(q.unlimited).toBe(true)
      expect(q.allowed).toBe(true)
      expect(q.remaining).toBeNull()
    }
  })
})

describe('toFeatures / numericLimit', () => {
  it('mantém só números e booleanos do JSON', () => {
    expect(
      toFeatures({ seats: 5, sso: true, name: 'x', nested: { a: 1 } }),
    ).toEqual({ seats: 5, sso: true })
  })

  it('numericLimit retorna o número ou null quando ausente/não-numérico', () => {
    const f = toFeatures({ seats: 5, sso: true })
    expect(numericLimit(f, 'seats')).toBe(5)
    expect(numericLimit(f, 'sso')).toBeNull()
    expect(numericLimit(f, 'unknown')).toBeNull()
  })
})

describe('canUseFeature', () => {
  it('flag booleana respeita o valor', () => {
    expect(canUseFeature({ sso: true }, 'sso')).toBe(true)
    expect(canUseFeature({ sso: false }, 'sso')).toBe(false)
  })

  it('limite numérico: 0 desliga, ≠0 liga; ausência = liberado', () => {
    expect(canUseFeature({ seats: 0 }, 'seats')).toBe(false)
    expect(canUseFeature({ seats: 3 }, 'seats')).toBe(true)
    expect(canUseFeature({}, 'whatever')).toBe(true)
  })
})

describe('rota /entitlements', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    app = await buildTestApp()
  })
  afterAll(async () => {
    await app.close()
  })

  it('GET /entitlements responde 401 sem sessão', async () => {
    const res = await app.inject({ method: 'GET', url: '/entitlements' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /entitlements/track responde 401 sem sessão', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/entitlements/track',
      payload: { metric: 'apiCalls' },
    })
    expect(res.statusCode).toBe(401)
  })
})
