import { z } from 'zod'

/** Chave como exibida na listagem (sem o token nem o hash). */
export const apiKeyItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  scopes: z.array(z.string()).nullable(),
  lastUsedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
})

export const apiKeyListResponseSchema = z.object({
  keys: z.array(apiKeyItemSchema),
})

export const createApiKeyBodySchema = z.object({
  name: z.string().min(1).max(100),
  /** Escopos/permissões; vazio/ausente = sem restrição (acesso da org). */
  scopes: z.array(z.string()).optional(),
  /** Expira em N dias; ausente/0 = não expira. */
  expiresInDays: z.number().int().positive().max(3650).optional(),
})

/** Resposta da criação — inclui o token completo UMA única vez. */
export const createApiKeyResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Token completo (`bk_…`). Guarde agora — não é exibido de novo. */
  key: z.string(),
  prefix: z.string(),
  createdAt: z.string(),
})

export const revokeApiKeyResponseSchema = z.object({
  revoked: z.boolean(),
})

/** Endpoint de exemplo autenticado por API key. */
export const apiKeyPingResponseSchema = z.object({
  organizationId: z.string(),
  message: z.string(),
})

export const apiKeyErrorSchema = z.object({
  error: z.string(),
})
