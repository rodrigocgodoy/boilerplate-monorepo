import { beforeEach, expect, it } from 'vitest'
import { ApiKeyService } from '@/modules/api-keys/service.js'
import { createOrg, createUser, describeDb, resetDb } from './helpers/db.js'

describeDb('ApiKeyService (integração)', () => {
  beforeEach(resetDb)

  it('create → verify → revoke', async () => {
    const user = await createUser()
    const org = await createOrg(user.id)
    const svc = new ApiKeyService()

    const { token, record } = await svc.create({
      organizationId: org.id,
      userId: user.id,
      name: 'CI',
    })
    const verified = await svc.verify(token)
    expect(verified?.organizationId).toBe(org.id)
    expect(verified?.userId).toBe(user.id)

    expect(await svc.revoke(org.id, record.id)).toBe(true)
    expect(await svc.verify(token)).toBeNull() // revogada
  })

  it('verify rejeita token desconhecido', async () => {
    const svc = new ApiKeyService()
    expect(await svc.verify('bk_inexistente1234567890')).toBeNull()
  })
})
