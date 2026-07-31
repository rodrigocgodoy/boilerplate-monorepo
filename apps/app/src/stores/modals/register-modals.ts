import NiceModal from '@ebay/nice-modal-react'
import {
  MODAL_ID as CREATE_ORGANIZATION,
  CreateOrganizationModal,
} from '@/components/modals/create-organization-modal'

/**
 * Registro dos modais da aplicação — importado **uma vez** no layout raiz.
 *
 * Registrar por id aqui é o que permite abrir um modal de qualquer lugar sem
 * importar o componente. O custo de esquecer o registro é um `show()` que não
 * faz nada, então mantenha este arquivo como a lista completa.
 */
NiceModal.register(CREATE_ORGANIZATION, CreateOrganizationModal)
