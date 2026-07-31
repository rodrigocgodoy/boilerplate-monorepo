import {
  useGetNotificationPreferences,
  useListNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useSendTestNotification,
  useUpdateNotificationPreferences,
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
import { ChevronLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export const Route = createFileRoute('/_app/notifications')({
  component: NotificationsPage,
})

type Channels = { email: boolean; inApp: boolean }
type Prefs = Record<string, Channels>

function NotificationsPage() {
  const { t, i18n } = useTranslation('notifications')
  const qc = useQueryClient()
  const { data, isLoading } = useListNotifications()
  const prefsQuery = useGetNotificationPreferences()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const sendTest = useSendTestNotification()
  const savePrefs = useUpdateNotificationPreferences()

  const items = data?.data.notifications ?? []
  const [prefs, setPrefs] = useState<Prefs>({})

  // Sincroniza o estado local quando as preferências carregam.
  useEffect(() => {
    if (prefsQuery.data?.data.preferences) {
      setPrefs(prefsQuery.data.data.preferences as Prefs)
    }
  }, [prefsQuery.data])

  const refresh = () =>
    qc.invalidateQueries({ queryKey: [{ url: '/notifications' }] })

  const when = (iso: string) =>
    new Date(iso).toLocaleString(i18n.resolvedLanguage)

  async function handleMarkRead(id: string) {
    await markRead.mutateAsync({ id })
    refresh()
  }

  async function handleMarkAll() {
    await markAll.mutateAsync(undefined)
    refresh()
  }

  async function handleTest() {
    await sendTest.mutateAsync(undefined)
    refresh()
  }

  function toggle(category: string, channel: keyof Channels) {
    setPrefs(p => ({
      ...p,
      [category]: { ...p[category], [channel]: !p[category]?.[channel] },
    }))
  }

  async function handleSavePrefs() {
    try {
      await savePrefs.mutateAsync({ data: { preferences: prefs } })
      toast.success(t('preferences.saved'))
      prefsQuery.refetch()
    } catch {
      toast.error(t('preferences.saveFailed'))
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl">{t('title')}</h1>
          <p className="text-muted-foreground text-sm">{t('description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={sendTest.isPending}
          >
            {sendTest.isPending ? t('sending') : t('sendTest')}
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard">
              <ChevronLeft className="size-4" />
              {t('back')}
            </Link>
          </Button>
        </div>
      </header>

      {/* Lista */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>{t('title')}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAll}
            disabled={markAll.isPending || items.length === 0}
          >
            {t('markAllRead')}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">…</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('empty')}</p>
          ) : (
            items.map(n => (
              <button
                type="button"
                key={n.id}
                onClick={() => !n.read && handleMarkRead(n.id)}
                className={`flex flex-col gap-1 rounded-md border p-3 text-left ${n.read ? 'opacity-60' : 'bg-accent/30'}`}
              >
                <div className="flex items-center gap-2">
                  {!n.read && (
                    <span className="size-2 rounded-full bg-primary" />
                  )}
                  <span className="font-medium text-sm">{n.title}</span>
                  <Badge variant="secondary" className="ml-auto">
                    {t(`categories.${n.category}`, n.category)}
                  </Badge>
                </div>
                {n.body && (
                  <span className="text-muted-foreground text-sm">
                    {n.body}
                  </span>
                )}
                <span className="text-muted-foreground text-xs">
                  {when(n.createdAt)}
                </span>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      {/* Preferências */}
      <Card>
        <CardHeader>
          <CardTitle>{t('preferences.title')}</CardTitle>
          <CardDescription>{t('preferences.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('preferences.category')}</TableHead>
                <TableHead className="text-center">
                  {t('preferences.inApp')}
                </TableHead>
                <TableHead className="text-center">
                  {t('preferences.email')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.keys(prefs).map(category => (
                <TableRow key={category}>
                  <TableCell>{t(`categories.${category}`, category)}</TableCell>
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      checked={prefs[category]?.inApp ?? false}
                      onChange={() => toggle(category, 'inApp')}
                      aria-label={`${category} in-app`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      checked={prefs[category]?.email ?? false}
                      onChange={() => toggle(category, 'email')}
                      aria-label={`${category} email`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div>
            <Button onClick={handleSavePrefs} disabled={savePrefs.isPending}>
              {savePrefs.isPending
                ? t('preferences.saving')
                : t('preferences.save')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
