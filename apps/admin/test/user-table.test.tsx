import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentType, ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Tabela de gestão de usuários do painel.
 *
 * Este arquivo tinha 466 linhas e **zero testes** enquanto morava no
 * `apps/app` — apareceu com 0% de cobertura no relatório da fundação de testes.
 * Migrar para um app próprio foi a hora de cobrir, porque aqui cada ação é
 * destrutiva: banir, revogar sessão, remover conta, virar outro usuário.
 */

vi.mock('@tanstack/react-router', async () =>
  (await import('./helpers/router')).routerMock(),
)

const listUsers = vi.fn()
const setRole = vi.fn()
const banUser = vi.fn()
const unbanUser = vi.fn()
const revokeUserSessions = vi.fn()
const removeUser = vi.fn()
const impersonateUser = vi.fn()

vi.mock('@repo/utils/auth-client', () => ({
  authClient: {
    // A tabela usa a sessão para saber quem é você e desabilitar as ações
    // sobre a própria conta. O id fictício aqui não bate com nenhum da lista,
    // então todas as ações ficam habilitadas nos testes.
    useSession: () => ({ data: { user: { id: 'me-admin' } } }),
    admin: {
      listUsers: (...a: unknown[]) => listUsers(...a),
      setRole: (...a: unknown[]) => setRole(...a),
      banUser: (...a: unknown[]) => banUser(...a),
      unbanUser: (...a: unknown[]) => unbanUser(...a),
      revokeUserSessions: (...a: unknown[]) => revokeUserSessions(...a),
      removeUser: (...a: unknown[]) => removeUser(...a),
      impersonateUser: (...a: unknown[]) => impersonateUser(...a),
    },
  },
}))

const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: { error: toastError, success: vi.fn() },
}))

const { Route } = await import('@/routes/_admin/index')
const UserTable = Route.options.component as ComponentType

const users = [
  {
    id: 'u1',
    name: 'Ana Cliente',
    email: 'ana@test.dev',
    role: 'user',
    banned: false,
    createdAt: '2026-01-10T12:00:00.000Z',
  },
  {
    id: 'u2',
    name: 'Root Admin',
    email: 'root@test.dev',
    role: 'admin',
    banned: true,
    createdAt: '2026-01-05T12:00:00.000Z',
  },
]

function renderTable(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

/** Abre o menu de três pontos da linha que contém o texto informado. */
async function openRowMenu(
  user: ReturnType<typeof userEvent.setup>,
  text: string,
) {
  const row = (await screen.findByText(text)).closest('tr')
  if (!row) throw new Error(`linha não encontrada: ${text}`)
  const buttons = row.querySelectorAll('button')
  await user.click(buttons[buttons.length - 1] as HTMLElement)
}

describe('tabela de usuários', () => {
  beforeEach(() => {
    listUsers.mockResolvedValue({
      data: { users, total: users.length },
      error: null,
    })
    for (const fn of [
      setRole,
      banUser,
      unbanUser,
      revokeUserSessions,
      removeUser,
    ]) {
      fn.mockResolvedValue({ error: null })
    }
    impersonateUser.mockResolvedValue({ error: null })
  })

  it('lista os usuários com papel e status', async () => {
    renderTable(<UserTable />)

    expect(await screen.findByText('ana@test.dev')).toBeInTheDocument()
    expect(screen.getByText('root@test.dev')).toBeInTheDocument()
    // O status vem de `banned`, não de um campo de texto — é o tipo de coisa
    // que um refactor quebra sem ninguém perceber.
    expect(screen.getByText('Banido')).toBeInTheDocument()
    expect(screen.getByText('Ativo')).toBeInTheDocument()
  })

  it('o menu de três pontos oferece as ações do usuário', async () => {
    const user = userEvent.setup()
    renderTable(<UserTable />)
    await openRowMenu(user, 'ana@test.dev')

    const itens = (await screen.findAllByRole('menuitem')).map(
      i => i.textContent,
    )
    expect(itens.join(' ')).toMatch(/Tornar admin/)
    expect(itens.join(' ')).toMatch(/Impersonar/)
    expect(itens.join(' ')).toMatch(/Revogar sessões/)
    expect(itens.join(' ')).toMatch(/Banir/)
    expect(itens.join(' ')).toMatch(/Remover usuário/)
  })

  it('promover a admin chama setRole com o papel invertido', async () => {
    const user = userEvent.setup()
    renderTable(<UserTable />)
    await openRowMenu(user, 'ana@test.dev')
    await user.click(
      await screen.findByRole('menuitem', { name: /Tornar admin/ }),
    )

    await waitFor(() =>
      expect(setRole).toHaveBeenCalledWith({ userId: 'u1', role: 'admin' }),
    )
  })

  it('usuário banido recebe a opção de desbanir, não de banir', async () => {
    const user = userEvent.setup()
    renderTable(<UserTable />)
    await openRowMenu(user, 'root@test.dev')

    const itens = (await screen.findAllByRole('menuitem')).map(
      i => i.textContent,
    )
    expect(itens.join(' ')).toMatch(/Desbanir/)
    expect(itens.join(' ')).not.toMatch(/\bBanir\b/)
  })

  it('erro da API vira toast e não quebra a tela', async () => {
    revokeUserSessions.mockResolvedValue({ error: { message: 'falhou' } })
    const user = userEvent.setup()
    renderTable(<UserTable />)
    await openRowMenu(user, 'ana@test.dev')
    await user.click(
      await screen.findByRole('menuitem', { name: /Revogar sessões/ }),
    )

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('falhou'))
    expect(screen.getByText('ana@test.dev')).toBeInTheDocument()
  })
})
