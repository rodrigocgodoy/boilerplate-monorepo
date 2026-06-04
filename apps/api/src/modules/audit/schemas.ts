import { z } from 'zod'

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

export const auditErrorSchema = z.object({
  error: z.string(),
})
