import { Heading, Text } from '@react-email/components'
import { EmailLayout } from './_layout.js'

export interface SubscriptionEmailProps {
  organizationName: string
  planName: string
  status: 'active' | 'cancelled'
}

export default function SubscriptionEmail({
  organizationName,
  planName,
  status,
}: SubscriptionEmailProps) {
  const active = status === 'active'
  return (
    <EmailLayout
      preview={active ? 'Sua assinatura está ativa' : 'Assinatura cancelada'}
    >
      <Heading className="m-0 text-gray-900 text-xl">
        {active ? 'Assinatura ativa 🎉' : 'Assinatura cancelada'}
      </Heading>
      <Text className="text-gray-700 text-sm">
        {active
          ? `O plano ${planName} de ${organizationName} está ativo. Obrigado!`
          : `A assinatura do plano ${planName} de ${organizationName} foi cancelada.`}
      </Text>
    </EmailLayout>
  )
}

SubscriptionEmail.PreviewProps = {
  organizationName: 'Acme Inc',
  planName: 'Pro (mensal)',
  status: 'active',
} satisfies SubscriptionEmailProps
