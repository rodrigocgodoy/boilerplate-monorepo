import 'i18next'
import type { defaultNS } from './config.js'
import type { resources } from './resources.js'

// Type-safety das chaves de tradução: o catálogo pt-BR é a referência.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS
    resources: (typeof resources)['pt-BR']
  }
}
