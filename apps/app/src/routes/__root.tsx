import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="relative mx-auto flex min-h-screen w-full flex-col bg-background">
      <Outlet />
    </div>
  )
}
