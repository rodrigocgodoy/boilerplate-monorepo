import { prisma } from '@repo/database'
import {
  sendOrganizationInvitationEmail,
  sendPasswordResetEmail,
  sendSubscriptionEmail,
  sendVerificationEmail,
} from '@repo/emails'

/**
 * Payload do job `email` — union por template. Centraliza o envio para que
 * qualquer disparo passe pela fila (retries/backoff quando o Redis está ligado).
 */
export type EmailJob =
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
  }
}

/**
 * Expira assinaturas cujo período já passou e ainda constam ACTIVE/TRIALING.
 * Rodada por um job agendado (diário) — substitui depender só do webhook.
 */
export async function sweepExpiredSubscriptions(
  now = new Date(),
): Promise<number> {
  const { count } = await prisma.subscriptions.updateMany({
    where: {
      status: { in: ['ACTIVE', 'TRIALING'] },
      currentPeriodEnd: { not: null, lt: now },
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

/** Mapa nome-do-job → handler. As chaves viram os nomes dos jobs. */
export const handlers = {
  email: handleEmail,
  'subscription-webhook': handleSubscriptionWebhook,
  'sweep-subscriptions': async (): Promise<void> => {
    await sweepExpiredSubscriptions()
  },
}
