import type { ReactElement } from 'react'
import { Resend } from 'resend'
import OrganizationInvitationEmail from './emails/organization-invitation.js'
import ResetPasswordEmail from './emails/reset-password.js'
import SubscriptionEmail from './emails/subscription.js'
import VerificationEmail from './emails/verification.js'

const apiKey = process.env.RESEND_API_KEY
const from = process.env.EMAIL_FROM || 'Boilerplate <onboarding@resend.dev>'
const resend = apiKey ? new Resend(apiKey) : null

/** `true` quando o Resend está configurado (RESEND_API_KEY presente). */
export const emailEnabled = Boolean(apiKey)

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
}) {
  return deliver(
    p.to,
    'Confirme seu e-mail',
    <VerificationEmail name={p.name} url={p.url} />,
    p.url,
  )
}

export function sendPasswordResetEmail(p: {
  to: string
  name?: string
  otp: string
}) {
  return deliver(
    p.to,
    'Redefinir sua senha',
    <ResetPasswordEmail name={p.name} otp={p.otp} />,
    `código: ${p.otp}`,
  )
}

export function sendOrganizationInvitationEmail(p: {
  to: string
  organizationName: string
  inviterName?: string
  url: string
}) {
  return deliver(
    p.to,
    `Convite para ${p.organizationName}`,
    <OrganizationInvitationEmail
      inviterName={p.inviterName}
      organizationName={p.organizationName}
      url={p.url}
    />,
    p.url,
  )
}

export function sendSubscriptionEmail(p: {
  to: string
  organizationName: string
  planName: string
  status: 'active' | 'cancelled'
}) {
  return deliver(
    p.to,
    p.status === 'active' ? 'Assinatura ativa' : 'Assinatura cancelada',
    <SubscriptionEmail
      organizationName={p.organizationName}
      planName={p.planName}
      status={p.status}
    />,
  )
}
