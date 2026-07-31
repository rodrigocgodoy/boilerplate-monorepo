import { defaultLocale, type Locale, locales } from './config.js'

/**
 * Resolve o melhor Locale suportado a partir de um header Accept-Language
 * (ou uma tag única). Faz match exato e, em seguida, por prefixo de idioma
 * (ex: "en-US" → "en", "pt" → "pt-BR"). Cai no defaultLocale se nada casar.
 */
export function resolveLanguage(input?: string | null): Locale {
  if (!input) return defaultLocale

  const candidates = input
    .split(',')
    .map(part => part.split(';')[0]?.trim())
    .filter((tag): tag is string => Boolean(tag))

  for (const candidate of candidates) {
    const lower = candidate.toLowerCase()

    const exact = locales.find(l => l.toLowerCase() === lower)
    if (exact) return exact

    const base = lower.split('-')[0]
    const byPrefix = locales.find(l => l.toLowerCase().split('-')[0] === base)
    if (byPrefix) return byPrefix
  }

  return defaultLocale
}
