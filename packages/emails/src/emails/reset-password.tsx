import { Heading, Text } from '@react-email/components'
import { CtaButton, EmailLayout } from './_layout.js'

export interface ResetPasswordEmailProps {
  name?: string
  url: string
}

export default function ResetPasswordEmail({
  name,
  url,
}: ResetPasswordEmailProps) {
  return (
    <EmailLayout preview="Redefinir sua senha">
      <Heading className="m-0 text-gray-900 text-xl">Redefinir senha</Heading>
      <Text className="text-gray-700 text-sm">
        Olá{name ? ` ${name}` : ''}, recebemos um pedido para redefinir a sua
        senha. Clique abaixo para criar uma nova.
      </Text>
      <CtaButton href={url}>Redefinir senha</CtaButton>
      <Text className="text-gray-400 text-xs">
        Se você não solicitou, ignore este e-mail — sua senha continua a mesma.
      </Text>
    </EmailLayout>
  )
}

ResetPasswordEmail.PreviewProps = {
  name: 'Maria',
  url: 'https://example.com/reset-password/abc123',
} satisfies ResetPasswordEmailProps
