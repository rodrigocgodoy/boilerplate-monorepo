import { useCreateAvatarUpload } from '@repo/api-client/hooks'
import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/avatar'
import { Button } from '@repo/ui/components/button'
import { authClient } from '@repo/utils/auth-client'
import { useQueryClient } from '@tanstack/react-query'
import { type ChangeEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

const MAX_BYTES = 2 * 1024 * 1024

/**
 * Upload de avatar (#14): pede um POST pré-assinado, envia o arquivo **direto**
 * pro S3 e salva a URL pública em `user.image`. Sem S3 configurado, o presign
 * responde 503 e cai no toast de erro.
 */
export function AvatarUpload() {
  const { t } = useTranslation('storage')
  const qc = useQueryClient()
  const { data: session } = authClient.useSession()
  const presign = useCreateAvatarUpload()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const user = session?.user
  const initials = (user?.name ?? '?').slice(0, 2).toUpperCase()

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite re-selecionar o mesmo arquivo
    if (!file) return
    if (file.size > MAX_BYTES) {
      toast.error(t('avatar.tooLarge'))
      return
    }
    setBusy(true)
    try {
      const { data } = await presign.mutateAsync({
        data: { contentType: file.type },
      })
      const form = new FormData()
      for (const [k, v] of Object.entries(data.fields)) form.append(k, v)
      form.append('file', file)
      const up = await fetch(data.url, { method: 'POST', body: form })
      if (!up.ok) throw new Error('upload failed')
      await authClient.updateUser({ image: data.publicUrl })
      await qc.invalidateQueries({ queryKey: ['session'] })
      toast.success(t('avatar.updated'))
    } catch {
      toast.error(t('avatar.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar size="lg">
        {user?.image ? (
          <AvatarImage src={user.image} alt={user.name ?? ''} />
        ) : null}
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={onFile}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? t('avatar.uploading') : t('avatar.change')}
        </Button>
      </div>
    </div>
  )
}
