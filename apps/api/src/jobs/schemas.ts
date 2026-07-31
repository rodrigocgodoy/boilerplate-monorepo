import { z } from 'zod'

/**
 * Contratos dos payloads dos jobs.
 *
 * Mesma disciplina dos módulos da API (`schemas.ts` com Zod), aplicada à borda
 * da fila. A diferença é que aqui a borda atravessa **processo e tempo**: um job
 * enfileirado ontem pode ser consumido por um worker que subiu hoje, com outra
 * versão do código. O schema é o que impede um payload obsoleto de virar um
 * `undefined is not a function` no meio do handler.
 *
 * Os tipos são derivados destes schemas (`z.infer`) — o schema é a fonte da
 * verdade, não uma anotação paralela que pode divergir.
 */

/** `locale` opcional: localiza o e-mail; ausente = fallback (pt-BR). */
const localized = { locale: z.string().optional() }

export const emailJobSchema = z.discriminatedUnion('template', [
  z.object({
    ...localized,
    template: z.literal('verification'),
    to: z.email(),
    name: z.string().optional(),
    url: z.url(),
  }),
  z.object({
    ...localized,
    template: z.literal('reset'),
    to: z.email(),
    name: z.string().optional(),
    otp: z.string(),
  }),
  z.object({
    ...localized,
    template: z.literal('invitation'),
    to: z.email(),
    organizationName: z.string(),
    inviterName: z.string().optional(),
    url: z.url(),
  }),
  z.object({
    ...localized,
    template: z.literal('subscription'),
    to: z.email(),
    organizationName: z.string(),
    planName: z.string(),
    status: z.enum(['active', 'cancelled']),
  }),
  z.object({
    ...localized,
    template: z.literal('notification'),
    to: z.email(),
    title: z.string(),
    body: z.string().optional(),
    url: z.string().optional(),
  }),
])

export type EmailJob = z.infer<typeof emailJobSchema>

/**
 * Corpo cru do webhook do gateway. Deliberadamente **frouxo**: quem valida a
 * autenticidade é o HMAC na rota, e quem entende a forma é o service (que já
 * trata evento desconhecido). Apertar aqui faria o boilerplate quebrar toda vez
 * que o gateway acrescentasse um campo — trocaria um problema real por um pior.
 */
const webhookJobSchema = z.object({
  event: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
})

export const subscriptionWebhookJobSchema = webhookJobSchema
export const billingWebhookJobSchema = webhookJobSchema

export type SubscriptionWebhookJob = z.infer<
  typeof subscriptionWebhookJobSchema
>
export type BillingWebhookJob = z.infer<typeof billingWebhookJobSchema>

/**
 * Jobs agendados não recebem payload — o gatilho é o cron. `z.undefined()`
 * torna isso explícito: passar dado para um sweep é erro, não algo ignorado
 * em silêncio.
 */
export const noPayloadSchema = z.undefined()
