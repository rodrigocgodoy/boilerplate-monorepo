import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu'
import { Input } from '@repo/ui/components/input'
import { Label } from '@repo/ui/components/label'
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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { MoreHorizontal } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export const Route = createFileRoute('/_app/admin/')({
  component: AdminUsersPage,
})

const PAGE_SIZE = 10

type AdminUser = {
  id: string
  name: string
  email: string
  role?: string | null
  banned?: boolean | null
  createdAt: string | Date
}

function AdminUsersPage() {
  const { t, i18n } = useTranslation('admin')
  const qc = useQueryClient()
  const router = useRouter()

  const { data: session } = authClient.useSession()
  const meId = session?.user.id

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  // Diálogos controlados (um por vez) por usuário-alvo.
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)

  const queryKey = ['admin', 'users', { search, page }] as const
  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await authClient.admin.listUsers({
        query: {
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
          sortBy: 'createdAt',
          sortDirection: 'desc',
          ...(search
            ? { searchField: 'email' as const, searchValue: search }
            : {}),
        },
      })
      if (res.error) throw new Error(res.error.message ?? 'listUsersFailed')
      return res.data
    },
  })

  const users = (data?.users ?? []) as AdminUser[]
  const total = data?.total ?? 0
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, total)
  const hasNext = (page + 1) * PAGE_SIZE < total

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'users'] })

  function handleSearch(e: FormEvent) {
    e.preventDefault()
    setPage(0)
    setSearch(searchInput.trim())
  }

  /** Executa uma ação do plugin admin e trata erro/sucesso de forma uniforme. */
  async function run(
    action: () => Promise<{ error?: { message?: string } | null }>,
    successKey:
      | 'toasts.roleChanged'
      | 'toasts.unbanned'
      | 'toasts.sessionsRevoked',
  ) {
    const res = await action()
    if (res.error) {
      toast.error(res.error.message ?? t('actionFailed'))
      return false
    }
    toast.success(t(successKey))
    refresh()
    return true
  }

  async function handleToggleRole(u: AdminUser) {
    const next = u.role === 'admin' ? 'user' : 'admin'
    await run(
      () => authClient.admin.setRole({ userId: u.id, role: next }),
      'toasts.roleChanged',
    )
  }

  async function handleUnban(u: AdminUser) {
    await run(
      () => authClient.admin.unbanUser({ userId: u.id }),
      'toasts.unbanned',
    )
  }

  async function handleRevokeSessions(u: AdminUser) {
    await run(
      () => authClient.admin.revokeUserSessions({ userId: u.id }),
      'toasts.sessionsRevoked',
    )
  }

  async function handleImpersonate(u: AdminUser) {
    const res = await authClient.admin.impersonateUser({ userId: u.id })
    if (res.error) {
      toast.error(res.error.message ?? t('actionFailed'))
      return
    }
    // A sessão foi trocada — invalida o cache de sessão do guard e volta ao app.
    await qc.invalidateQueries({ queryKey: ['session'] })
    await router.navigate({ to: '/dashboard' })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>{t('users')}</CardTitle>
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <Input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-56"
          />
          <Button type="submit" variant="outline" size="sm">
            {t('searchAction')}
          </Button>
        </form>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.user')}</TableHead>
              <TableHead>{t('columns.role')}</TableHead>
              <TableHead>{t('columns.status')}</TableHead>
              <TableHead>{t('columns.createdAt')}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton estático
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground"
                >
                  {t('noUsers')}
                </TableCell>
              </TableRow>
            ) : (
              users.map(u => {
                const isSelf = u.id === meId
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{u.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {u.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={u.role === 'admin' ? 'default' : 'secondary'}
                      >
                        {t(`roles.${u.role === 'admin' ? 'admin' : 'user'}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.banned ? (
                        <Badge variant="destructive">
                          {t('status.banned')}
                        </Badge>
                      ) : (
                        <Badge variant="outline">{t('status.active')}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(u.createdAt).toLocaleDateString(
                        i18n.resolvedLanguage,
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">
                              {t('columns.actions')}
                            </span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-44">
                          <DropdownMenuItem
                            onSelect={() => handleToggleRole(u)}
                          >
                            {u.role === 'admin'
                              ? t('actions.removeAdmin')
                              : t('actions.makeAdmin')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={isSelf}
                            onSelect={() => handleImpersonate(u)}
                          >
                            {t('actions.impersonate')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => handleRevokeSessions(u)}
                          >
                            {t('actions.revokeSessions')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {u.banned ? (
                            <DropdownMenuItem onSelect={() => handleUnban(u)}>
                              {t('actions.unban')}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              disabled={isSelf}
                              onSelect={() => setBanTarget(u)}
                            >
                              {t('actions.ban')}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={isSelf}
                            onSelect={() => setDeleteTarget(u)}
                          >
                            {t('actions.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        {/* Paginação */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">
            {t('pagination.showing', { from, to, total })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0 || isFetching}
              onClick={() => setPage(p => Math.max(0, p - 1))}
            >
              {t('pagination.prev')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNext || isFetching}
              onClick={() => setPage(p => p + 1)}
            >
              {t('pagination.next')}
            </Button>
          </div>
        </div>
      </CardContent>

      <BanDialog
        user={banTarget}
        onClose={() => setBanTarget(null)}
        onBanned={refresh}
      />
      <DeleteDialog
        user={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={refresh}
      />
    </Card>
  )
}

function BanDialog({
  user,
  onClose,
  onBanned,
}: {
  user: AdminUser | null
  onClose: () => void
  onBanned: () => void
}) {
  const { t } = useTranslation('admin')
  const [reason, setReason] = useState('')
  const [days, setDays] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleBan() {
    if (!user) return
    setBusy(true)
    const parsedDays = Number(days)
    const res = await authClient.admin.banUser({
      userId: user.id,
      ...(reason.trim() ? { banReason: reason.trim() } : {}),
      ...(parsedDays > 0 ? { banExpiresIn: parsedDays * 24 * 60 * 60 } : {}),
    })
    setBusy(false)
    if (res.error) {
      toast.error(res.error.message ?? t('actionFailed'))
      return
    }
    toast.success(t('toasts.banned'))
    setReason('')
    setDays('')
    onBanned()
    onClose()
  }

  return (
    <Dialog open={!!user} onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('ban.title')}</DialogTitle>
          <DialogDescription>
            {t('ban.description', { email: user?.email ?? '' })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ban-reason">{t('ban.reason')}</Label>
            <Input
              id="ban-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={t('ban.reasonPlaceholder')}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ban-days">{t('ban.duration')}</Label>
            <Input
              id="ban-days"
              type="number"
              min={0}
              value={days}
              onChange={e => setDays(e.target.value)}
              placeholder={t('ban.durationPlaceholder')}
            />
            <span className="text-muted-foreground text-xs">
              {t('ban.durationHint')}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t('cancel')}
          </Button>
          <Button variant="destructive" onClick={handleBan} disabled={busy}>
            {busy ? t('ban.banning') : t('ban.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteDialog({
  user,
  onClose,
  onDeleted,
}: {
  user: AdminUser | null
  onClose: () => void
  onDeleted: () => void
}) {
  const { t } = useTranslation('admin')
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (!user) return
    setBusy(true)
    const res = await authClient.admin.removeUser({ userId: user.id })
    setBusy(false)
    if (res.error) {
      toast.error(res.error.message ?? t('actionFailed'))
      return
    }
    toast.success(t('toasts.userDeleted'))
    onDeleted()
    onClose()
  }

  return (
    <Dialog open={!!user} onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('delete.title')}</DialogTitle>
          <DialogDescription>
            {t('delete.description', { email: user?.email ?? '' })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t('cancel')}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={busy}>
            {busy ? t('delete.deleting') : t('delete.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
