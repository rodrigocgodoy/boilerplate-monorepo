import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  generateApiKey,
  hashApiKey,
  hashesMatch,
  hasScope,
  isApiKeyFormat,
} from '@/modules/api-keys/keys.js'
import { buildTestApp } from './helpers/build-app.js'

/**
 * Núcleo puro das API keys (sem banco): geração, hash, formato e escopos. O
 * verify/lista (com banco) fica pro setup de banco de teste — ver TESTING.md.
 */
describe('api-key helpers', () => {
  it('gera token bk_, prefixo de 12 chars e hash coerente', () => {
    const { token, prefix, keyHash } = generateApiKey()
    expect(token.startsWith('bk_')).toBe(true)
    expect(prefix).toHaveLength(12)
    expect(token.startsWith(prefix)).toBe(true)
    expect(keyHash).toBe(hashApiKey(token))
    expect(isApiKeyFormat(token)).toBe(true)
  })

  it('tokens são únicos', () => {
    expect(generateApiKey().token).not.toBe(generateApiKey().token)
  })

  it('hashApiKey é determinístico e hashesMatch compara certo', () => {
    const a = hashApiKey('bk_abc')
    expect(a).toBe(hashApiKey('bk_abc'))
    expect(hashesMatch(a, hashApiKey('bk_abc'))).toBe(true)
    expect(hashesMatch(a, hashApiKey('bk_xyz'))).toBe(false)
  })

  it('isApiKeyFormat rejeita formatos inválidos', () => {
    expect(isApiKeyFormat('sk_123')).toBe(false)
    expect(isApiKeyFormat('bk_short')).toBe(false)
    expect(isApiKeyFormat('')).toBe(false)
  })

  it('hasScope: null/ausente libera, * libera, array restringe', () => {
    expect(hasScope(null, 'things:read')).toBe(true) // sem restrição
    expect(hasScope(['*'], 'things:read')).toBe(true)
    expect(hasScope(['things:read'], 'things:read')).toBe(true)
    expect(hasScope(['other'], 'things:read')).toBe(false)
    expect(hasScope(['other'], undefined)).toBe(true) // sem escopo exigido
  })
})

describe('rotas de api-keys', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    app = await buildTestApp()
  })
  afterAll(async () => {
    await app.close()
  })

  it('GET /api-keys responde 401 sem sessão', async () => {
    const res = await app.inject({ method: 'GET', url: '/api-keys' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /v1/ping responde 401 sem API key (curto-circuito antes do banco)', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/ping' })
    expect(res.statusCode).toBe(401)
  })
})
