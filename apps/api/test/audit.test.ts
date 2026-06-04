import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  AUDIT_ACTIONS,
  AUDIT_ORG_PATHS,
  targetTypeFromAction,
} from '@/modules/audit/actions.js'
import { buildTestApp } from './helpers/build-app.js'

/**
 * Partes puras da auditoria (mapa de ações, derivação de tipo) + guard de auth
 * da rota. O registro/listagem (com banco) fica pro setup de banco de teste —
 * ver TESTING.md.
 */
describe('audit actions', () => {
  it('mapeia paths mutantes do plugin organization para ações', () => {
    expect(AUDIT_ORG_PATHS['/organization/remove-member']).toBe('member.remove')
    expect(AUDIT_ORG_PATHS['/organization/update-member-role']).toBe(
      'member.role_update',
    )
    expect(AUDIT_ORG_PATHS['/organization/invite-member']).toBe('member.invite')
  })

  it('não mapeia leituras (ex.: get-full-organization)', () => {
    expect(
      AUDIT_ORG_PATHS['/organization/get-full-organization'],
    ).toBeUndefined()
  })

  it('targetTypeFromAction usa o prefixo antes do ponto', () => {
    expect(targetTypeFromAction('member.remove')).toBe('member')
    expect(targetTypeFromAction('subscription.cancel')).toBe('subscription')
    expect(targetTypeFromAction('team.member_add')).toBe('team')
  })

  it('expõe as ações de negócio auditadas', () => {
    expect(AUDIT_ACTIONS.subscriptionCancel).toBe('subscription.cancel')
    expect(AUDIT_ACTIONS.subscriptionSubscribe).toBe('subscription.subscribe')
  })
})

describe('rota /audit', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    app = await buildTestApp()
  })
  afterAll(async () => {
    await app.close()
  })

  it('GET /audit responde 401 sem sessão', async () => {
    const res = await app.inject({ method: 'GET', url: '/audit' })
    expect(res.statusCode).toBe(401)
  })
})
