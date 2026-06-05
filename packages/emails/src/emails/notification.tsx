import { Heading, Text } from '@react-email/components'
import { emailT } from '../i18n.js'
import { CtaButton, EmailLayout } from './_layout.js'

export interface NotificationEmailProps {
  title: string
  body?: string
  /** Link opcional de ação (CTA). */
  url?: string
  locale?: string
}

/** E-mail genérico de notificação (#13) — título + corpo + CTA opcional. O
 * título/corpo vêm do chamador; o CTA é localizado. */
export default function NotificationEmail({
  title,
  body,
  url,
  locale,
}: NotificationEmailProps) {
  const t = emailT(locale)
  return (
    <EmailLayout preview={title}>
      <Heading className="m-0 text-gray-900 text-xl">{title}</Heading>
      {body ? <Text className="text-gray-700 text-sm">{body}</Text> : null}
      {url ? <CtaButton href={url}>{t('notification.cta')}</CtaButton> : null}
    </EmailLayout>
  )
}

NotificationEmail.PreviewProps = {
  title: 'Pagamento confirmado',
  body: 'Recebemos seu pagamento. Obrigado!',
  url: 'https://example.com/billing',
  locale: 'pt-BR',
} satisfies NotificationEmailProps
