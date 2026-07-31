import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from './helpers/render'
import { navigation } from './helpers/router'

/**
 * Tela de login (`LoginForm`). Cobre o que o E2E não consegue observar barato:
 * validação de formulário, tratamento de erro e o que é enviado ao Better Auth.
 *
 * Nada de rede: `authClient` e o router são mockados. O caminho real
 * (cadastro → sessão → dashboard) é o E2E `auth-flow.spec.ts`.
 */

vi.mock('@tanstack/react-router', async () =>
  (await import('./helpers/router')).routerMock(),
)

const signIn = vi.fn()
const signUp = vi.fn()
const signInSocial = vi.fn()

vi.mock('@repo/utils/auth-client', () => ({
  authClient: {
    signIn: {
      email: (...args: unknown[]) => signIn(...args),
      social: (...args: unknown[]) => signInSocial(...args),
    },
    signUp: { email: (...args: unknown[]) => signUp(...args) },
  },
}))

const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }))

// Importado depois dos mocks — o módulo resolve `authClient` no import.
const { LoginForm } = await import('@/components/auth/login-form')

describe('LoginForm', () => {
  beforeEach(() => {
    signIn.mockResolvedValue({ error: null })
    signUp.mockResolvedValue({ error: null })
    signInSocial.mockResolvedValue({ error: null })
  })

  it('renderiza os campos de e-mail e senha', async () => {
    await render(<LoginForm />)

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('bloqueia o submit e mostra os erros quando o formulário é inválido', async () => {
    const user = userEvent.setup()
    await render(<LoginForm />)

    await user.type(screen.getByLabelText('Email'), 'nao-e-email')
    await user.type(screen.getByLabelText('Senha'), 'curta')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    // A validação é do Zod, via zodResolver — o mesmo schema do resto do app.
    expect(await screen.findByText(/e-?mail/i)).toBeInTheDocument()
    expect(signIn).not.toHaveBeenCalled()
  })

  it('envia e-mail e senha ao Better Auth e navega no sucesso', async () => {
    const user = userEvent.setup()
    await render(<LoginForm />)

    await user.type(screen.getByLabelText('Email'), 'ana@test.dev')
    await user.type(screen.getByLabelText('Senha'), 'senha-super-secreta')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith({
        email: 'ana@test.dev',
        password: 'senha-super-secreta',
      }),
    )
    // Sem `?redirect=`, o destino padrão é o dashboard.
    await waitFor(() =>
      expect(navigation.push).toHaveBeenCalledWith('/dashboard'),
    )
  })

  it('mostra toast e não navega quando o login falha', async () => {
    signIn.mockResolvedValue({ error: { message: 'Credenciais inválidas' } })
    const user = userEvent.setup()
    await render(<LoginForm />)

    await user.type(screen.getByLabelText('Email'), 'ana@test.dev')
    await user.type(screen.getByLabelText('Senha'), 'senha-super-secreta')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Credenciais inválidas'),
    )
    expect(navigation.push).not.toHaveBeenCalled()
  })

  it('a aba de cadastro envia nome, e-mail e senha', async () => {
    const user = userEvent.setup()
    await render(<LoginForm />)

    await user.click(screen.getByRole('tab', { name: 'Criar conta' }))

    await user.type(screen.getByLabelText('Nome'), 'Ana Tester')
    await user.type(screen.getByLabelText('Email'), 'ana@test.dev')
    await user.type(screen.getByLabelText('Senha'), 'senha-super-secreta')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))

    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith({
        name: 'Ana Tester',
        email: 'ana@test.dev',
        password: 'senha-super-secreta',
      }),
    )
  })
})
