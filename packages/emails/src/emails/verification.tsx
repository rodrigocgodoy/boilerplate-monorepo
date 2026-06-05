import { Heading, Text } from '@react-email/components'
import { emailT } from '../i18n.js'
import { CtaButton, EmailLayout } from './_layout.js'

export interface VerificationEmailProps {
  name?: string
  url: string
  locale?: string
}

export default function VerificationEmail({
  name,
  url,
  locale,
}: VerificationEmailProps) {
  const t = emailT(locale)
  const greeting = name ? ` ${name}` : ''
  return (
    <EmailLayout preview={t('verification.subject')}>
      <Heading className="m-0 text-gray-900 text-xl">
        {t('verification.heading')}
      </Heading>
      <Text className="text-gray-700 text-sm">
        {t('verification.body', { name: greeting })}
      </Text>
      <CtaButton href={url}>{t('verification.cta')}</CtaButton>
      <Text className="text-gray-400 text-xs">{t('verification.ignore')}</Text>
    </EmailLayout>
  )
}

VerificationEmail.PreviewProps = {
  name: 'Maria',
  url: 'https://example.com/verify/abc123',
  locale: 'pt-BR',
} satisfies VerificationEmailProps
