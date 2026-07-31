import './styles/global.css'
import './i18n'

import NiceModal from '@ebay/nice-modal-react'
import { setupApiClient } from '@repo/api-client/setup'
import { Toaster } from '@repo/ui/components/sonner'
import {
  keepPreviousData,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { capturePageview, initAnalytics } from './analytics'
import { initObservability, ObservabilityBoundary } from './observability'
// Import com efeito colateral: registra os modais por id. Precisa vir antes do
// primeiro `show()`, e uma vez só — por isso mora aqui, no entrypoint.
import './stores/modals/register-modals'
import { routeTree } from './routeTree.gen'

// Observabilidade (Sentry) — no-op sem VITE_SENTRY_DSN. Antes do render.
initObservability()
// Analytics (PostHog) — no-op sem VITE_POSTHOG_KEY.
initAnalytics()

setupApiClient()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      placeholderData: keepPreviousData,
    },
  },
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 30_000,
})

// Captura pageview a cada navegação resolvida (SPA). No-op sem PostHog.
router.subscribe('onResolved', () => capturePageview())

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Provider dos modais **dentro** do QueryClientProvider: modal que faz
          mutation precisa enxergar o mesmo QueryClient da árvore. */}
      <NiceModal.Provider>
        <RouterProvider router={router} />
        <Toaster />
      </NiceModal.Provider>
    </QueryClientProvider>
  )
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Failed to find the root element')
}

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <ObservabilityBoundary>
        <App />
      </ObservabilityBoundary>
    </StrictMode>,
  )
}
