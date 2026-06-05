import { prisma } from '@repo/database'
import {
  sendNotificationEmail,
  sendOrganizationInvitationEmail,
  sendPasswordResetEmail,
  sendSubscriptionEmail,
  sendVerificationEmail,
} from '@repo/emails'

/**
 * Payload do job `email` — union por template. Centraliza o envio para que
 * qualquer disparo passe pela fila (retries/backoff quando o Redis está ligado).
 */
// `locale` (opcional) localiza o e-mail; ausente = fallback (pt-BR).
export type EmailJob = { locale?: string } & (
  | { template: 'verification'; to: string; name?: string; url: string }
  | { template: 'reset'; to: string; name?: string; otp: string }
  | {
      template: 'invitation'
      to: string
      organizationName: string
      inviterName?: string
      url: string
    }
  | {
      template: 'subscription'
      to: string
      organizationName: string
      planName: string
      status: 'active' | 'cancelled'
    }
  | {
      template: 'notification'
      to: string
      title: string
      body?: string
      url?: string
    }
)

async function handleEmail(job: EmailJob): Promise<void> {
  switch (job.template) {
    case 'verification':
      await sendVerificationEmail(job)
      break
    case 'reset':
      await sendPasswordResetEmail(job)
      break
    case 'invitation':
      await sendOrganizationInvitationEmail(job)
      break
    case 'subscription':
      await sendSubscriptionEmail(job)
      break
    case 'notification':
      await sendNotificationEmail(job)
      break
  }
}

/**
 * Expira assinaturas pagas cujo período já passou e ainda constam ACTIVE
 * (renovação não chegou). Rodada por job agendado (diário) — não depende só do
 * webhook. Trials têm sweep dedicado (`sweepExpiredTrials`).
 */
export async function sweepExpiredSubscriptions(
  now = new Date(),
): Promise<number> {
  const { count } = await prisma.subscriptions.updateMany({
    where: {
      status: 'ACTIVE',
      currentPeriodEnd: { not: null, lt: now },
    },
    data: { status: 'EXPIRED' },
  })
  return count
}

/**
 * Expira trials que terminaram sem conversão: status TRIALING e `trialEndsAt`
 * no passado. O webhook `subscription.completed` converte o trial em ACTIVE
 * antes disso; este job é o fallback quando a conversão não chega (e mantém o
 * estado coerente com o gating, que já trata o trial como expirado em tempo
 * real via `trialEndsAt`). Job agendado dedicado.
 */
export async function sweepExpiredTrials(now = new Date()): Promise<number> {
  const { count } = await prisma.subscriptions.updateMany({
    where: {
      status: 'TRIALING',
      trialEndsAt: { not: null, lt: now },
    },
    data: { status: 'EXPIRED' },
  })
  return count
}

/** Payload do job `subscription-webhook`: o corpo do webhook do AbacatePay. */
export type SubscriptionWebhookJob = {
  event?: string
  data?: Record<string, unknown>
}

/**
 * Processa o webhook de assinatura fora do request (async + com retries quando
 * há Redis). `handleWebhookEvent` é idempotente (upsert de pagamentos por
 * externalId, updates de status determinísticos). Import dinâmico do serviço
 * para não criar ciclo estático (service → jobs → handlers).
 */
async function handleSubscriptionWebhook(
  body: SubscriptionWebhookJob,
): Promise<void> {
  const { SubscriptionService } = await import(
    '@/modules/subscription/service.js'
  )
  await new SubscriptionService().handleWebhookEvent(body)
}

/** Payload do job `billing-webhook`: o corpo do webhook de cobrança avulsa. */
export type BillingWebhookJob = {
  event?: string
  data?: Record<string, unknown>
}

/**
 * Processa o webhook de cobrança avulsa (`billing.*` / PIX) fora do request,
 * com retries/backoff quando há Redis. `handleBillingEvent` é idempotente
 * (atualiza o pagamento por `externalId`). Import dinâmico para não criar ciclo
 * estático (service → jobs → handlers).
 */
async function handleBillingWebhook(body: BillingWebhookJob): Promise<void> {
  const { PaymentService } = await import('@/modules/payment/service.js')
  await new PaymentService().handleBillingEvent(body)
}

/** Mapa nome-do-job → handler. As chaves viram os nomes dos jobs. */
export const handlers = {
  email: handleEmail,
  'subscription-webhook': handleSubscriptionWebhook,
  'billing-webhook': handleBillingWebhook,
  'sweep-subscriptions': async (): Promise<void> => {
    await sweepExpiredSubscriptions()
  },
  'sweep-trials': async (): Promise<void> => {
    await sweepExpiredTrials()
  },
}
