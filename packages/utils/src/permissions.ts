import { createAccessControl } from 'better-auth/plugins/access'
import {
  adminAc,
  memberAc,
  ownerAc,
} from 'better-auth/plugins/organization/access'

/**
 * Access Control (RBAC) do plugin organization do Better Auth.
 *
 * Estas definições são COMPARTILHADAS entre server (`better-auth/configs.ts`) e
 * client (`auth-client.ts`) — precisam ser idênticas nos dois lados.
 *
 * O `statement` declara recursos → ações. As roles (owner/admin/member) mapeiam
 * para subconjuntos dessas ações. Para checar no app:
 *   - server: `auth.api.hasPermission({ body: { permissions: {...} }, headers })`
 *   - client (dinâmico, bate no server): `authClient.organization.hasPermission(...)`
 *   - client (estático, p/ renderizar UI): `authClient.organization.checkRolePermission({ role, permissions })`
 *
 * Recurso `project` é só um EXEMPLO — troque pelos recursos do seu domínio.
 * Os demais (organization/member/invitation/team/ac) são os defaults do plugin.
 */
export const statement = {
  organization: ['update', 'delete'],
  member: ['create', 'update', 'delete'],
  invitation: ['create', 'cancel'],
  team: ['create', 'update', 'delete'],
  ac: ['create', 'read', 'update', 'delete'],
  // Exemplo de recurso de domínio:
  project: ['create', 'read', 'update', 'delete', 'share'],
} as const

export const ac = createAccessControl(statement)

/** Membro: acesso básico. */
export const member = ac.newRole({
  ...memberAc.statements,
  project: ['read'],
})

/** Admin: gerencia membros/convites/times + projetos (menos compartilhar). */
export const admin = ac.newRole({
  ...adminAc.statements,
  project: ['create', 'read', 'update', 'delete'],
})

/** Owner: tudo. */
export const owner = ac.newRole({
  ...ownerAc.statements,
  project: ['create', 'read', 'update', 'delete', 'share'],
})

export const roles = { owner, admin, member }
