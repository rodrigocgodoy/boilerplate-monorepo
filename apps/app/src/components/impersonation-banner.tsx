import { Button } from '@repo/ui/components/button'
import { authClient } from '@repo/utils/auth-client'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Banner global exibido enquanto um admin está impersonando outro usuário
 * (sessão com `impersonatedBy`). Permite encerrar a impersonation e voltar à
 * conta de admin. Renderizado no layout `_app`.
 */
export function ImpersonationBanner() {
  const { t } = useTranslation('admin')
  const qc = useQueryClient()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const { data: session } = authClient.useSession()

  const impersonating = Boolean(
    (session?.session as { impersonatedBy?: string | null } | undefined)
      ?.impersonatedBy,
  )
  if (!impersonating) return null

  async function handleStop() {
    setBusy(true)
    await authClient.admin.stopImpersonating()
    await qc.invalidateQueries({ queryKey: ['session'] })
    setBusy(false)
    await router.navigate({ to: '/admin' })
  }

  return (
    <div className="flex items-center justify-center gap-3 bg-amber-500/15 px-4 py-2 text-amber-900 text-sm dark:text-amber-200">
      <span>{t('impersonation.banner', { name: session?.user.name })}</span>
      <Button size="sm" variant="outline" onClick={handleStop} disabled={busy}>
        {t('impersonation.stop')}
      </Button>
    </div>
  )
}
