export const locales = ['pt-BR', 'en', 'es'] as const

export type Locale = (typeof locales)[number]

/** Idioma padrão e de fallback */
export const defaultLocale: Locale = 'pt-BR'
export const fallbackLocale: Locale = 'pt-BR'

/** Namespaces das mensagens (agrupamento por área) */
export const namespaces = [
  'common',
  'auth',
  'validation',
  'dashboard',
  'payment',
  'subscription',
  'organization',
  'admin',
  'entitlements',
  'audit',
  'apiKeys',
  'account',
  'notifications',
  'storage',
  'email',
] as const

export type Namespace = (typeof namespaces)[number]

export const defaultNS = 'common' as const
