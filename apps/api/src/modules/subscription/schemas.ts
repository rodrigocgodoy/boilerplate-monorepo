import { z } from 'zod'
import { problemSchema } from '@/utils/problem.js'

export const planSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  priceCents: z.number().int(),
  currency: z.string(),
  /** WEEKLY | MONTHLY | SEMIANNUALLY | ANNUALLY */
  interval: z.string(),
  trialDays: z.number().int(),
  features: z.unknown().nullable(),
})

export const plansResponseSchema = z.object({
  plans: z.array(planSchema),
})

export const subscriptionStatusSchema = z.enum([
  'INCOMPLETE',
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELLED',
  'EXPIRED',
])

export const subscriptionResponseSchema = z.object({
  /** Assinatura atual do usuário, ou null (sem plano pago = free). */
  subscription: z
    .object({
      id: z.string(),
      status: subscriptionStatusSchema,
      plan: planSchema,
      currentPeriodEnd: z.string().nullable(),
      cancelAtPeriodEnd: z.boolean(),
      trialEndsAt: z.string().nullable(),
    })
    .nullable(),
  /** Atalho: tem plano pago ativo (ACTIVE ou TRIALING dentro do período). */
  isActive: z.boolean(),
  /** Se o bloqueio por plano está ligado (REQUIRE_ACTIVE_PLAN). Fonte única
   * para o guard do front decidir se redireciona. */
  gatingEnabled: z.boolean(),
})

/** Demo de feature protegida por plano (guard `requireActivePlan`). */
export const premiumResponseSchema = z.object({
  message: z.string(),
})

export const subscribeBodySchema = z.object({
  planSlug: z.string().min(1),
})

export const subscribeResponseSchema = z.object({
  /** URL de checkout do AbacatePay para concluir o primeiro pagamento. */
  url: z.string(),
  subscriptionId: z.string(),
})

export const cancelResponseSchema = z.object({
  cancelled: z.boolean(),
})

export const paymentHistoryItemSchema = z.object({
  id: z.string(),
  kind: z.string(),
  status: z.string(),
  amount: z.number().int(),
  method: z.string().nullable(),
  description: z.string().nullable(),
  subscriptionId: z.string().nullable(),
  createdAt: z.string(),
})

export const paymentHistoryResponseSchema = z.object({
  payments: z.array(paymentHistoryItemSchema),
})

/**
 * Erros deste módulo seguem Problem Details (RFC 9457), igual ao resto da
 * API. O alias mantém o nome já usado nas rotas. Ver `utils/problem.ts`.
 */
export const subscriptionErrorSchema = problemSchema
