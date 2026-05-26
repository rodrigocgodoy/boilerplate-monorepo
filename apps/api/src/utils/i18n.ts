import {
  defaultNS,
  fallbackLocale,
  locales,
  namespaces,
  resources,
} from '@repo/i18n'
import i18next from 'i18next'

// Instância standalone do i18next para o servidor (sem React). Recursos inline
// → init síncrono (initImmediate: false), sem necessidade de await.
const i18n = i18next.createInstance()

i18n.init({
  resources,
  fallbackLng: fallbackLocale,
  supportedLngs: [...locales],
  defaultNS,
  interpolation: { escapeValue: false },
  initImmediate: false,
})

/**
 * Retorna uma função de tradução fixada no idioma informado, com acesso a
 * todos os namespaces (use chaves prefixadas, ex: t('auth:unauthorized')).
 */
export function getT(lng: string) {
  return i18n.getFixedT(lng, [...namespaces])
}

/** Tipo do `t` por request (todos os namespaces). */
export type AppTFunction = ReturnType<typeof getT>

export { resolveLanguage } from '@repo/i18n'
