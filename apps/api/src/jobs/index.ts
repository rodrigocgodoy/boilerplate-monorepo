import { createJobRunner, type JobRunner, type JobSchemas } from '@repo/jobs'
import { env } from '@/utils/environment.js'
import { handlers } from './handlers.js'
import {
  billingWebhookJobSchema,
  emailJobSchema,
  noPayloadSchema,
  subscriptionWebhookJobSchema,
} from './schemas.js'

/**
 * Runner de jobs da API. Sem `REDIS_URL`, `enqueue` roda inline (dev sem infra);
 * com Redis, vira fila BullMQ com retries/backoff, jobs agendados e DLQ.
 *
 * O worker sobe in-process junto da API por padrão (conveniência em dev). Para
 * escalar, rode `pnpm worker` (entry dedicado) com `JOBS_IN_PROCESS=false` na
 * API. Ver UPGRADES.md.
 */

/**
 * Um schema por handler. O tipo é mapeado sobre `handlers`, então **esquecer um
 * job aqui é erro de compilação** — a validação não pode ficar opcional por
 * distração.
 */
const schemas: JobSchemas<typeof handlers> = {
  email: emailJobSchema,
  'subscription-webhook': subscriptionWebhookJobSchema,
  'billing-webhook': billingWebhookJobSchema,
  'sweep-subscriptions': noPayloadSchema,
  'sweep-trials': noPayloadSchema,
}

// Tipo anotado explicitamente: o tipo inferido referenciaria o `bullmq`
// aninhado em packages/jobs/node_modules (não portável no .d.ts emitido).
export const jobs: JobRunner<typeof handlers> = createJobRunner({
  redisUrl: env.REDIS_URL || undefined,
  handlers,
  schemas,
  schedules: [
    // Todo dia às 03:00 — expira assinaturas pagas com período vencido.
    { job: 'sweep-subscriptions', pattern: '0 3 * * *' },
    // Todo dia às 03:30 — expira trials terminados sem conversão.
    { job: 'sweep-trials', pattern: '30 3 * * *' },
  ],
})

/** Enfileira um job (ou roda inline sem Redis). Atalho tipado para `jobs`. */
export const enqueue: JobRunner<typeof handlers>['enqueue'] = (...args) =>
  jobs.enqueue(...args)
