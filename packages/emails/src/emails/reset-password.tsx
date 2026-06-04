import { Heading, Section, Text } from '@react-email/components'
import { EmailLayout } from './_layout.js'

export interface ResetPasswordEmailProps {
  name?: string
  otp: string
}

export default function ResetPasswordEmail({
  name,
  otp,
}: ResetPasswordEmailProps) {
  return (
    <EmailLayout preview="Seu código para redefinir a senha">
      <Heading className="m-0 text-gray-900 text-xl">Redefinir senha</Heading>
      <Text className="text-gray-700 text-sm">
        Olá{name ? ` ${name}` : ''}, use o código abaixo para criar uma nova
        senha. Ele expira em 5 minutos.
      </Text>
      <Section className="my-4 rounded-md bg-gray-100 py-4 text-center">
        <Text className="m-0 font-bold font-mono text-3xl text-gray-900 tracking-[0.3em]">
          {otp}
        </Text>
      </Section>
      <Text className="text-gray-400 text-xs">
        Se você não solicitou, ignore este e-mail — sua senha continua a mesma.
      </Text>
    </EmailLayout>
  )
}

ResetPasswordEmail.PreviewProps = {
  name: 'Maria',
  otp: '123456',
} satisfies ResetPasswordEmailProps
