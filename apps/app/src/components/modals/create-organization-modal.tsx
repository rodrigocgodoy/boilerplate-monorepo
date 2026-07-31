import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'
import { Field, FieldError, FieldLabel } from '@repo/ui/components/field'
import { Input } from '@repo/ui/components/input'
import { authClient } from '@repo/utils/auth-client'
import { useRouter } from '@tanstack/react-router'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

/**
 * Modal de criação de organização — **referência canônica** do padrão de modais
 * do boilerplate. Copie a estrutura deste arquivo ao criar um modal novo.
 *
 * Três coisas acontecem aqui, e todas são convenção (ver CONVENTIONS.md):
 *
 * 1. **`create()` + `useModal()`** (`@ebay/nice-modal-react`) em vez de
 *    `useState(open)` no pai. O componente que abre o modal não precisa
 *    hospedar o estado dele nem receber `open`/`onOpenChange` por props — some
 *    o prop-drilling, e abrir o modal de qualquer lugar vira uma chamada de
 *    função.
 * 2. **Formulário com react-hook-form + Zod + `<Field/>`** — o mesmo padrão do
 *    login, inclusive `mode: 'onTouched'` e `role="alert"` no erro.
 * 3. **O modal é dono do próprio fluxo**: valida, chama a API, trata erro e se
 *    fecha. Quem abre não sabe de nada disso.
 */

export const MODAL_ID = 'create-organization'

/** Slug a partir do nome: minúsculas, sem acento estrutural, hífens. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const CreateOrganizationModal = NiceModal.create(() => {
  const modal = useModal(MODAL_ID)
  const { t } = useTranslation('organization')
  const router = useRouter()

  const schema = useMemo(
    () => z.object({ name: z.string().min(2, t('nameTooShort')) }),
    [t],
  )
  type FormValues = z.infer<typeof schema>

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { name: '' },
  })

  async function onSubmit({ name }: FormValues) {
    const res = await authClient.organization.create({
      name,
      // Sufixo temporal evita colisão de slug entre organizações homônimas —
      // o Better Auth exige slug único.
      slug: `${slugify(name)}-${Date.now().toString(36)}`,
    })

    if (res.error || !res.data) {
      toast.error(t('createFailed'))
      return
    }

    await authClient.organization.setActive({ organizationId: res.data.id })
    // Devolve a org criada a quem abriu o modal (`await openCreateOrganization()`).
    modal.resolve(res.data)
    modal.hide()
    form.reset()
    router.invalidate()
  }

  return (
    <Dialog
      open={modal.visible}
      onOpenChange={open => {
        if (!open) modal.hide()
      }}
    >
      {/* `onExitComplete` remove o modal da árvore só depois da animação de
          saída — sem isso o conteúdo some antes de o Dialog terminar de fechar. */}
      <DialogContent onAnimationEnd={() => !modal.visible && modal.remove()}>
        <DialogHeader>
          <DialogTitle>{t('createTitle')}</DialogTitle>
          <DialogDescription>{t('createDescription')}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <Controller
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="create-org-name">
                  {t('nameLabel')}
                </FieldLabel>
                <Input
                  {...field}
                  id="create-org-name"
                  autoFocus
                  placeholder={t('namePlaceholder')}
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t('creating') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
})
