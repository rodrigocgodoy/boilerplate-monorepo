import { Button } from '@repo/ui/components/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card'
import { authClient } from '@repo/utils/auth-client'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

/**
 * Aceitar convite de organização. Fica sob `_app`, então exige login — o
 * convidado precisa estar autenticado (com o mesmo e-mail do convite). Se não
 * estiver logado, o guard manda pro /login; depois é só reabrir o link.
 */
export const Route = createFileRoute('/_app/accept-invitation/$invitationId')({
  component: AcceptInvitation,
})

function AcceptInvitation() {
  const { t } = useTranslation('organization')
  const { invitationId } = Route.useParams()
  const navigate = useNavigate()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function accept() {
    setBusy(true)
    const res = await authClient.organization.acceptInvitation({ invitationId })
    setBusy(false)
    if (res.error) {
      toast.error(t('accept.failed'))
      return
    }
    toast.success(t('accept.accepted'))
    router.invalidate()
    await navigate({ to: '/organization' })
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('accept.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={accept} disabled={busy}>
            {busy ? t('accept.accepting') : t('accept.cta')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
