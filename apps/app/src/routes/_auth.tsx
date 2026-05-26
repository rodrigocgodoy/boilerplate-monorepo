import { authClient } from '@repo/utils/auth-client'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ context }) => {
    // Mesma fonte (cache do React Query) que o guard de _app, para os dois
    // layouts nunca divergirem e causarem loop de redirect.
    const session = await context.queryClient.ensureQueryData({
      queryKey: ['session'],
      queryFn: () => authClient.getSession(),
      staleTime: 5 * 60 * 1000,
    })

    if (session.data) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Outlet />
    </div>
  )
}
