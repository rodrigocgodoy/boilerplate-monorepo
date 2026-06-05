import { prisma } from '@repo/database'
import { beforeEach, expect, it } from 'vitest'
import { EntitlementsService } from '@/modules/entitlements/service.js'
import { SubscriptionService } from '@/modules/subscription/service.js'
import {
  createOrg,
  createPlan,
  createUser,
  describeDb,
  resetDb,
} from './helpers/db.js'

const svc = () => new EntitlementsService(new SubscriptionService())

async function orgOnPlan(features: object) {
  const user = await createUser()
  const org = await createOrg(user.id)
  const plan = await createPlan({ features })
  await prisma.subscriptions.create({
    data: {
      ownerId: org.id,
      ownerType: 'ORGANIZATION',
      planId: plan.id,
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
    },
  })
  return org
}

describeDb('EntitlementsService (integração)', () => {
  beforeEach(resetDb)

  it('consome apiCalls e bloqueia ao atingir o limite do plano', async () => {
    const org = await orgOnPlan({ apiCalls: 2 })
    const e = svc()
    expect((await e.consume(org.id, 'apiCalls')).allowed).toBe(true)
    expect((await e.consume(org.id, 'apiCalls')).allowed).toBe(true)
    const third = await e.consume(org.id, 'apiCalls')
    expect(third.allowed).toBe(false)
    expect(third.used).toBe(2) // não incrementou além do limite
  })

  it('seats reflete a contagem de membros (contagem viva)', async () => {
    const org = await orgOnPlan({ seats: 3 })
    const q = await svc().checkQuota(org.id, 'seats')
    expect(q.used).toBe(1) // só o owner
    expect(q.limit).toBe(3)
    expect(q.allowed).toBe(true)
  })

  it('métrica ilimitada (-1) sempre permite', async () => {
    const org = await orgOnPlan({ apiCalls: -1 })
    const q = await svc().checkQuota(org.id, 'apiCalls')
    expect(q.unlimited).toBe(true)
    expect(q.allowed).toBe(true)
  })
})
