import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { StorageService } from '@/modules/storage/service.js'
import { buildTestApp } from './helpers/build-app.js'

/**
 * Upload via URL pré-assinada (#14). No ambiente de teste o S3 não está
 * configurado → a rota responde 503 (gating). A validação de tipo é pura.
 */
describe('StorageService.isAllowedAvatarType', () => {
  const svc = new StorageService()
  it('aceita imagens suportadas e rejeita o resto', () => {
    expect(svc.isAllowedAvatarType('image/png')).toBe(true)
    expect(svc.isAllowedAvatarType('image/jpeg')).toBe(true)
    expect(svc.isAllowedAvatarType('image/svg+xml')).toBe(false)
    expect(svc.isAllowedAvatarType('application/pdf')).toBe(false)
  })
})

describe('POST /uploads/avatar (sem S3 configurado)', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    app = await buildTestApp()
  })
  afterAll(async () => {
    await app.close()
  })

  it('responde 503 quando o storage não está configurado', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/uploads/avatar',
      payload: { contentType: 'image/png' },
    })
    expect(res.statusCode).toBe(503)
  })
})
