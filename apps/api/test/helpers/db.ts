import { randomUUID } from 'node:crypto'
import { prisma } from '@repo/database'
import { describe } from 'vitest'

/**
 * Infra para **testes de integração** com Postgres. Rodam só quando
 * `TEST_DATABASE_URL` está setado (CI sobe um Postgres; em dev, opt-in):
 *
 * ```ts
 * import { describeDb, resetDb, createUser } from './helpers/db.js'
 * describeDb('meu fluxo', () => { beforeEach(resetDb); it(...) })
 * ```
 *
 * Sem o banco, os blocos são pulados — `pnpm test` segue rodando os unitários.
 */
export const hasTestDb = Boolean(process.env.TEST_DATABASE_URL)

/** `describe` que só roda com banco de teste configurado. */
export const describeDb = hasTestDb ? describe : describe.skip

// Tabelas zeradas entre testes (ordem não importa com CASCADE). `teamMember`
// tem nome com maiúscula no banco (precisa de aspas).
const TABLES = [
  'users',
  'sessions',
  'accounts',
  'verifications',
  'organization',
  'member',
  'team',
  '"teamMember"',
  'invitation',
  'payments',
  'plans',
  'subscriptions',
  'usage_counters',
  'audit_logs',
  'api_keys',
  'notifications',
  'notification_preferences',
]

/** Zera o banco de teste (TRUNCATE … RESTART IDENTITY CASCADE). */
export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE;`,
  )
}

export async function createUser(
  over: { name?: string; email?: string; role?: string } = {},
) {
  return prisma.users.create({
    data: {
      name: over.name ?? 'Test User',
      email: over.email ?? `u-${randomUUID()}@test.dev`,
      role: over.role,
    },
  })
}

/** Cria uma organização com o usuário como `owner`. */
export async function createOrg(ownerId: string, name = 'Test Org') {
  return prisma.organization.create({
    data: {
      name,
      slug: `org-${randomUUID()}`,
      members: { create: { userId: ownerId, role: 'owner' } },
    },
  })
}

export async function createPlan(
  over: { slug?: string; features?: object; active?: boolean } = {},
) {
  return prisma.plans.create({
    data: {
      slug: over.slug ?? `plan-${randomUUID()}`,
      name: 'Test Plan',
      priceCents: 0,
      features: over.features ?? { seats: 1, apiCalls: 2 },
      active: over.active ?? true,
    },
  })
}
