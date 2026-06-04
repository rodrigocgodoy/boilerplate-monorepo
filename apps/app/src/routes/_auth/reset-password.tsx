import { createFileRoute } from '@tanstack/react-router'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'

export const Route = createFileRoute('/_auth/reset-password')({
  // A API redireciona pra cá com ?token= (sucesso) ou ?error= (link inválido).
  validateSearch: (
    search: Record<string, unknown>,
  ): { token?: string; error?: string } => ({
    token: typeof search.token === 'string' ? search.token : undefined,
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  component: ResetPasswordForm,
})
