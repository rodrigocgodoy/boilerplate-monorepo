import { prisma } from '@repo/database'
import { SubscriptionService } from '@/modules/subscription/service.js'
import {
  canUseFeature,
  evaluateQuota,
  type Features,
  numericLimit,
  type QuotaResult,
  toFeatures,
} from './quota.js'

/** Plano free usado como baseline de limites quando não há assinatura ativa. */
const FREE_PLAN_SLUG = 'starter'

/**
 * Métricas resolvidas por contagem viva (na fonte), não por contador medido.
 * `seats` = nº de membros da organização — sempre exato, sem incremento manual.
 */
const LIVE_METRICS = new Set(['seats'])

/** Chave mensal do período de uso ("YYYY-MM"). Virar o mês reseta implícito. */
function monthKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

export type UsageSummary = {
  period: string
  metrics: QuotaResult[]
}

/**
 * Entitlements / limites por plano (#7). Transforma `plan.features` em regras de
 * uso: resumo de consumo, checagem de quota e consumo medido (atômico). O
 * escopo é a **organização** (mesma fronteira do billing/`requireActivePlan`).
 */
export class EntitlementsService {
  constructor(
    private readonly subscriptions: SubscriptionService = new SubscriptionService(),
  ) {}

  /** Features efetivas da org: do plano ativo, ou do plano free (baseline). */
  async getFeatures(orgId: string): Promise<Features> {
    const { subscription, isActive } = await this.subscriptions.getActive(
      orgId,
      'ORGANIZATION',
    )
    if (isActive && subscription) return toFeatures(subscription.plan.features)
    const free = await prisma.plans.findUnique({
      where: { slug: FREE_PLAN_SLUG },
    })
    return toFeatures(free?.features)
  }

  /** Feature liga/desliga (flag booleana ou limite numérico ≠ 0). */
  async canUseFeature(orgId: string, feature: string): Promise<boolean> {
    return canUseFeature(await this.getFeatures(orgId), feature)
  }

  /** Consumo atual de uma métrica no período (vivo p/ seats; contador p/ resto). */
  private async currentUsage(
    orgId: string,
    metric: string,
    period: string,
  ): Promise<number> {
    if (LIVE_METRICS.has(metric)) {
      if (metric === 'seats') {
        return prisma.member.count({ where: { organizationId: orgId } })
      }
      return 0
    }
    const row = await prisma.usageCounters.findUnique({
      where: {
        organizationId_metric_period: { organizationId: orgId, metric, period },
      },
    })
    return row?.used ?? 0
  }

  /** Quota de uma métrica: limite do plano vs consumo atual. */
  async checkQuota(orgId: string, metric: string): Promise<QuotaResult> {
    const features = await this.getFeatures(orgId)
    const used = await this.currentUsage(orgId, metric, monthKey())
    return evaluateQuota(numericLimit(features, metric), used, metric)
  }

  /** Resumo de uso de todas as métricas numéricas do plano (alimenta a UI). */
  async getUsage(orgId: string): Promise<UsageSummary> {
    const features = await this.getFeatures(orgId)
    const period = monthKey()
    const numericMetrics = Object.keys(features).filter(
      k => typeof features[k] === 'number',
    )
    const metrics = await Promise.all(
      numericMetrics.map(async metric => {
        const used = await this.currentUsage(orgId, metric, period)
        return evaluateQuota(numericLimit(features, metric), used, metric)
      }),
    )
    return { period, metrics }
  }

  /**
   * Consome `amount` de uma métrica medida, de forma atômica e dentro da quota:
   * lê, valida e grava na mesma transação. Se já estourou, NÃO incrementa e
   * devolve `allowed=false`. Em sucesso devolve `allowed=true` (mesmo que o
   * consumo atinja o limite — `remaining` reflete o novo estado). Métricas de
   * contagem viva (seats) não são "consumidas" — caem no `checkQuota`.
   */
  async consume(
    orgId: string,
    metric: string,
    amount = 1,
  ): Promise<QuotaResult> {
    if (LIVE_METRICS.has(metric)) return this.checkQuota(orgId, metric)

    const limit = numericLimit(await this.getFeatures(orgId), metric)
    const period = monthKey()
    const where = {
      organizationId_metric_period: { organizationId: orgId, metric, period },
    }

    return prisma.$transaction(async tx => {
      const existing = await tx.usageCounters.findUnique({ where })
      const used = existing?.used ?? 0
      const pre = evaluateQuota(limit, used, metric)
      if (!pre.allowed) return pre // estourou — não incrementa

      const next = used + amount
      await tx.usageCounters.upsert({
        where,
        create: { organizationId: orgId, metric, period, used: next },
        update: { used: next },
      })
      // Consumo bem-sucedido: `allowed=true` (atingir o limite agora não torna
      // este consumo inválido). `remaining` já reflete o novo total.
      return { ...evaluateQuota(limit, next, metric), allowed: true }
    })
  }
}
