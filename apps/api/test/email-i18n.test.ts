import { emailT } from '@repo/emails'
import { describe, expect, it } from 'vitest'

/**
 * Multi-idioma dos e-mails: o `emailT(locale)` resolve o namespace `email` do
 * `@repo/i18n` por idioma, com interpolação e fallback. Sem render/Resend.
 */
describe('emailT (i18n dos e-mails)', () => {
  it('traduz o mesmo key por idioma', () => {
    expect(emailT('pt-BR')('verification.subject')).toBe('Confirme seu e-mail')
    expect(emailT('en')('verification.subject')).toBe('Confirm your email')
    expect(emailT('es')('verification.subject')).toBe('Confirma tu email')
  })

  it('interpola variáveis', () => {
    expect(emailT('en')('invitation.subject', { org: 'Acme' })).toBe(
      'Invitation to Acme',
    )
    expect(emailT('pt-BR')('invitation.subject', { org: 'Acme' })).toBe(
      'Convite para Acme',
    )
  })

  it('idioma inválido cai no fallback (pt-BR)', () => {
    expect(emailT('xx')('reset.subject')).toBe(emailT('pt-BR')('reset.subject'))
  })
})
