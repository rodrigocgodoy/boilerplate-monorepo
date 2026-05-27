import { authClient } from '@repo/utils/auth-client'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useEffect } from 'react'

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

/**
 * Rede de segurança: garante que há uma organização ativa. A org pessoal é
 * auto-criada no signup, mas a sessão inicial pode vir sem `activeOrganizationId`
 * (race entre criar o usuário e a sessão). Se não houver org ativa e o usuário
 * tiver pelo menos uma, ativa a primeira.
 */
function useEnsureActiveOrganization() {
  const { data: orgs, isPending: orgsPending } =
    authClient.useListOrganizations()
  const { data: active, isPending: activePending } =
    authClient.useActiveOrganization()

  useEffect(() => {
    if (orgsPending || activePending) return
    if (!active && orgs && orgs.length > 0) {
      authClient.organization.setActive({ organizationId: orgs[0].id })
    }
  }, [orgs, active, orgsPending, activePending])
}

function RouteComponent() {
  useEnsureActiveOrganization()
  return <Outlet />
}
