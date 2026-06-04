import { Heading, Text } from '@react-email/components'
import { CtaButton, EmailLayout } from './_layout.js'

export interface NotificationEmailProps {
  title: string
  body?: string
  /** Link opcional de ação (CTA). */
  url?: string
}

/** E-mail genérico de notificação (#13) — título + corpo + CTA opcional. */
export default function NotificationEmail({
  title,
  body,
  url,
}: NotificationEmailProps) {
  return (
    <EmailLayout preview={title}>
      <Heading className="m-0 text-gray-900 text-xl">{title}</Heading>
      {body ? <Text className="text-gray-700 text-sm">{body}</Text> : null}
      {url ? <CtaButton href={url}>Ver detalhes</CtaButton> : null}
    </EmailLayout>
  )
}

NotificationEmail.PreviewProps = {
  title: 'Pagamento confirmado',
  body: 'Recebemos seu pagamento. Obrigado!',
  url: 'https://example.com/billing',
} satisfies NotificationEmailProps
