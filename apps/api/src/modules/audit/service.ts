import { type AuditLogs, prisma } from '@repo/database'

export type AuditEntry = {
  /** Ação sensível (ex.: "member.remove", "subscription.cancel"). */
  action: string
  actorId?: string | null
  organizationId?: string | null
  targetType?: string | null
  targetId?: string | null
  metadata?: unknown
  ip?: string | null
  userAgent?: string | null
}

/**
 * Trilha de auditoria (#8). `record` é **best-effort**: nunca lança no caminho
 * do request — uma falha de auditoria não pode derrubar a ação de negócio.
 */
export class AuditService {
  async record(entry: AuditEntry): Promise<void> {
    try {
      await prisma.auditLogs.create({
        data: {
          action: entry.action,
          actorId: entry.actorId ?? null,
          organizationId: entry.organizationId ?? null,
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          metadata: (entry.metadata ?? undefined) as object | undefined,
          ip: entry.ip ?? null,
          userAgent: entry.userAgent ?? null,
        },
      })
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: log best-effort de auditoria
      console.error('[audit] falha ao registrar', entry.action, error)
    }
  }

  /** Trilha de uma organização (mais recentes primeiro). */
  list(organizationId: string, limit = 50): Promise<AuditLogs[]> {
    return prisma.auditLogs.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(1, limit), 200),
    })
  }
}
