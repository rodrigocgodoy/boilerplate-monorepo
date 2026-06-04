import { beforeEach, expect, it } from 'vitest'
import { NotificationService } from '@/modules/notifications/service.js'
import { createUser, describeDb, resetDb } from './helpers/db.js'

describeDb('NotificationService (integração)', () => {
  beforeEach(resetDb)

  it('notify cria in-app; unreadCount/markRead funcionam', async () => {
    const user = await createUser()
    const svc = new NotificationService()
    await svc.notify(user.id, { category: 'system', title: 'Olá' })
    expect(await svc.unreadCount(user.id)).toBe(1)
    const list = await svc.list(user.id)
    expect(list[0]?.title).toBe('Olá')
    await svc.markRead(user.id, list[0].id)
    expect(await svc.unreadCount(user.id)).toBe(0)
  })

  it('respeita preferência inApp=false (não cria registro)', async () => {
    const user = await createUser()
    const svc = new NotificationService()
    await svc.setPreferences(user.id, {
      system: { inApp: false, email: false },
    })
    await svc.notify(user.id, { category: 'system', title: 'X' })
    expect(await svc.unreadCount(user.id)).toBe(0)
  })
})
