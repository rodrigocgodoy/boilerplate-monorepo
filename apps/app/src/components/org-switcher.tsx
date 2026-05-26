import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu'
import { Input } from '@repo/ui/components/input'
import { authClient } from '@repo/utils/auth-client'
import { useRouter } from '@tanstack/react-router'
import { ChevronsUpDown, Plus } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

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

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  async function switchTo(organizationId: string) {
    await authClient.organization.setActive({ organizationId })
    router.invalidate()
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setCreating(true)
    const res = await authClient.organization.create({
      name: trimmed,
      slug: `${slugify(trimmed)}-${Date.now().toString(36)}`,
    })
    setCreating(false)
    if (res.error || !res.data) {
      toast.error(t('createFailed'))
      return
    }
    await authClient.organization.setActive({ organizationId: res.data.id })
    setOpen(false)
    setName('')
    router.invalidate()
  }

  return (
    <>
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
          <DropdownMenuItem onSelect={() => setOpen(true)}>
            <Plus className="size-4" />
            {t('create')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('createTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <Input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
            />
            <DialogFooter>
              <Button type="submit" disabled={creating || !name.trim()}>
                {creating ? t('creating') : t('create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
