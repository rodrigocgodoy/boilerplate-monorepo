import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentType } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from './helpers/render'
import { navigation } from './helpers/router'

/**
 * Dashboard — a rota autenticada de exemplo. O que importa aqui é o contrato
 * com o `@repo/api-client`: o hook **gerado pelo Kubb** (`useGetMe`) devolve
 * `{ data: { data: Me } }`, e a tela troca skeleton por dados.
 *
 * `@repo/api-client` é mockado de propósito: em teste unitário, rede é
 * dependência escondida. Se o formato do hook gerado mudar, este teste quebra —
 * que é exatamente o aviso que se quer do fluxo Zod → OpenAPI → Kubb.
 */

vi.mock('@tanstack/react-router', async () =>
  (await import('./helpers/router')).routerMock(),
)

const useGetMe = vi.fn()
const useGetNotifications = vi.fn()

vi.mock('@repo/api-client/hooks', () => ({
  useGetMe: () => useGetMe(),
  useGetNotifications: () => useGetNotifications(),
}))

const signOut = vi.fn()
vi.mock('@repo/utils/auth-client', () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: 'u1', role: 'user' } } }),
    useListOrganizations: () => ({ data: [] }),
    useActiveOrganization: () => ({ data: null }),
    signOut: () => signOut(),
  },
}))

const resetAnalytics = vi.fn()
vi.mock('@/analytics', () => ({
  resetAnalytics: () => resetAnalytics(),
  useFeatureFlag: () => false,
}))

const me = {
  id: 'user-uuid-1',
  name: 'Ana Tester',
  email: 'ana@test.dev',
  emailVerified: true,
  image: null,
  createdAt: '2026-01-15T12:00:00.000Z',
}

// Importado depois dos mocks. `Route.options.component` é o componente da rota
// — mesma forma da `Route` real, então o `tsc` valida este acesso.
const { Route } = await import('@/routes/_app/dashboard')
const Dashboard = Route.options.component as ComponentType

describe('Dashboard', () => {
  beforeEach(() => {
    useGetMe.mockReturnValue({ data: { data: me }, isLoading: false })
    useGetNotifications.mockReturnValue({ data: { data: { unreadCount: 0 } } })
  })

  it('mostra os dados do usuário vindos do useGetMe', async () => {
    await render(<Dashboard />)

    expect(screen.getByText('Ana Tester')).toBeInTheDocument()
    expect(screen.getByText('ana@test.dev')).toBeInTheDocument()
    expect(screen.getByText(me.id)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /Dashboard/ }),
    ).toBeInTheDocument()
  })

  it('mostra skeleton enquanto o GET /me está carregando', async () => {
    useGetMe.mockReturnValue({ data: undefined, isLoading: true })

    const { container } = await render(<Dashboard />)

    expect(screen.queryByText('ana@test.dev')).not.toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(2)
  })

  it('não quebra quando o GET /me responde sem dados (sessão expirada)', async () => {
    // `isLoading: false` + `data: undefined` é o estado após um 401: a tela
    // precisa continuar de pé em vez de estourar em `me.name`.
    useGetMe.mockReturnValue({ data: undefined, isLoading: false })

    await render(<Dashboard />)

    expect(screen.getByText('Usuário autenticado')).toBeInTheDocument()
  })

  it('o badge de não lidas aparece com o contador do useGetNotifications', async () => {
    useGetNotifications.mockReturnValue({ data: { data: { unreadCount: 3 } } })

    await render(<Dashboard />)

    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('sair limpa o analytics, encerra a sessão e volta ao login', async () => {
    const user = userEvent.setup()
    await render(<Dashboard />)

    await user.click(screen.getByRole('button', { name: 'Sair' }))

    await waitFor(() => expect(signOut).toHaveBeenCalledOnce())
    expect(resetAnalytics).toHaveBeenCalledOnce()
    await waitFor(() =>
      expect(navigation.navigate).toHaveBeenCalledWith({ to: '/login' }),
    )
  })

  it('esconde o link de admin para quem não é admin', async () => {
    await render(<Dashboard />)

    expect(
      screen.queryByRole('link', { name: 'Admin' }),
    ).not.toBeInTheDocument()
  })
})
