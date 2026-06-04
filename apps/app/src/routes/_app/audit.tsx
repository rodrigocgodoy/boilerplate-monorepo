import { useGetAudit } from '@repo/api-client/hooks'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card'
import { Skeleton } from '@repo/ui/components/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/table'
import { authClient } from '@repo/utils/auth-client'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/_app/audit')({
  component: AuditPage,
})

function AuditPage() {
  const { t, i18n } = useTranslation('audit')
  const { data, isLoading } = useGetAudit()
  const { data: session } = authClient.useSession()
  const entries = data?.data.entries ?? []

  const when = (iso: string) =>
    new Date(iso).toLocaleString(i18n.resolvedLanguage)
  const actionLabel = (action: string) =>
    t(`actions.${action.replaceAll('.', '_')}`, { defaultValue: action })

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl">{t('title')}</h1>
          <p className="text-muted-foreground text-sm">{t('description')}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard">
            <ChevronLeft className="size-4" />
            {t('back')}
          </Link>
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.when')}</TableHead>
                <TableHead>{t('columns.action')}</TableHead>
                <TableHead>{t('columns.actor')}</TableHead>
                <TableHead>{t('columns.target')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: skeleton estático
                  <TableRow key={i}>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground"
                  >
                    {t('empty')}
                  </TableCell>
                </TableRow>
              ) : (
                entries.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                      {when(e.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{actionLabel(e.action)}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {e.actorId === session?.user.id
                        ? t('you')
                        : (e.actorId?.slice(0, 8) ?? '—')}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {e.targetId ?? '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
