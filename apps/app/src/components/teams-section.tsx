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
import { authClient } from '@repo/utils/auth-client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

export type OrgMember = {
  id: string
  userId: string
  user?: { email?: string | null; name?: string | null } | null
}

function memberLabel(m: OrgMember): string {
  return m.user?.email ?? m.user?.name ?? m.userId
}

/** Times da organização ativa: criar, excluir e gerenciar membros por time. */
export function TeamsSection({ members }: { members: OrgMember[] }) {
  const { t } = useTranslation('organization')
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  const { data } = useQuery({
    queryKey: ['teams'],
    queryFn: () => authClient.organization.listTeams(),
  })
  const teams = data?.data ?? []

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    await authClient.organization.createTeam({ name: name.trim() })
    setCreating(false)
    setName('')
    qc.invalidateQueries({ queryKey: ['teams'] })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('teams.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={handleCreate} className="flex items-end gap-2">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('teams.namePlaceholder')}
            className="min-w-56 flex-1"
          />
          <Button type="submit" disabled={creating || !name.trim()}>
            {creating ? t('teams.creating') : t('teams.create')}
          </Button>
        </form>

        {teams.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('teams.noTeams')}</p>
        ) : (
          teams.map(team => (
            <TeamRow
              key={team.id}
              teamId={team.id}
              name={team.name}
              members={members}
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}

function TeamRow({
  teamId,
  name,
  members,
}: {
  teamId: string
  name: string
  members: OrgMember[]
}) {
  const { t } = useTranslation('organization')
  const qc = useQueryClient()
  const key = ['team-members', teamId]

  const { data } = useQuery({
    queryKey: key,
    queryFn: () =>
      authClient.organization.listTeamMembers({ query: { teamId } }),
  })
  const teamMembers = data?.data ?? []
  const inTeam = new Set(teamMembers.map(tm => tm.userId))
  const available = members.filter(m => !inTeam.has(m.userId))
  const refresh = () => qc.invalidateQueries({ queryKey: key })

  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">{name}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await authClient.organization.removeTeam({ teamId })
            qc.invalidateQueries({ queryKey: ['teams'] })
          }}
        >
          {t('teams.delete')}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {teamMembers.length === 0 && (
          <span className="text-muted-foreground text-sm">
            {t('teams.noTeamMembers')}
          </span>
        )}
        {teamMembers.map(tm => {
          const m = members.find(x => x.userId === tm.userId)
          return (
            <Badge key={tm.userId} variant="secondary" className="gap-1">
              {m ? memberLabel(m) : tm.userId}
              <button
                type="button"
                className="ml-1 opacity-60 hover:opacity-100"
                onClick={async () => {
                  await authClient.organization.removeTeamMember({
                    teamId,
                    userId: tm.userId,
                  })
                  refresh()
                }}
              >
                ×
              </button>
            </Badge>
          )
        })}

        {available.length > 0 && (
          <Select
            value=""
            onValueChange={async userId => {
              await authClient.organization.addTeamMember({ teamId, userId })
              refresh()
            }}
          >
            <SelectTrigger className="h-7 w-44">
              <SelectValue placeholder={t('teams.addMember')} />
            </SelectTrigger>
            <SelectContent>
              {available.map(m => (
                <SelectItem key={m.userId} value={m.userId}>
                  {memberLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )
}
