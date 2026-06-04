import {
  useGetEntitlements,
  usePostEntitlementsTrack,
} from '@repo/api-client/hooks'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

type Metric = {
  metric: string
  limit: number | null
  used: number
  remaining: number | null
  unlimited: boolean
  allowed: boolean
}

/** Métricas medidas (com contador). `seats` é contagem viva — não se "consome". */
const isMetered = (metric: string) => metric !== 'seats'

/**
 * Card "Uso do plano" (#7 Entitlements): mostra consumo vs limite por métrica do
 * plano da org ativa e permite consumir 1 unidade (demo de metering, respeita a
 * quota — 402 ao exceder).
 */
export function PlanUsageCard() {
  const { t } = useTranslation('entitlements')
  const { data, refetch } = useGetEntitlements()
  const track = usePostEntitlementsTrack()

  const usage = data?.data
  const metrics = (usage?.metrics ?? []) as Metric[]
  if (metrics.length === 0) return null

  async function consume(metric: string) {
    try {
      const res = await track.mutateAsync({ data: { metric } })
      const q = res.data
      toast.success(
        t('demo.consumed', {
          used: q.used,
          limit: q.unlimited ? '' : `/${q.limit}`,
        }),
      )
      await refetch()
    } catch {
      toast.error(
        t('demo.exceeded', { metric: t(`metrics.${metric}`, metric) }),
      )
      await refetch()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>
          {t('description')}
          {usage?.period ? ` · ${t('period', { period: usage.period })}` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {metrics.map(m => {
          const pct =
            m.unlimited || !m.limit
              ? 0
              : Math.min(100, Math.round((m.used / m.limit) * 100))
          return (
            <div key={m.metric} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">
                  {t(`metrics.${m.metric}`, m.metric)}
                </span>
                <div className="flex items-center gap-2">
                  {m.unlimited ? (
                    <Badge variant="secondary">{t('unlimited')}</Badge>
                  ) : (
                    <span className="text-muted-foreground tabular-nums">
                      {t('usage', { used: m.used, limit: m.limit })}
                    </span>
                  )}
                  {isMetered(m.metric) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={track.isPending}
                      onClick={() => consume(m.metric)}
                    >
                      {track.isPending
                        ? t('demo.consuming')
                        : t('demo.consume')}
                    </Button>
                  )}
                </div>
              </div>
              {!m.unlimited && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
