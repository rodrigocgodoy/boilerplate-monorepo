import { beforeEach, expect, it } from 'vitest'
import { AuditService } from '@/modules/audit/service.js'
import { createOrg, createUser, describeDb, resetDb } from './helpers/db.js'

describeDb('AuditService (integração)', () => {
  beforeEach(resetDb)

  it('record grava e list retorna por organização (mais recentes primeiro)', async () => {
    const user = await createUser()
    const org = await createOrg(user.id)
    const svc = new AuditService()
    await svc.record({
      action: 'member.invite',
      actorId: user.id,
      organizationId: org.id,
      targetId: 'a@b.com',
    })
    await svc.record({
      action: 'member.remove',
      actorId: user.id,
      organizationId: org.id,
    })
    const logs = await svc.list(org.id)
    expect(logs).toHaveLength(2)
    expect(logs[0]?.action).toBe('member.remove') // ordem desc por createdAt
  })

  it('record é best-effort: não lança mesmo com dado inválido', async () => {
    const svc = new AuditService()
    await expect(
      svc.record({ action: 'x', organizationId: 'nao-e-uuid' }),
    ).resolves.toBeUndefined()
  })
})
