import { z } from 'zod'

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

export const storageErrorSchema = z.object({
  error: z.string(),
})
