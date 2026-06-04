import { useGetMe } from '@repo/api-client/hooks'
import { Button } from '@repo/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card'
import { Skeleton } from '@repo/ui/components/skeleton'
import { authClient } from '@repo/utils/auth-client'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/language-switcher'
import { OrgSwitcher } from '@/components/org-switcher'

export const Route = createFileRoute('/_app/dashboard')({
  component: Dashboard,
})

function Dashboard() {
  const { t, i18n } = useTranslation([
    'dashboard',
    'common',
    'payment',
    'subscription',
    'organization',
    'admin',
    'audit',
  ])
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data, isLoading } = useGetMe()
  const me = data?.data
  const { data: session } = authClient.useSession()
  const isAdmin =
    (session?.user as { role?: string | null } | undefined)?.role === 'admin'

  async function handleSignOut() {
    await authClient.signOut()
    queryClient.clear()
    await router.navigate({ to: '/login' })
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-semibold text-2xl">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <OrgSwitcher />
          {isAdmin && (
            <Button asChild variant="outline" size="sm">
              <Link to="/admin">{t('admin:nav')}</Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link to="/organization">{t('organization:members')}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/audit">{t('audit:nav')}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/subscription">{t('subscription:title')}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/billing">{t('payment:title')}</Link>
          </Button>
          <LanguageSwitcher />
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            {t('common:signOut')}
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t('authenticatedUser')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {isLoading || !me ? (
            <>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-64" />
            </>
          ) : (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">{t('fields.name')}</dt>
              <dd>{me.name}</dd>
              <dt className="text-muted-foreground">{t('fields.email')}</dt>
              <dd>{me.email}</dd>
              <dt className="text-muted-foreground">{t('fields.id')}</dt>
              <dd className="font-mono text-xs">{me.id}</dd>
              <dt className="text-muted-foreground">{t('fields.createdAt')}</dt>
              <dd>
                {new Date(me.createdAt).toLocaleString(i18n.resolvedLanguage)}
              </dd>
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
