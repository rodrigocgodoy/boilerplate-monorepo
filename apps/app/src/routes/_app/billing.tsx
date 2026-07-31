import { useCreatePixCharge, useGetPayment } from '@repo/api-client/hooks'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card'
import { Input } from '@repo/ui/components/input'
import { Label } from '@repo/ui/components/label'
import { Spinner } from '@repo/ui/components/spinner'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export const Route = createFileRoute('/_app/billing')({
  component: Billing,
})

type CreatedPix = {
  id: string
  brCode: string
  brCodeBase64: string
}

function Billing() {
  const { t } = useTranslation(['payment', 'common'])
  const [amount, setAmount] = useState('10,00')
  const [pix, setPix] = useState<CreatedPix | null>(null)

  const createPix = useCreatePixCharge()

  // Polling do status enquanto a cobrança não for paga/expirada.
  const statusQuery = useGetPayment(pix?.id ?? '', {
    query: {
      enabled: !!pix,
      refetchInterval: query =>
        query.state.data?.data.status === 'PAID' ? false : 4000,
    },
  })
  const status = statusQuery.data?.data.status

  async function handleGenerate() {
    const cents = Math.round(Number(amount.replace(',', '.')) * 100)
    if (!Number.isFinite(cents) || cents < 100) {
      toast.error(t('payment:createFailed'))
      return
    }
    try {
      const res = await createPix.mutateAsync({
        data: { amount: cents, description: t('payment:title') },
      })
      setPix({
        id: res.data.id,
        brCode: res.data.brCode,
        brCodeBase64: res.data.brCodeBase64,
      })
    } catch {
      toast.error(t('payment:createFailed'))
    }
  }

  async function handleCopy() {
    if (!pix) return
    await navigator.clipboard.writeText(pix.brCode)
    toast.success(t('payment:copied'))
  }

  // O AbacatePay retorna a imagem em base64; aceita data URI ou base64 puro.
  const qrSrc = pix
    ? pix.brCodeBase64.startsWith('data:')
      ? pix.brCodeBase64
      : `data:image/png;base64,${pix.brCodeBase64}`
    : null

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('payment:title')}</CardTitle>
          <CardDescription>{t('payment:description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!pix ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="amount">{t('payment:amount')}</Label>
                <Input
                  id="amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
              </div>
              <Button onClick={handleGenerate} disabled={createPix.isPending}>
                {createPix.isPending
                  ? t('payment:generating')
                  : t('payment:generate')}
              </Button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4">
              {qrSrc && (
                <img
                  src={qrSrc}
                  alt="QR Code PIX"
                  className="size-56 rounded-md border"
                />
              )}
              <Button variant="outline" className="w-full" onClick={handleCopy}>
                {t('payment:copyCode')}
              </Button>

              {status === 'PAID' ? (
                <Badge>{t('payment:paid')}</Badge>
              ) : status === 'EXPIRED' ? (
                <Badge variant="destructive">{t('payment:expired')}</Badge>
              ) : (
                <span className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Spinner className="size-4" />
                  {t('payment:waiting')}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
