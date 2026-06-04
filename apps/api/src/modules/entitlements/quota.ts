/**
 * Núcleo puro dos entitlements (sem I/O) — fácil de testar. As features de um
 * plano são um mapa `{ <metric>: number | boolean }` (ex.: `{ seats: 5,
 * apiCalls: 100000, sso: true }`). Métricas numéricas viram quotas; flags
 * booleanas viram features liga/desliga (`canUseFeature`).
 */

export type FeatureValue = number | boolean
export type Features = Record<string, FeatureValue>

export type QuotaResult = {
  metric: string
  /** Limite do plano; `null` = ilimitado. */
  limit: number | null
  /** Consumo atual no período. */
  used: number
  /** Quanto resta; `null` = ilimitado. */
  remaining: number | null
  /** `true` se a métrica é ilimitada neste plano. */
  unlimited: boolean
  /** `true` se ainda cabe ao menos +1 (há espaço na quota). */
  allowed: boolean
}

/** Converte o JSON de `plan.features` num mapa de features seguro. */
export function toFeatures(value: unknown): Features {
  if (!value || typeof value !== 'object') return {}
  const out: Features = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'number' || typeof raw === 'boolean') out[key] = raw
  }
  return out
}

/**
 * Limite numérico de uma métrica no plano. `null` = não definido pelo plano →
 * tratado como ilimitado (só limitamos o que o plano declara). Use `-1` no
 * plano para "ilimitado" explícito.
 */
export function numericLimit(
  features: Features,
  metric: string,
): number | null {
  const value = features[metric]
  return typeof value === 'number' ? value : null
}

/** Avalia uma quota: limite vs consumo. Limite `null`/negativo = ilimitado. */
export function evaluateQuota(
  limit: number | null,
  used: number,
  metric = '',
): QuotaResult {
  const unlimited = limit === null || limit < 0
  if (unlimited) {
    return {
      metric,
      limit: null,
      used,
      remaining: null,
      unlimited: true,
      allowed: true,
    }
  }
  const remaining = Math.max(0, limit - used)
  return {
    metric,
    limit,
    used,
    remaining,
    unlimited: false,
    allowed: used < limit,
  }
}

/**
 * Feature liga/desliga: flag booleana `true`, ou limite numérico diferente de
 * zero (planos com `0` desligam a feature; ausência = ilimitado/liberado).
 */
export function canUseFeature(features: Features, feature: string): boolean {
  const value = features[feature]
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  return true
}
