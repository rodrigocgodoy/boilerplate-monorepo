import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@repo/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card'
import { Field, FieldError, FieldLabel } from '@repo/ui/components/field'
import { Input } from '@repo/ui/components/input'
import { authClient } from '@repo/utils/auth-client'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { ShieldAlert } from 'lucide-react'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

/**
 * Login do painel administrativo.
 *
 * Deliberadamente **mínimo**: e-mail e senha, sem aba de cadastro, sem login
 * social e sem "esqueci a senha". Um painel de administração que oferece
 * "criar conta" é um convite; quem administra a plataforma já tem conta, criada
 * por outro caminho (`ADMIN_EMAILS` ou promoção por um admin existente).
 *
 * A sessão é a mesma do app principal (cookie no domínio da API), então quem já
 * estiver logado no produto entra direto — desde que tenha a role.
 */
export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    // `?denied=true` chega de quem passou pela sessão mas não tem a role.
    denied: search.denied === true || search.denied === 'true',
  }),
  component: AdminLogin,
})

type FormValues = { email: string; password: string }

function AdminLogin() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { denied } = Route.useSearch()

  const schema = useMemo(
    () =>
      z.object({
        email: z.email('Email inválido'),
        password: z.string().min(8, 'Mínimo de 8 caracteres'),
      }),
    [],
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: FormValues) {
    const { error } = await authClient.signIn.email(values)
    if (error) {
      toast.error(error.message ?? 'Falha ao entrar')
      return
    }
    // Força o guard do `_admin` a revalidar a sessão nova.
    queryClient.removeQueries({ queryKey: ['session'] })
    router.history.push('/')
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Painel administrativo</CardTitle>
          <CardDescription>
            Acesso restrito a administradores da plataforma.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {denied && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive text-sm"
            >
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>Sua conta não tem permissão de administrador.</span>
            </div>
          )}

          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <Controller
              control={form.control}
              name="email"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="admin-email">{'Email'}</FieldLabel>
                  <Input
                    {...field}
                    id="admin-email"
                    type="email"
                    autoComplete="email"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="password"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="admin-password">{'Senha'}</FieldLabel>
                  <Input
                    {...field}
                    id="admin-password"
                    type="password"
                    autoComplete="current-password"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
