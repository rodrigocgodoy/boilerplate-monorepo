import { z } from 'zod'

/** Resultado de quota de uma métrica (limite vs uso). `null` = ilimitado. */
export const quotaSchema = z.object({
  metric: z.string(),
  limit: z.number().int().nullable(),
  used: z.number().int(),
  remaining: z.number().int().nullable(),
  unlimited: z.boolean(),
  allowed: z.boolean(),
})

export const entitlementsResponseSchema = z.object({
  /** Período de uso (mensal, "YYYY-MM"). */
  period: z.string(),
  metrics: z.array(quotaSchema),
})

export const trackBodySchema = z.object({
  /** Métrica medida a consumir (ex.: "apiCalls"). */
  metric: z.string().min(1),
  /** Quantidade (default 1). */
  amount: z.number().int().positive().max(1000).optional(),
})

export const entitlementsErrorSchema = z.object({
  error: z.string(),
})
