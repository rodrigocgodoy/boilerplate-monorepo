import { type Plans, prisma, type Subscriptions } from '@repo/database'
import { enqueue } from '@/jobs/index.js'
import { PaymentError } from '@/modules/payment/client.js'
import { env } from '@/utils/environment.js'
import { cancelSubscription, createSubscription } from './abacatepay-v2.js'

const ACTIVE_STATUSES = ['ACTIVE', 'TRIALING']

/** Soma um ciclo de cobrança a uma data. */
function addInterval(from: Date, interval: string): Date {
  const d = new Date(from)
  switch (interval) {
    case 'WEEKLY':
      d.setDate(d.getDate() + 7)
      break
    case 'SEMIANNUALLY':
      d.setMonth(d.getMonth() + 6)
      break
    case 'ANNUALLY':
      d.setFullYear(d.getFullYear() + 1)
      break
    default:
      d.setMonth(d.getMonth() + 1) // MONTHLY
  }
  return d
}

function isActive(sub: Subscriptions | null, now = new Date()): boolean {
  if (!sub) return false
  if (!ACTIVE_STATUSES.includes(sub.status)) return false
  return !sub.currentPeriodEnd || sub.currentPeriodEnd > now
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export class SubscriptionService {
  /** Catálogo de planos ativos, ordenado. */
  listPlans(): Promise<Plans[]> {
    return prisma.plans.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    })
  }

  /**
   * Assinatura mais relevante do dono + flag `isActive`. Retorna a ativa se
   * houver; senão a mais recente (para exibir histórico/estado); senão null.
   */
  async getActive(ownerId: string, ownerType = 'USER') {
    const subs = await prisma.subscriptions.findMany({
      where: { ownerId, ownerType },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    })
    const active = subs.find(s => isActive(s)) ?? null
    const chosen = active ?? subs[0] ?? null
    return { subscription: chosen, isActive: !!active }
  }

  /**
   * Inicia uma assinatura: cria o registro local (INCOMPLETE), chama a v2 do
   * AbacatePay e devolve a URL de checkout para o primeiro pagamento.
   */
  async subscribe(ownerId: string, planSlug: string, ownerType = 'USER') {
    const plan = await prisma.plans.findUnique({ where: { slug: planSlug } })
    if (!plan || !plan.active) {
      throw new PaymentError('plan_not_found')
    }
    if (!plan.externalProductId) {
      // O plano precisa estar vinculado a um produto (com cycle) no AbacatePay.
      throw new PaymentError('plan_not_linked')
    }

    const local = await prisma.subscriptions.create({
      data: { ownerId, ownerType, planId: plan.id, status: 'INCOMPLETE' },
    })

    const result = await createSubscription({
      items: [{ id: plan.externalProductId, quantity: 1 }],
      externalId: local.id,
      completionUrl: new URL('/billing', env.APP_URL).toString(),
      returnUrl: new URL('/billing', env.APP_URL).toString(),
      methods: ['CARD', 'PIX'],
    })

    await prisma.subscriptions.update({
      where: { id: local.id },
      data: { externalId: result.id, metadata: result as object },
    })

    if (!result.url) {
      throw new PaymentError('subscription_no_checkout_url')
    }

    return { url: result.url, subscriptionId: local.id }
  }

  /** Cancela a assinatura ativa do dono (efeito imediato). */
  async cancel(ownerId: string, ownerType = 'USER'): Promise<boolean> {
    const { subscription } = await this.getActive(ownerId, ownerType)
    if (!subscription) return false

    if (subscription.externalId) {
      await cancelSubscription(subscription.externalId)
    }
    await prisma.subscriptions.update({
      where: { id: subscription.id },
      data: { status: 'CANCELLED', canceledAt: new Date() },
    })
    return true
  }

  /**
   * Processa eventos `subscription.*` do webhook. O segredo já foi validado
   * pela rota; aqui só atualizamos o estado local e o histórico.
   */
  async handleWebhookEvent(body: {
    event?: string
    data?: Record<string, unknown>
  }): Promise<void> {
    const event = body.event ?? ''
    const data = (body.data ?? {}) as Record<string, unknown>
    const sub = (data.subscription ?? {}) as Record<string, unknown>
    const payment = data.payment as Record<string, unknown> | undefined

    const localId = asString(sub.externalId)
    const abacateId = asString(sub.id)

    let local =
      (localId
        ? await prisma.subscriptions.findUnique({
            where: { id: localId },
            include: { plan: true },
          })
        : null) ?? null
    if (!local && abacateId) {
      local = await prisma.subscriptions.findUnique({
        where: { externalId: abacateId },
        include: { plan: true },
      })
    }
    if (!local) return

    const now = new Date()
    const update: Record<string, unknown> = {}
    if (abacateId && !local.externalId) update.externalId = abacateId

    switch (event) {
      case 'subscription.trial_started': {
        update.status = 'TRIALING'
        const trialEnds = asString(sub.trialEndsAt)
        if (trialEnds) update.trialEndsAt = new Date(trialEnds)
        break
      }
      case 'subscription.completed':
      case 'subscription.renewed':
        update.status = 'ACTIVE'
        update.currentPeriodStart = now
        update.currentPeriodEnd = addInterval(now, local.plan.interval)
        break
      case 'subscription.cancelled':
        update.status = 'CANCELLED'
        update.canceledAt = now
        break
      default:
        return
    }

    await prisma.subscriptions.update({ where: { id: local.id }, data: update })

    // Histórico: registra a cobrança recorrente quando aplicável.
    if (
      event === 'subscription.completed' ||
      event === 'subscription.renewed'
    ) {
      const externalId =
        asString(payment?.id) ?? `${local.id}:${event}:${now.getTime()}`
      const amount = Number(payment?.amount ?? local.plan.priceCents)
      await prisma.payments.upsert({
        where: { externalId },
        create: {
          externalId,
          kind: 'SUBSCRIPTION',
          status: 'PAID',
          amount: Number.isFinite(amount) ? amount : local.plan.priceCents,
          method: asString(sub.method) ?? null,
          description: local.plan.name,
          userId: local.ownerType === 'USER' ? local.ownerId : null,
          subscriptionId: local.id,
          metadata: body as object,
        },
        update: { status: 'PAID' },
      })
    }

    // E-mail de billing ao owner da organização (best-effort): ativação e
    // cancelamento. `renewed` não dispara e-mail para não notificar a cada ciclo.
    if (
      local.ownerType === 'ORGANIZATION' &&
      (event === 'subscription.completed' || event === 'subscription.cancelled')
    ) {
      const ownerMember = await prisma.member.findFirst({
        where: { organizationId: local.ownerId, role: 'owner' },
        include: { users: { select: { email: true } } },
      })
      const org = await prisma.organization.findUnique({
        where: { id: local.ownerId },
        select: { name: true },
      })
      if (ownerMember?.users.email && org) {
        // Via fila: com Redis ganha retries/backoff; sem Redis envia inline.
        await enqueue('email', {
          template: 'subscription',
          to: ownerMember.users.email,
          organizationName: org.name,
          planName: local.plan.name,
          status: event === 'subscription.cancelled' ? 'cancelled' : 'active',
        })
      }
    }
  }
}
