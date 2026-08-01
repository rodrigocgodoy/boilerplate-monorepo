import { Button } from '@repo/ui/components/button'
import { authClient } from '@repo/utils/auth-client'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

/**
 * Layout e guard do painel. Duas barreiras, nesta ordem: sessão e role de
 * plataforma (`admin`, do plugin admin do Better Auth).
 *
 * Isto é **só UX**. A barreira real está no servidor: cada endpoint
 * `/auth/admin/*` exige a role. Um usuário comum que force a URL daqui não
 * consegue nada da API — vê só uma tela vazia.
 */
export const Route = createFileRoute('/_admin')({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData({
      queryKey: ['session'],
      queryFn: () => authClient.getSession(),
      staleTime: 5 * 60 * 1000,
    })

    if (!session.data) {
      throw redirect({ to: '/login', search: { denied: false } })
    }

    const role = (session.data.user as { role?: string | null }).role
    if (role !== 'admin') {
      // Sem `?redirect=`: quem não é admin não tem para onde ir aqui dentro.
      throw redirect({ to: '/login', search: { denied: true } })
    }

    return { user: session.data.user }
  },
  component: AdminLayout,
})

function AdminLayout() {
  async function handleSignOut() {
    await authClient.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-baseline gap-3">
          <h1 className="font-semibold text-2xl">Administração</h1>
          <span className="text-muted-foreground text-xs uppercase tracking-wide">
            {'plataforma'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            {'Sair'}
          </Button>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
