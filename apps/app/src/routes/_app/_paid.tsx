import { getSubscriptionQueryOptions } from '@repo/api-client/hooks'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

/**
 * Layout pathless que bloqueia features por plano. Qualquer rota em
 * `_app/_paid/*` herda este guard.
 *
 * O gating é decidido pelo servidor (`gatingEnabled`, derivado de
 * REQUIRE_ACTIVE_PLAN) — fonte única. Se ligado e sem plano ativo, redireciona
 * para `/subscription`. Lembre: isto é só UX; a barreira real é o
 * `requireActivePlan` no backend.
 */
export const Route = createFileRoute('/_app/_paid')({
  beforeLoad: async ({ context }) => {
    const { data } = await context.queryClient.ensureQueryData(
      getSubscriptionQueryOptions(),
    )
    if (data.gatingEnabled && !data.isActive) {
      throw redirect({ to: '/subscription' })
    }
  },
  component: () => <Outlet />,
})
