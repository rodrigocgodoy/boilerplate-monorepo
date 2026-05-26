import {
  useGetPayments,
  useGetPlans,
  useGetSubscription,
  usePostSubscription,
  usePostSubscriptionCancel,
} from '@repo/api-client/hooks'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/table'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export const Route = createFileRoute('/_app/subscription')({
  component: Subscription,
})

type IntervalKey = 'WEEKLY' | 'MONTHLY' | 'SEMIANNUALLY' | 'ANNUALLY'
type StatusKey =
  | 'ACTIVE'
  | 'TRIALING'
  | 'PAST_DUE'
  | 'CANCELLED'
  | 'INCOMPLETE'
  | 'EXPIRED'

function Subscription() {
  const { t, i18n } = useTranslation(['subscription', 'common'])
  const queryClient = useQueryClient()
  const locale = i18n.resolvedLanguage

  const subQuery = useGetSubscription()
  const plansQuery = useGetPlans()
  const paymentsQuery = useGetPayments()
  const subscribe = usePostSubscription()
  const cancel = usePostSubscriptionCancel()

  const current = subQuery.data?.data.subscription ?? null
  const isActive = subQuery.data?.data.isActive ?? false
  const plans = plansQuery.data?.data.plans ?? []
  const payments = paymentsQuery.data?.data.payments ?? []

  const money = (cents: number, currency = 'BRL') =>
    new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
      cents / 100,
    )
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale)

  async function handleSubscribe(planSlug: string) {
    try {
      const res = await subscribe.mutateAsync({ data: { planSlug } })
      // Redireciona para o checkout do AbacatePay.
      window.location.href = res.data.url
    } catch {
      toast.error(t('subscription:subscribeFailed'))
    }
  }

  async function handleCancel() {
    if (!window.confirm(t('subscription:cancelConfirm'))) return
    try {
      await cancel.mutateAsync()
      toast.success(t('subscription:cancelled'))
      await queryClient.invalidateQueries()
    } catch {
      toast.error(t('subscription:subscribeFailed'))
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl">{t('subscription:title')}</h1>
          <p className="text-muted-foreground text-sm">
            {t('subscription:description')}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/premium">{t('subscription:premiumTitle')}</Link>
        </Button>
      </header>

      {/* Plano atual */}
      <Card>
        <CardHeader>
          <CardTitle>{t('subscription:currentPlan')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isActive && current ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{current.plan.name}</span>
                <Badge>
                  {t(`subscription:status.${current.status as StatusKey}`)}
                </Badge>
              </div>
              {current.trialEndsAt ? (
                <span className="text-muted-foreground text-sm">
                  {t('subscription:trialEndsOn', {
                    date: date(current.trialEndsAt),
                  })}
                </span>
              ) : current.currentPeriodEnd ? (
                <span className="text-muted-foreground text-sm">
                  {t('subscription:renewsOn', {
                    date: date(current.currentPeriodEnd),
                  })}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              {t('subscription:noPlan')}
            </p>
          )}
        </CardContent>
        {isActive && (
          <CardFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={cancel.isPending}
            >
              {cancel.isPending
                ? t('subscription:cancelling')
                : t('subscription:cancel')}
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Catálogo de planos */}
      <section className="grid gap-4 sm:grid-cols-3">
        {plans.map(plan => {
          const isCurrent = current?.plan.id === plan.id && isActive
          return (
            <Card key={plan.id} className="flex flex-col">
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="font-semibold text-xl">
                  {plan.priceCents === 0
                    ? t('subscription:free')
                    : money(plan.priceCents, plan.currency)}
                  {plan.priceCents > 0 && (
                    <span className="font-normal text-muted-foreground text-sm">
                      {t(
                        `subscription:perInterval.${plan.interval as IntervalKey}`,
                      )}
                    </span>
                  )}
                </p>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  disabled={
                    isCurrent || plan.priceCents === 0 || subscribe.isPending
                  }
                  onClick={() => handleSubscribe(plan.slug)}
                >
                  {isCurrent
                    ? t(`subscription:status.ACTIVE`)
                    : subscribe.isPending
                      ? t('subscription:subscribing')
                      : t('subscription:subscribe')}
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </section>

      {/* Histórico de pagamentos */}
      <Card>
        <CardHeader>
          <CardTitle>{t('subscription:history')}</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t('subscription:historyEmpty')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('subscription:columns.date')}</TableHead>
                  <TableHead>{t('subscription:columns.description')}</TableHead>
                  <TableHead>{t('subscription:columns.amount')}</TableHead>
                  <TableHead>{t('subscription:columns.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{date(p.createdAt)}</TableCell>
                    <TableCell>{p.description ?? p.kind}</TableCell>
                    <TableCell>{money(p.amount)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={p.status === 'PAID' ? 'default' : 'secondary'}
                      >
                        {p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
