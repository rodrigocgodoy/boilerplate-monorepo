import { Button } from '@repo/ui/components/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card'
import { Spinner } from '@repo/ui/components/spinner'
import { authClient } from '@repo/utils/auth-client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

/**
 * Aceitar convite de organização (sob `_app`, exige login). A página BUSCA o
 * convite antes de mostrar o botão: o Better Auth só retorna o convite para o
 * destinatário (mesmo e-mail) e com e-mail verificado. Assim mostramos o estado
 * certo — "não é para você", "verifique o e-mail", "inválido" ou aceitar.
 */
export const Route = createFileRoute('/_app/accept-invitation/$invitationId')({
  component: AcceptInvitation,
})

function AcceptInvitation() {
  const { t } = useTranslation('organization')
  const { invitationId } = Route.useParams()
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)

  const { data, isPending } = useQuery({
    queryKey: ['invitation', invitationId],
    queryFn: () =>
      authClient.organization.getInvitation({ query: { id: invitationId } }),
    retry: false,
  })
  const invitation = data?.data
  const errorCode = data?.error?.code

  async function accept() {
    setBusy(true)
    const res = await authClient.organization.acceptInvitation({ invitationId })
    setBusy(false)
    if (res.error) {
      toast.error(res.error.message ?? t('accept.failed'))
      return
    }
    toast.success(t('accept.accepted'))
    router.invalidate()
    await navigate({ to: '/organization' })
  }

  async function switchAccount() {
    await authClient.signOut()
    // Limpa a sessão do cache para os guards não enxergarem a sessão antiga.
    queryClient.removeQueries({ queryKey: ['session'] })
    router.history.push(`/login?redirect=/accept-invitation/${invitationId}`)
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('accept.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <AcceptBody
            accept={accept}
            busy={busy}
            errorCode={errorCode}
            invitation={invitation}
            isPending={isPending}
            onSwitchAccount={switchAccount}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function Message({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>
}

function AcceptBody({
  isPending,
  errorCode,
  invitation,
  busy,
  accept,
  onSwitchAccount,
}: {
  isPending: boolean
  errorCode?: string
  invitation?: { organizationName?: string } | null
  busy: boolean
  accept: () => void
  onSwitchAccount: () => void
}) {
  const { t } = useTranslation('organization')

  if (isPending) return <Spinner />

  // Logado com outro e-mail (ou é quem convidou): não é o destinatário.
  if (errorCode === 'YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION') {
    return (
      <>
        <Message>
          {t('accept.notForYou')} {t('accept.useInviteEmail')}
        </Message>
        <Button variant="outline" onClick={onSwitchAccount}>
          {t('accept.switchAccount')}
        </Button>
      </>
    )
  }

  if (errorCode === 'EMAIL_VERIFICATION_REQUIRED_FOR_INVITATION') {
    return <Message>{t('accept.verifyFirst')}</Message>
  }

  if (!invitation) {
    return <Message>{t('accept.invalid')}</Message>
  }

  return (
    <>
      <Message>
        {t('accept.invitedTo', { org: invitation.organizationName ?? '' })}
      </Message>
      <Button onClick={accept} disabled={busy}>
        {busy ? t('accept.accepting') : t('accept.cta')}
      </Button>
    </>
  )
}
