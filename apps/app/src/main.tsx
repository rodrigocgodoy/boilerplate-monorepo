import './styles/global.css'
import './i18n'

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
      <RouterProvider router={router} />
      <Toaster />
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
