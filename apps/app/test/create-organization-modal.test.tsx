import NiceModal from '@ebay/nice-modal-react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from './helpers/render'

/**
 * Modal de criar organização — a **referência canônica** do padrão de modais.
 *
 * O que se testa aqui não é o formulário em si, e sim as propriedades do
 * padrão: que dá para abrir o modal sem que ninguém hospede `open`, que ele
 * valida antes de chamar a API, e que devolve o resultado para quem abriu.
 * Se estas três valerem, copiar este arquivo produz um modal correto.
 */

vi.mock('@tanstack/react-router', async () =>
  (await import('./helpers/router')).routerMock(),
)

const createOrg = vi.fn()
const setActive = vi.fn()
vi.mock('@repo/utils/auth-client', () => ({
  authClient: {
    organization: {
      create: (...args: unknown[]) => createOrg(...args),
      setActive: (...args: unknown[]) => setActive(...args),
    },
  },
}))

const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }))

const { CreateOrganizationModal, MODAL_ID } = await import(
  '@/components/modals/create-organization-modal'
)

/**
 * Monta só o provider — nenhum componente "dono" do modal. É essa a diferença
 * para o padrão antigo: quem abre não precisa renderizar o modal nem guardar
 * estado dele.
 */
async function renderModalHost() {
  NiceModal.register(MODAL_ID, CreateOrganizationModal)
  return render(
    <NiceModal.Provider>
      <div />
    </NiceModal.Provider>,
  )
}

describe('CreateOrganizationModal', () => {
  beforeEach(() => {
    createOrg.mockResolvedValue({
      data: { id: 'org-1', name: 'Acme', slug: 'acme-x' },
      error: null,
    })
    setActive.mockResolvedValue({ error: null })
  })

  it('abre por id, sem o pai hospedar estado', async () => {
    await renderModalHost()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    NiceModal.show(MODAL_ID)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Nome da organização')).toBeInTheDocument()
  })

  it('valida antes de chamar a API', async () => {
    const user = userEvent.setup()
    await renderModalHost()
    NiceModal.show(MODAL_ID)
    await screen.findByRole('dialog')

    await user.type(screen.getByLabelText('Nome da organização'), 'A')
    await user.click(screen.getByRole('button', { name: 'Criar organização' }))

    expect(await screen.findAllByRole('alert')).not.toHaveLength(0)
    expect(createOrg).not.toHaveBeenCalled()
  })

  it('cria, ativa a organização e resolve para quem abriu', async () => {
    const user = userEvent.setup()
    await renderModalHost()

    // O `show()` devolve uma promise — é assim que o chamador recebe o
    // resultado sem callback nem estado intermediário.
    const opened = NiceModal.show(MODAL_ID)
    await screen.findByRole('dialog')

    await user.type(screen.getByLabelText('Nome da organização'), 'Acme')
    await user.click(screen.getByRole('button', { name: 'Criar organização' }))

    await waitFor(() =>
      expect(createOrg).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Acme' }),
      ),
    )
    await waitFor(() =>
      expect(setActive).toHaveBeenCalledWith({ organizationId: 'org-1' }),
    )
    await expect(opened).resolves.toMatchObject({ id: 'org-1' })
  })

  it('mostra toast e mantém o modal aberto quando a API falha', async () => {
    createOrg.mockResolvedValue({ data: null, error: { message: 'falhou' } })
    const user = userEvent.setup()
    await renderModalHost()
    NiceModal.show(MODAL_ID)
    await screen.findByRole('dialog')

    await user.type(screen.getByLabelText('Nome da organização'), 'Acme')
    await user.click(screen.getByRole('button', { name: 'Criar organização' }))

    await waitFor(() => expect(toastError).toHaveBeenCalled())
    // Fechar em caso de erro perderia o que o usuário digitou.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(setActive).not.toHaveBeenCalled()
  })
})
