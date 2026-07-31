import NiceModal from '@ebay/nice-modal-react'
import { MODAL_ID as CREATE_ORGANIZATION } from '@/components/modals/create-organization-modal'

/**
 * Wrappers finos para abrir cada modal.
 *
 * A regra é: **nunca chamar `NiceModal.show('id')` espalhado pelo código**. O id
 * é uma string mágica — se ela vaza para dez arquivos, renomear um modal vira
 * caça ao texto, e um typo falha em silêncio (o modal simplesmente não abre).
 * Concentrando aqui, o resto do app chama uma função tipada.
 */

type Organization = { id: string; name: string; slug: string }

/**
 * Abre o modal de criar organização. A promise resolve com a organização criada
 * (quem chamou pode usar o retorno) ou nunca resolve, se o usuário fechar.
 */
export const openCreateOrganization = (): Promise<Organization> =>
  NiceModal.show(CREATE_ORGANIZATION) as Promise<Organization>
