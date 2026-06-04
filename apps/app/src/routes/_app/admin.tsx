import { Button } from '@repo/ui/components/button'
import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * Área de administração de plataforma (`/admin/*`), guardada pela role de
 * sistema do plugin `admin` do Better Auth — distinta dos papéis por
 * organização. Quem não é `admin` é redirecionado pro dashboard.
 *
 * Isto é só UX: a barreira real está no servidor (cada endpoint `/auth/admin/*`
 * exige a role/permissão de admin). Ver UPGRADES.md → "RBAC + painel admin".
 */
export const Route = createFileRoute('/_app/admin')({
  beforeLoad: ({ context }) => {
    // `context.user` vem do guard do `_app` (sessão já garantida). O plugin
    // admin adiciona `role` ao usuário da sessão.
    const role = (context.user as { role?: string | null }).role
    if (role !== 'admin') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: AdminLayout,
})

function AdminLayout() {
  const { t } = useTranslation('admin')
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-semibold text-2xl">{t('title')}</h1>
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard">
            <ChevronLeft className="size-4" />
            {t('backToDashboard')}
          </Link>
        </Button>
      </header>
      <Outlet />
    </div>
  )
}
