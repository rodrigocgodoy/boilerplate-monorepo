import { createAuthMiddleware, getSessionFromCtx } from 'better-auth/api'
import { AUDIT_ORG_PATHS, targetTypeFromAction } from './actions.js'
import { AuditService } from './service.js'

const audit = new AuditService()

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}

type ActorSession = {
  user?: { id?: string }
  session?: { activeOrganizationId?: string | null }
} | null

/**
 * Hook `after` do Better Auth: audita as ações **mutantes** do plugin
 * organization (mudou role, removeu membro, convites, times…). Plugado em
 * `createAuthConfig().hooks.after`. Cobre o que o handler `/auth/*` processa —
 * que não passa pelos nossos módulos. Best-effort: qualquer erro é engolido
 * para nunca afetar o fluxo de auth.
 */
export const auditAfterHook = createAuthMiddleware(async ctx => {
  const path = ctx.path
  const action = path ? AUDIT_ORG_PATHS[path] : undefined
  if (!action) return

  try {
    const session = (await getSessionFromCtx(ctx)) as ActorSession
    const body = (ctx.body ?? {}) as Record<string, unknown>
    const headers = ctx.headers
    await audit.record({
      action,
      actorId: session?.user?.id ?? null,
      organizationId:
        str(body.organizationId) ??
        session?.session?.activeOrganizationId ??
        null,
      targetType: targetTypeFromAction(action),
      targetId:
        str(body.memberIdOrEmail) ??
        str(body.memberId) ??
        str(body.email) ??
        str(body.teamId) ??
        str(body.invitationId) ??
        str(body.organizationId) ??
        null,
      metadata: body,
      ip: str(headers?.get('x-forwarded-for')) ?? null,
      userAgent: str(headers?.get('user-agent')) ?? null,
    })
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: best-effort de auditoria
    console.error('[audit] hook falhou', error)
  }
})
