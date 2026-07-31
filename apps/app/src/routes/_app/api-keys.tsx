import {
  useCreateApiKey,
  useListApiKeys,
  useRevokeApiKey,
} from '@repo/api-client/hooks'
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
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export const Route = createFileRoute('/_app/api-keys')({
  component: ApiKeysPage,
})

function ApiKeysPage() {
  const { t, i18n } = useTranslation('apiKeys')
  const qc = useQueryClient()
  const { data, isLoading } = useListApiKeys()
  const createKey = useCreateApiKey()
  const revokeKey = useRevokeApiKey()

  const [name, setName] = useState('')
  const [days, setDays] = useState('')
  // Token recém-criado, exibido uma única vez.
  const [createdToken, setCreatedToken] = useState<string | null>(null)

  const keys = data?.data.keys ?? []
  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(i18n.resolvedLanguage) : t('never')

  const refresh = () =>
    qc.invalidateQueries({ queryKey: [{ url: '/api-keys' }] })

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const parsedDays = Number(days)
    try {
      const res = await createKey.mutateAsync({
        data: {
          name: name.trim(),
          ...(parsedDays > 0 ? { expiresInDays: parsedDays } : {}),
        },
      })
      setCreatedToken(res.data.key)
      setName('')
      setDays('')
      refresh()
    } catch {
      toast.error(t('createFailed'))
    }
  }

  async function handleRevoke(id: string) {
    if (!window.confirm(t('revokeConfirm'))) return
    await revokeKey.mutateAsync({ id })
    toast.success(t('revoked'))
    refresh()
  }

  async function copyToken() {
    if (!createdToken) return
    await navigator.clipboard.writeText(createdToken)
    toast.success(t('created.copied'))
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
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

      {/* Criar nova chave */}
      <Card>
        <CardHeader>
          <CardTitle>{t('create')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleCreate}
            className="flex flex-wrap items-end gap-2"
          >
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="key-name">{t('name')}</Label>
              <Input
                id="key-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('namePlaceholder')}
                className="min-w-48"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="key-days">{t('expiresInDays')}</Label>
              <Input
                id="key-days"
                type="number"
                min={0}
                value={days}
                onChange={e => setDays(e.target.value)}
                placeholder={t('expiresPlaceholder')}
                className="w-32"
              />
            </div>
            <Button
              type="submit"
              disabled={createKey.isPending || !name.trim()}
            >
              {createKey.isPending ? t('creating') : t('create')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Lista de chaves */}
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.name')}</TableHead>
                <TableHead>{t('columns.prefix')}</TableHead>
                <TableHead>{t('columns.lastUsed')}</TableHead>
                <TableHead>{t('columns.expires')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: skeleton estático
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : keys.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    {t('empty')}
                  </TableCell>
                </TableRow>
              ) : (
                keys.map(k => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {k.prefix}…
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {k.lastUsedAt ? fmt(k.lastUsedAt) : t('neverUsed')}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {fmt(k.expiresAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(k.id)}
                      >
                        {t('revoke')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Token recém-criado — exibido uma única vez */}
      <Dialog
        open={!!createdToken}
        onOpenChange={open => !open && setCreatedToken(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('created.title')}</DialogTitle>
            <DialogDescription>{t('created.description')}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-sm">
              {createdToken}
            </code>
            <Button variant="outline" size="sm" onClick={copyToken}>
              {t('created.copy')}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedToken(null)}>
              {t('created.done')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
