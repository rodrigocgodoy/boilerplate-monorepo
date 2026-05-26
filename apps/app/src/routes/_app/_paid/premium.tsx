import { useGetPremium } from '@repo/api-client/hooks'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card'
import { Spinner } from '@repo/ui/components/spinner'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

/**
 * Feature de exemplo protegida por plano. Fica sob `_app/_paid`, então só
 * carrega quando o guard libera (gating off, ou plano ativo). O dado vem de
 * `GET /premium`, que também é guardado no servidor por `requireActivePlan`.
 */
export const Route = createFileRoute('/_app/_paid/premium')({
  component: Premium,
})

function Premium() {
  const { t } = useTranslation('subscription')
  const { data, isLoading } = useGetPremium()

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('premiumTitle')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <Spinner /> : <p>{data?.data.message}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
