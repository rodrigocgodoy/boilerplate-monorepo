import { Heading, Text } from '@react-email/components'
import { CtaButton, EmailLayout } from './_layout.js'

export interface VerificationEmailProps {
  name?: string
  url: string
}

export default function VerificationEmail({
  name,
  url,
}: VerificationEmailProps) {
  return (
    <EmailLayout preview="Confirme seu e-mail">
      <Heading className="m-0 text-gray-900 text-xl">
        Confirme seu e-mail
      </Heading>
      <Text className="text-gray-700 text-sm">
        Olá{name ? ` ${name}` : ''}, confirme seu endereço de e-mail para ativar
        a sua conta.
      </Text>
      <CtaButton href={url}>Confirmar e-mail</CtaButton>
      <Text className="text-gray-400 text-xs">
        Se você não criou esta conta, ignore este e-mail.
      </Text>
    </EmailLayout>
  )
}

VerificationEmail.PreviewProps = {
  name: 'Maria',
  url: 'https://example.com/verify/abc123',
} satisfies VerificationEmailProps
