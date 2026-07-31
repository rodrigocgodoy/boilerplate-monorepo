import { z } from 'zod'
import { problemSchema } from '@/utils/problem.js'

export const meResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  createdAt: z.string(),
})

/**
 * Erros deste módulo seguem Problem Details (RFC 9457), igual ao resto da
 * API. O alias mantém o nome já usado nas rotas. Ver `utils/problem.ts`.
 */
export const meErrorSchema = problemSchema

export type Me = z.infer<typeof meResponseSchema>
