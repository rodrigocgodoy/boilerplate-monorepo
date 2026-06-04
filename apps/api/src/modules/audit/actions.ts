/**
 * Ações de negócio (no nosso código) auditadas explicitamente.
 */
export const AUDIT_ACTIONS = {
  subscriptionSubscribe: 'subscription.subscribe',
  subscriptionCancel: 'subscription.cancel',
} as const

/**
 * Paths mutantes do plugin organization do Better Auth → ação auditada. Só os
 * que importam para a trilha (mudou role, removeu membro, convites, times…); os
 * GET (leituras) e demais ficam de fora. O hook em `auth-hook.ts` consulta este
 * mapa para decidir o que registrar.
 */
export const AUDIT_ORG_PATHS: Record<string, string> = {
  '/organization/create': 'organization.create',
  '/organization/update': 'organization.update',
  '/organization/delete': 'organization.delete',
  '/organization/invite-member': 'member.invite',
  '/organization/cancel-invitation': 'member.invite_cancel',
  '/organization/remove-member': 'member.remove',
  '/organization/update-member-role': 'member.role_update',
  '/organization/leave': 'member.leave',
  '/organization/create-team': 'team.create',
  '/organization/update-team': 'team.update',
  '/organization/remove-team': 'team.remove',
  '/organization/add-team-member': 'team.member_add',
  '/organization/remove-team-member': 'team.member_remove',
}

/** Tipo do alvo a partir do prefixo da ação (member.* → "member"). */
export function targetTypeFromAction(action: string): string {
  return action.split('.')[0] ?? 'unknown'
}
