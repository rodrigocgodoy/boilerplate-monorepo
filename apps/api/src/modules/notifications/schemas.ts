import { z } from 'zod'
import { problemSchema } from '@/utils/problem.js'

export const notificationItemSchema = z.object({
  id: z.string(),
  category: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  data: z.unknown().nullable(),
  read: z.boolean(),
  createdAt: z.string(),
})

export const notificationListResponseSchema = z.object({
  notifications: z.array(notificationItemSchema),
  unreadCount: z.number().int(),
})

const channelPrefsSchema = z.object({
  email: z.boolean(),
  inApp: z.boolean(),
})

export const preferencesResponseSchema = z.object({
  /** Mapa categoria → { email, inApp }. */
  preferences: z.record(z.string(), channelPrefsSchema),
})

export const updatePreferencesBodySchema = z.object({
  preferences: z.record(z.string(), channelPrefsSchema),
})

export const markReadResponseSchema = z.object({
  ok: z.boolean(),
  unreadCount: z.number().int(),
})

/**
 * Erros deste módulo seguem Problem Details (RFC 9457), igual ao resto da
 * API. O alias mantém o nome já usado nas rotas. Ver `utils/problem.ts`.
 */
export const notificationErrorSchema = problemSchema
