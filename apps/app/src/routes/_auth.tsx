import { authClient } from '@repo/utils/auth-client'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth')({
  // Captura ?redirect=... (destino a voltar após autenticar).
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  beforeLoad: async ({ context, search }) => {
    // Mesma fonte (cache do React Query) que o guard de _app, para os dois
    // layouts nunca divergirem e causarem loop de redirect.
    const session = await context.queryClient.ensureQueryData({
      queryKey: ['session'],
      queryFn: () => authClient.getSession(),
      staleTime: 5 * 60 * 1000,
    })

    if (session.data) {
      // Já logado: honra o redirect (se houver), senão vai pro dashboard.
      throw redirect({ href: search.redirect || '/dashboard' })
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
