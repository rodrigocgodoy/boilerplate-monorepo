import { z } from 'zod'
import { problemSchema } from '@/utils/problem.js'

export const presignAvatarBodySchema = z.object({
  /** MIME type do arquivo (ex.: "image/png"). */
  contentType: z.string().min(1),
})

export const presignAvatarResponseSchema = z.object({
  url: z.string(),
  fields: z.record(z.string(), z.string()),
  /** URL pública final — salve em `user.image` após o upload concluir. */
  publicUrl: z.string(),
})

/**
 * Erros deste módulo seguem Problem Details (RFC 9457), igual ao resto da
 * API. O alias mantém o nome já usado nas rotas. Ver `utils/problem.ts`.
 */
export const storageErrorSchema = problemSchema
