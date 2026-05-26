import { defaultNS, fallbackLocale, locales, resources } from '@repo/i18n'
import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: fallbackLocale,
    supportedLngs: [...locales],
    defaultNS,
    interpolation: { escapeValue: false },
    detection: {
      // Detecta na ordem: preferência salva → idioma do navegador
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    react: { useSuspense: false },
    // Inicializa de forma síncrona (recursos inline, sem backend)
    initImmediate: false,
  })

// Mantém o atributo <html lang> em sincronia com o idioma atual
const applyHtmlLang = (lng: string) => {
  document.documentElement.lang = lng
}
applyHtmlLang(i18n.resolvedLanguage ?? fallbackLocale)
i18n.on('languageChanged', applyHtmlLang)

export default i18n
