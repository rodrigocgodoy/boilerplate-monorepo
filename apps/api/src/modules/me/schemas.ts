import { z } from 'zod'

export const meResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  createdAt: z.string(),
})

export const meErrorSchema = z.object({
  error: z.string(),
})

export type Me = z.infer<typeof meResponseSchema>
