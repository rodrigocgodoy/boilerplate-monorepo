import { authClient } from '@repo/utils/auth-client'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData({
      queryKey: ['session'],
      queryFn: () => authClient.getSession(),
      staleTime: 5 * 60 * 1000,
    })

    if (!session.data) {
      throw redirect({ to: '/login' })
    }

    return {
      user: session.data.user,
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  return <Outlet />
}
