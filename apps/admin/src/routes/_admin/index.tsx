import { env } from '@repo/env/client'
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
import { createFileRoute } from '@tanstack/react-router'
import { MoreHorizontal } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'

export const Route = createFileRoute('/_admin/')({
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
  const qc = useQueryClient()

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
    successMessage: string,
  ) {
    const res = await action()
    if (res.error) {
      toast.error(res.error.message ?? 'Não foi possível concluir a ação.')
      return false
    }
    toast.success(successMessage)
    refresh()
    return true
  }

  async function handleToggleRole(u: AdminUser) {
    const next = u.role === 'admin' ? 'user' : 'admin'
    await run(
      () => authClient.admin.setRole({ userId: u.id, role: next }),
      'Papel atualizado.',
    )
  }

  async function handleUnban(u: AdminUser) {
    await run(
      () => authClient.admin.unbanUser({ userId: u.id }),
      'Usuário desbanido.',
    )
  }

  async function handleRevokeSessions(u: AdminUser) {
    await run(
      () => authClient.admin.revokeUserSessions({ userId: u.id }),
      'Sessões revogadas.',
    )
  }

  async function handleImpersonate(u: AdminUser) {
    const res = await authClient.admin.impersonateUser({ userId: u.id })
    if (res.error) {
      toast.error(res.error.message ?? 'Não foi possível concluir a ação.')
      return
    }
    // A sessão do navegador passou a ser a do usuário-alvo. Impersonar existe
    // para **ver o que ele vê**, e isso acontece no produto — então saímos do
    // painel e entramos no app, onde o `ImpersonationBanner` avisa em que
    // sessão você está e oferece o "parar de impersonar".
    //
    // `window.location` e não `router.navigate`: é outra origem (outro app),
    // e o cache do React Query aqui não deve sobreviver à troca de identidade.
    await qc.invalidateQueries({ queryKey: ['session'] })
    window.location.href = env.VITE_APP_URL
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Usuários</CardTitle>
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <Input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder={'Buscar por e-mail...'}
            className="w-56"
          />
          <Button type="submit" variant="outline" size="sm">
            {'Buscar'}
          </Button>
        </form>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
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
                  {'Nenhum usuário encontrado.'}
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
                        {u.role === 'admin' ? 'Admin' : 'Usuário'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.banned ? (
                        <Badge variant="destructive">{'Banido'}</Badge>
                      ) : (
                        <Badge variant="outline">Ativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">{'Ações'}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-44">
                          <DropdownMenuItem
                            onSelect={() => handleToggleRole(u)}
                          >
                            {u.role === 'admin'
                              ? 'Remover admin'
                              : 'Tornar admin'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={isSelf}
                            onSelect={() => handleImpersonate(u)}
                          >
                            {'Impersonar'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => handleRevokeSessions(u)}
                          >
                            {'Revogar sessões'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {u.banned ? (
                            <DropdownMenuItem onSelect={() => handleUnban(u)}>
                              {'Desbanir'}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              disabled={isSelf}
                              onSelect={() => setBanTarget(u)}
                            >
                              {'Banir'}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={isSelf}
                            onSelect={() => setDeleteTarget(u)}
                          >
                            {'Remover usuário'}
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
            {`Mostrando ${from}–${to} de ${total}`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0 || isFetching}
              onClick={() => setPage(p => Math.max(0, p - 1))}
            >
              {'Anterior'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNext || isFetching}
              onClick={() => setPage(p => p + 1)}
            >
              {'Próxima'}
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
      toast.error(res.error.message ?? 'Não foi possível concluir a ação.')
      return
    }
    toast.success('Usuário banido.')
    setReason('')
    setDays('')
    onBanned()
    onClose()
  }

  return (
    <Dialog open={!!user} onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Banir usuário</DialogTitle>
          <DialogDescription>
            {'Bloquear o acesso de {{email}}. As sessões são revogadas.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ban-reason">Motivo</Label>
            <Input
              id="ban-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={'Opcional'}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ban-days">Duração (dias)</Label>
            <Input
              id="ban-days"
              type="number"
              min={0}
              value={days}
              onChange={e => setDays(e.target.value)}
              placeholder={'0'}
            />
            <span className="text-muted-foreground text-xs">
              {'Deixe 0 ou vazio para banimento permanente.'}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {'Cancelar'}
          </Button>
          <Button variant="destructive" onClick={handleBan} disabled={busy}>
            {busy ? 'Banindo...' : 'Banir'}
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
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (!user) return
    setBusy(true)
    const res = await authClient.admin.removeUser({ userId: user.id })
    setBusy(false)
    if (res.error) {
      toast.error(res.error.message ?? 'Não foi possível concluir a ação.')
      return
    }
    toast.success('Usuário removido.')
    onDeleted()
    onClose()
  }

  return (
    <Dialog open={!!user} onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover usuário</DialogTitle>
          <DialogDescription>
            {'Remover {{email}} permanentemente? Esta ação é irreversível.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {'Cancelar'}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={busy}>
            {busy ? 'Removendo...' : 'Remover'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
