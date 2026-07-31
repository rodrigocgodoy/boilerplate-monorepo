import { z } from 'zod'
import { problemSchema } from '@/utils/problem.js'

export const auditEntrySchema = z.object({
  id: z.string(),
  actorId: z.string().nullable(),
  action: z.string(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  metadata: z.unknown().nullable(),
  ip: z.string().nullable(),
  createdAt: z.string(),
})

export const auditListResponseSchema = z.object({
  entries: z.array(auditEntrySchema),
})

/**
 * Erros deste módulo seguem Problem Details (RFC 9457), igual ao resto da
 * API. O alias mantém o nome já usado nas rotas. Ver `utils/problem.ts`.
 */
export const auditErrorSchema = problemSchema
