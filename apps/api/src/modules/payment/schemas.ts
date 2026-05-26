import { z } from 'zod'

/** Status possíveis de uma cobrança (espelha o AbacatePay). */
export const paymentStatusSchema = z.enum([
  'PENDING',
  'PAID',
  'EXPIRED',
  'CANCELLED',
  'REFUNDED',
])

/** Dados opcionais do cliente, repassados ao AbacatePay. */
const customerSchema = z
  .object({
    name: z.string().optional(),
    email: z.string().email(),
    cellphone: z.string().optional(),
    taxId: z.string().optional(),
  })
  .optional()

// ── PIX QR Code (checkout transparente) ───────────────────────────────────

export const createPixBodySchema = z.object({
  /** Valor em centavos. Mínimo 100 (R$ 1,00). */
  amount: z.number().int().min(100),
  description: z.string().min(1).max(140),
  /** Segundos até o QR Code expirar. Default 1h. */
  expiresIn: z.number().int().positive().default(3600),
  customer: customerSchema,
})

export const pixResponseSchema = z.object({
  id: z.string(),
  amount: z.number().int(),
  status: paymentStatusSchema,
  /** Copia-e-cola do PIX. */
  brCode: z.string(),
  /** Imagem do QR Code em base64 (data URI). */
  brCodeBase64: z.string(),
  expiresAt: z.string(),
})

// ── Billing (checkout hospedado PIX + CARD) ───────────────────────────────

export const createCheckoutBodySchema = z.object({
  products: z
    .array(
      z.object({
        externalId: z.string().min(1),
        name: z.string().min(1),
        quantity: z.number().int().positive(),
        /** Preço unitário em centavos. Mínimo 100. */
        price: z.number().int().min(100),
        description: z.string().optional(),
      }),
    )
    .min(1),
  methods: z.array(z.enum(['PIX', 'CARD'])).default(['PIX', 'CARD']),
  returnUrl: z.string().url(),
  completionUrl: z.string().url(),
  customer: customerSchema,
})

export const checkoutResponseSchema = z.object({
  id: z.string(),
  /** URL onde o cliente conclui o pagamento. */
  url: z.string(),
  amount: z.number().int(),
  status: paymentStatusSchema,
})

// ── Status de uma cobrança ────────────────────────────────────────────────

export const paymentParamsSchema = z.object({
  id: z.string(),
})

export const paymentResponseSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  kind: z.string(),
  status: paymentStatusSchema,
  amount: z.number().int(),
  method: z.string().nullable(),
  brCode: z.string().nullable(),
  url: z.string().nullable(),
})

// ── Histórico de pagamentos ───────────────────────────────────────────────

export const paymentListItemSchema = z.object({
  id: z.string(),
  kind: z.string(),
  status: paymentStatusSchema,
  amount: z.number().int(),
  method: z.string().nullable(),
  description: z.string().nullable(),
  subscriptionId: z.string().nullable(),
  createdAt: z.string(),
})

export const paymentListResponseSchema = z.object({
  payments: z.array(paymentListItemSchema),
})

// ── Webhook ───────────────────────────────────────────────────────────────

/** O segredo chega como query param `?webhookSecret=...`. */
export const webhookQuerySchema = z.object({
  webhookSecret: z.string().optional(),
})

/**
 * Payload do webhook. O shape exato varia por evento; mantemos frouxo de
 * propósito (passthrough) e extraímos id/status defensivamente no service.
 */
export const webhookBodySchema = z
  .object({
    event: z.string().optional(),
    devMode: z.boolean().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough()

export const webhookResponseSchema = z.object({
  received: z.boolean(),
})

export const paymentErrorSchema = z.object({
  error: z.string(),
})

export type CreatePixBody = z.infer<typeof createPixBodySchema>
export type CreateCheckoutBody = z.infer<typeof createCheckoutBodySchema>
export type PaymentStatus = z.infer<typeof paymentStatusSchema>
