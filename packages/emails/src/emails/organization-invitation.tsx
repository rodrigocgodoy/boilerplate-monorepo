import { Heading, Text } from '@react-email/components'
import { emailT } from '../i18n.js'
import { CtaButton, EmailLayout } from './_layout.js'

export interface OrganizationInvitationEmailProps {
  organizationName: string
  inviterName?: string
  url: string
  locale?: string
}

export default function OrganizationInvitationEmail({
  organizationName,
  inviterName,
  url,
  locale,
}: OrganizationInvitationEmailProps) {
  const t = emailT(locale)
  return (
    <EmailLayout preview={t('invitation.subject', { org: organizationName })}>
      <Heading className="m-0 text-gray-900 text-xl">
        {t('invitation.heading')}
      </Heading>
      <Text className="text-gray-700 text-sm">
        {inviterName
          ? t('invitation.body', {
              inviter: inviterName,
              org: organizationName,
            })
          : t('invitation.bodyNoInviter', { org: organizationName })}
      </Text>
      <CtaButton href={url}>{t('invitation.cta')}</CtaButton>
      <Text className="text-gray-400 text-xs">{t('invitation.ignore')}</Text>
    </EmailLayout>
  )
}

OrganizationInvitationEmail.PreviewProps = {
  organizationName: 'Acme Inc',
  inviterName: 'Rodrigo',
  url: 'https://example.com/accept-invitation/abc123',
  locale: 'pt-BR',
} satisfies OrganizationInvitationEmailProps
