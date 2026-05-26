import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card'
import { Input } from '@repo/ui/components/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/table'
import { authClient } from '@repo/utils/auth-client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export const Route = createFileRoute('/_app/organization')({
  component: OrganizationPage,
})

const ROLES = ['member', 'admin', 'owner'] as const

function OrganizationPage() {
  const { t } = useTranslation('organization')
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<(typeof ROLES)[number]>('member')
  const [inviting, setInviting] = useState(false)

  const { data } = useQuery({
    queryKey: ['full-organization'],
    queryFn: () => authClient.organization.getFullOrganization(),
  })
  const org = data?.data
  const refresh = () =>
    qc.invalidateQueries({ queryKey: ['full-organization'] })

  async function handleInvite(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setInviting(true)
    const res = await authClient.organization.inviteMember({
      email: email.trim(),
      role,
    })
    setInviting(false)
    if (res.error) {
      toast.error(res.error.message ?? t('createFailed'))
      return
    }
    setEmail('')
    toast.success(t('inviteSent'))
    refresh()
  }

  async function copyInviteLink(invitationId: string) {
    const url = `${window.location.origin}/accept-invitation/${invitationId}`
    await navigator.clipboard.writeText(url)
    toast.success(t('linkCopied'))
  }

  if (!org) {
    return (
      <div className="mx-auto w-full max-w-2xl p-6">
        <p className="text-muted-foreground text-sm">{t('noOrg')}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <h1 className="font-semibold text-2xl">{org.name}</h1>

      {/* Convidar */}
      <Card>
        <CardHeader>
          <CardTitle>{t('invite')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleInvite}
            className="flex flex-wrap items-end gap-2"
          >
            <Input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t('inviteEmail')}
              className="min-w-56 flex-1"
            />
            <Select
              value={role}
              onValueChange={v => setRole(v as (typeof ROLES)[number])}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">{t('roles.member')}</SelectItem>
                <SelectItem value="admin">{t('roles.admin')}</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={inviting || !email.trim()}>
              {inviting ? t('inviting') : t('invite')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Membros */}
      <Card>
        <CardHeader>
          <CardTitle>{t('members')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{org.name}</TableHead>
                <TableHead>{t('role')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {org.members.map(m => (
                <TableRow key={m.id}>
                  <TableCell>{m.user?.email ?? m.user?.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {t(`roles.${m.role as 'owner' | 'admin' | 'member'}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {m.role !== 'owner' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await authClient.organization.removeMember({
                            memberIdOrEmail: m.id,
                          })
                          refresh()
                        }}
                      >
                        {t('remove')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Convites pendentes */}
      <Card>
        <CardHeader>
          <CardTitle>{t('pendingInvites')}</CardTitle>
        </CardHeader>
        <CardContent>
          {org.invitations.filter(i => i.status === 'pending').length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('noInvites')}</p>
          ) : (
            <Table>
              <TableBody>
                {org.invitations
                  .filter(i => i.status === 'pending')
                  .map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell>{inv.email}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="mr-2"
                          onClick={() => copyInviteLink(inv.id)}
                        >
                          {t('copyLink')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            await authClient.organization.cancelInvitation({
                              invitationId: inv.id,
                            })
                            refresh()
                          }}
                        >
                          {t('cancelInvite')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
