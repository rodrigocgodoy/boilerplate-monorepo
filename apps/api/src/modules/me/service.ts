import { prisma } from '@repo/database'

/**
 * Compila os **dados pessoais** de um usuário para export (LGPD/GDPR, #11).
 * Sanitiza segredos — nunca inclui senha, tokens de OAuth, token de sessão nem
 * o hash das API keys. Síncrono (JSON para download); para volumes grandes,
 * offload para um job (#5) gerando um arquivo no S3 (#14) e enviando o link.
 */
export class MeService {
  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const [user, accounts, sessions, members, apiKeys, auditLogs] =
      await Promise.all([
        prisma.users.findUnique({ where: { id: userId } }),
        prisma.accounts.findMany({ where: { userId } }),
        prisma.sessions.findMany({ where: { userId } }),
        prisma.member.findMany({
          where: { userId },
          include: {
            organization: { select: { id: true, name: true, slug: true } },
          },
        }),
        prisma.apiKeys.findMany({ where: { userId } }),
        prisma.auditLogs.findMany({
          where: { actorId: userId },
          orderBy: { createdAt: 'desc' },
          take: 1000,
        }),
      ])

    return {
      exportedAt: new Date().toISOString(),
      user: user && {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      // Sem accessToken/refreshToken/idToken/password.
      accounts: accounts.map(a => ({
        providerId: a.providerId,
        accountId: a.accountId,
        scope: a.scope,
        createdAt: a.createdAt,
      })),
      // Sem o token de sessão.
      sessions: sessions.map(s => ({
        id: s.id,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      })),
      organizations: members.map(m => ({
        organization: m.organization,
        role: m.role,
        joinedAt: m.createdAt,
      })),
      // Sem keyHash.
      apiKeys: apiKeys.map(k => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        scopes: k.scopes,
        lastUsedAt: k.lastUsedAt,
        expiresAt: k.expiresAt,
        revokedAt: k.revokedAt,
        createdAt: k.createdAt,
      })),
      auditLogs: auditLogs.map(l => ({
        action: l.action,
        targetType: l.targetType,
        targetId: l.targetId,
        organizationId: l.organizationId,
        createdAt: l.createdAt,
      })),
    }
  }
}
