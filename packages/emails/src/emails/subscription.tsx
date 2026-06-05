import { Heading, Text } from '@react-email/components'
import { emailT } from '../i18n.js'
import { EmailLayout } from './_layout.js'

export interface SubscriptionEmailProps {
  organizationName: string
  planName: string
  status: 'active' | 'cancelled'
  locale?: string
}

export default function SubscriptionEmail({
  organizationName,
  planName,
  status,
  locale,
}: SubscriptionEmailProps) {
  const t = emailT(locale)
  const active = status === 'active'
  const vars = { plan: planName, org: organizationName }
  return (
    <EmailLayout
      preview={
        active
          ? t('subscription.subjectActive')
          : t('subscription.subjectCancelled')
      }
    >
      <Heading className="m-0 text-gray-900 text-xl">
        {active
          ? t('subscription.headingActive')
          : t('subscription.headingCancelled')}
      </Heading>
      <Text className="text-gray-700 text-sm">
        {active
          ? t('subscription.bodyActive', vars)
          : t('subscription.bodyCancelled', vars)}
      </Text>
    </EmailLayout>
  )
}

SubscriptionEmail.PreviewProps = {
  organizationName: 'Acme Inc',
  planName: 'Pro (mensal)',
  status: 'active',
  locale: 'pt-BR',
} satisfies SubscriptionEmailProps
