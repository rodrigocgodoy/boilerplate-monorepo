import { beforeEach, expect, it } from 'vitest'
import { MeService } from '@/modules/me/service.js'
import { createOrg, createUser, describeDb, resetDb } from './helpers/db.js'

describeDb('MeService.exportUserData (integração)', () => {
  beforeEach(resetDb)

  it('exporta os dados do usuário, sanitizados', async () => {
    const user = await createUser({ name: 'Ana', email: 'ana@test.dev' })
    await createOrg(user.id)

    const data = await new MeService().exportUserData(user.id)
    const exportedUser = data.user as { email?: string } | null
    expect(exportedUser?.email).toBe('ana@test.dev')
    expect(data.organizations).toHaveLength(1)
    // Não vaza segredos.
    const raw = JSON.stringify(data)
    expect(raw).not.toContain('keyHash')
    expect(raw).not.toContain('password')
  })
})
