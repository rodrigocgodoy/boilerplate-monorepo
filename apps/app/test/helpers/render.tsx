import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'

/**
 * `render` do Testing Library com os providers que o app assume existir.
 *
 * O idioma é fixado em **pt-BR**: sem isso, o i18next detectaria o idioma do
 * jsdom (`navigator.language`, que muda com a máquina/CI) e as asserções de
 * texto passariam ou falhariam conforme o ambiente.
 */

/** QueryClient descartável, sem retry — teste não espera backoff. */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </QueryClientProvider>
  )
}

export async function render(ui: ReactElement) {
  await i18n.changeLanguage('pt-BR')
  return rtlRender(ui, { wrapper: Providers })
}

export { i18n }
