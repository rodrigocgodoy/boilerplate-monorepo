import { fallbackLocale, locales, resources } from '@repo/i18n'
import i18next from 'i18next'

// Instância standalone do i18next para os e-mails (sem React/SSR), reusando os
// mesmos recursos de `@repo/i18n` (namespace `email`). Init síncrono.
const i18n = i18next.createInstance()
i18n.init({
  resources,
  fallbackLng: fallbackLocale,
  supportedLngs: [...locales],
  defaultNS: 'email',
  interpolation: { escapeValue: false },
  initImmediate: false,
})

/**
 * Função de tradução fixada num idioma, no namespace `email`. Idioma inválido/
 * ausente cai no fallback (pt-BR). Usada pelos templates e senders.
 */
export function emailT(locale?: string) {
  return i18n.getFixedT(locale || fallbackLocale, 'email')
}
