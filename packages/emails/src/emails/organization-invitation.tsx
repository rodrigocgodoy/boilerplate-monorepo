import { Heading, Text } from '@react-email/components'
import { CtaButton, EmailLayout } from './_layout.js'

export interface OrganizationInvitationEmailProps {
  organizationName: string
  inviterName?: string
  url: string
}

export default function OrganizationInvitationEmail({
  organizationName,
  inviterName,
  url,
}: OrganizationInvitationEmailProps) {
  return (
    <EmailLayout preview={`Convite para ${organizationName}`}>
      <Heading className="m-0 text-gray-900 text-xl">
        Você foi convidado
      </Heading>
      <Text className="text-gray-700 text-sm">
        {inviterName ? `${inviterName} convidou você` : 'Você foi convidado'}{' '}
        para participar de <strong>{organizationName}</strong>.
      </Text>
      <CtaButton href={url}>Aceitar convite</CtaButton>
      <Text className="text-gray-400 text-xs">
        Se você não esperava este convite, pode ignorar este e-mail.
      </Text>
    </EmailLayout>
  )
}

OrganizationInvitationEmail.PreviewProps = {
  organizationName: 'Acme Inc',
  inviterName: 'Rodrigo',
  url: 'https://example.com/accept-invitation/abc123',
} satisfies OrganizationInvitationEmailProps
