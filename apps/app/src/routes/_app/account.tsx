import { Button } from '@repo/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
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
import { getApiBaseUrl } from '@repo/utils/api-url'
import { authClient } from '@repo/utils/auth-client'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AvatarUpload } from '@/components/avatar-upload'

export const Route = createFileRoute('/_app/account')({
  component: AccountPage,
})

function AccountPage() {
  const { t } = useTranslation(['account', 'storage'])
  const router = useRouter()
  const queryClient = useQueryClient()
  const [exporting, setExporting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch(`${getApiBaseUrl()}/me/export`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'meus-dados.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error(t('export.failed'))
    } finally {
      setExporting(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await authClient.deleteUser({ password })
    setDeleting(false)
    if (res.error) {
      toast.error(res.error.message ?? t('delete.failed'))
      return
    }
    toast.success(t('delete.done'))
    queryClient.clear()
    await router.navigate({ to: '/login' })
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
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

      {/* Foto de perfil (avatar) */}
      <Card>
        <CardHeader>
          <CardTitle>{t('storage:avatar.title')}</CardTitle>
          <CardDescription>{t('storage:avatar.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarUpload />
        </CardContent>
      </Card>

      {/* Exportar dados (LGPD/GDPR) */}
      <Card>
        <CardHeader>
          <CardTitle>{t('export.title')}</CardTitle>
          <CardDescription>{t('export.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            {exporting ? t('export.exporting') : t('export.action')}
          </Button>
        </CardContent>
      </Card>

      {/* Danger zone — excluir conta */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">
            {t('delete.title')}
          </CardTitle>
          <CardDescription>{t('delete.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            {t('delete.action')}
          </Button>
        </CardContent>
      </Card>

      {/* Confirmação com senha */}
      <Dialog
        open={confirmOpen}
        onOpenChange={open => {
          setConfirmOpen(open)
          if (!open) setPassword('')
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('delete.confirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('delete.confirmDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Label htmlFor="confirm-password">{t('delete.password')}</Label>
            <Input
              id="confirm-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={deleting}
            >
              {t('delete.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || !password}
            >
              {deleting ? t('delete.deleting') : t('delete.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
