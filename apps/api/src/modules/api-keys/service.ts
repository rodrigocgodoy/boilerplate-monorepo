import { type ApiKeys, prisma } from '@repo/database'
import {
  apiKeyPrefix,
  generateApiKey,
  hashApiKey,
  hashesMatch,
  isApiKeyFormat,
} from './keys.js'

export type CreateApiKeyInput = {
  organizationId: string
  userId: string
  name: string
  scopes?: string[] | null
  expiresInDays?: number | null
}

/** Contexto resolvido de uma chave válida (anexado em `request.apiKey`). */
export type VerifiedApiKey = {
  id: string
  organizationId: string
  userId: string
  scopes: string[] | null
}

const DAY_MS = 24 * 60 * 60 * 1000

export class ApiKeyService {
  /** Cria uma chave. Retorna o token completo (mostrado 1x) + o registro. */
  async create(
    input: CreateApiKeyInput,
  ): Promise<{ token: string; record: ApiKeys }> {
    const { token, prefix, keyHash } = generateApiKey()
    const expiresAt =
      input.expiresInDays && input.expiresInDays > 0
        ? new Date(Date.now() + input.expiresInDays * DAY_MS)
        : null
    const record = await prisma.apiKeys.create({
      data: {
        name: input.name,
        prefix,
        keyHash,
        organizationId: input.organizationId,
        userId: input.userId,
        scopes: input.scopes ?? undefined,
        expiresAt,
      },
    })
    return { token, record }
  }

  /** Chaves ativas (não revogadas) da organização. */
  list(organizationId: string): Promise<ApiKeys[]> {
    return prisma.apiKeys.findMany({
      where: { organizationId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    })
  }

  /** Revoga uma chave da organização. Retorna true se revogou. */
  async revoke(organizationId: string, id: string): Promise<boolean> {
    const { count } = await prisma.apiKeys.updateMany({
      where: { id, organizationId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return count > 0
  }

  /**
   * Verifica um token bruto: lookup por prefixo → compara hash (tempo
   * constante) → checa revogação/expiração. Atualiza `lastUsedAt` em
   * background (best-effort). Retorna o contexto da chave ou null.
   */
  async verify(token: string): Promise<VerifiedApiKey | null> {
    if (!isApiKeyFormat(token)) return null
    const record = await prisma.apiKeys.findUnique({
      where: { prefix: apiKeyPrefix(token) },
    })
    if (!record) return null
    if (!hashesMatch(record.keyHash, hashApiKey(token))) return null
    if (record.revokedAt) return null
    if (record.expiresAt && record.expiresAt < new Date()) return null

    // Marca uso sem bloquear a resposta (best-effort).
    prisma.apiKeys
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {})

    return {
      id: record.id,
      organizationId: record.organizationId,
      userId: record.userId,
      scopes: Array.isArray(record.scopes) ? (record.scopes as string[]) : null,
    }
  }
}
