import type { ReactElement } from 'react'
import { Resend } from 'resend'
import NotificationEmail from './emails/notification.js'
import OrganizationInvitationEmail from './emails/organization-invitation.js'
import ResetPasswordEmail from './emails/reset-password.js'
import SubscriptionEmail from './emails/subscription.js'
import VerificationEmail from './emails/verification.js'
import { emailT } from './i18n.js'

const apiKey = process.env.RESEND_API_KEY
const from = process.env.EMAIL_FROM || 'Boilerplate <onboarding@resend.dev>'
const resend = apiKey ? new Resend(apiKey) : null

/** `true` quando o Resend está configurado (RESEND_API_KEY presente). */
export const emailEnabled = Boolean(apiKey)

// Helper de i18n dos e-mails (namespace `email`) — útil para localizar assuntos
// ou textos fora dos templates.
export { emailT } from './i18n.js'

async function deliver(
  to: string,
  subject: string,
  react: ReactElement,
  devUrl?: string,
): Promise<void> {
  if (!resend) {
    // Sem RESEND_API_KEY: loga (dev) em vez de enviar. Ver UPGRADES.md.
    console.info(
      `[email:dev] → ${to} · ${subject}${devUrl ? ` · ${devUrl}` : ''}`,
    )
    return
  }
  const { error } = await resend.emails.send({ from, to, subject, react })
  if (error) {
    console.error('[email] falha ao enviar:', error)
  }
}

export function sendVerificationEmail(p: {
  to: string
  name?: string
  url: string
  locale?: string
}) {
  return deliver(
    p.to,
    emailT(p.locale)('verification.subject'),
    <VerificationEmail name={p.name} url={p.url} locale={p.locale} />,
    p.url,
  )
}

export function sendPasswordResetEmail(p: {
  to: string
  name?: string
  otp: string
  locale?: string
}) {
  return deliver(
    p.to,
    emailT(p.locale)('reset.subject'),
    <ResetPasswordEmail name={p.name} otp={p.otp} locale={p.locale} />,
    `código: ${p.otp}`,
  )
}

export function sendOrganizationInvitationEmail(p: {
  to: string
  organizationName: string
  inviterName?: string
  url: string
  locale?: string
}) {
  return deliver(
    p.to,
    emailT(p.locale)('invitation.subject', { org: p.organizationName }),
    <OrganizationInvitationEmail
      inviterName={p.inviterName}
      organizationName={p.organizationName}
      url={p.url}
      locale={p.locale}
    />,
    p.url,
  )
}

export function sendNotificationEmail(p: {
  to: string
  title: string
  body?: string
  url?: string
  locale?: string
}) {
  return deliver(
    p.to,
    p.title,
    <NotificationEmail
      title={p.title}
      body={p.body}
      url={p.url}
      locale={p.locale}
    />,
    p.url,
  )
}

export function sendSubscriptionEmail(p: {
  to: string
  organizationName: string
  planName: string
  status: 'active' | 'cancelled'
  locale?: string
}) {
  const t = emailT(p.locale)
  return deliver(
    p.to,
    p.status === 'active'
      ? t('subscription.subjectActive')
      : t('subscription.subjectCancelled'),
    <SubscriptionEmail
      organizationName={p.organizationName}
      planName={p.planName}
      status={p.status}
      locale={p.locale}
    />,
  )
}
