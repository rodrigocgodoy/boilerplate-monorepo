import { Button } from '@repo/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu'
import { authClient } from '@repo/utils/auth-client'
import { useRouter } from '@tanstack/react-router'
import { ChevronsUpDown, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { openCreateOrganization } from '@/stores/modals/open-modals'

/**
 * Seletor de organização ativa: lista as orgs do usuário, troca a ativa e
 * permite criar uma nova. A org ativa fica na sessão (Better Auth) e define o
 * escopo de billing/membros.
 */
export function OrgSwitcher() {
  const { t } = useTranslation('organization')
  const router = useRouter()
  const { data: orgs } = authClient.useListOrganizations()
  const { data: active } = authClient.useActiveOrganization()

  async function switchTo(organizationId: string) {
    await authClient.organization.setActive({ organizationId })
    router.invalidate()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {active?.name ?? t('noOrg')}
          <ChevronsUpDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-52">
        <DropdownMenuLabel>{t('label')}</DropdownMenuLabel>
        {orgs?.map(org => (
          <DropdownMenuItem
            key={org.id}
            onSelect={() => switchTo(org.id)}
            disabled={org.id === active?.id}
          >
            {org.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => openCreateOrganization()}>
          <Plus className="size-4" />
          {t('create')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
