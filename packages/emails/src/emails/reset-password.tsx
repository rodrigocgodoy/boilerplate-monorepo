import { Heading, Section, Text } from '@react-email/components'
import { emailT } from '../i18n.js'
import { EmailLayout } from './_layout.js'

export interface ResetPasswordEmailProps {
  name?: string
  otp: string
  locale?: string
}

export default function ResetPasswordEmail({
  name,
  otp,
  locale,
}: ResetPasswordEmailProps) {
  const t = emailT(locale)
  const greeting = name ? ` ${name}` : ''
  return (
    <EmailLayout preview={t('reset.subject')}>
      <Heading className="m-0 text-gray-900 text-xl">
        {t('reset.heading')}
      </Heading>
      <Text className="text-gray-700 text-sm">
        {t('reset.body', { name: greeting })}
      </Text>
      <Section className="my-4 rounded-md bg-gray-100 py-4 text-center">
        <Text className="m-0 font-bold font-mono text-3xl text-gray-900 tracking-[0.3em]">
          {otp}
        </Text>
      </Section>
      <Text className="text-gray-400 text-xs">{t('reset.ignore')}</Text>
    </EmailLayout>
  )
}

ResetPasswordEmail.PreviewProps = {
  name: 'Maria',
  otp: '123456',
  locale: 'pt-BR',
} satisfies ResetPasswordEmailProps
