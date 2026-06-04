import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@repo/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card'
import { Input } from '@repo/ui/components/input'
import { Label } from '@repo/ui/components/label'
import { authClient } from '@repo/utils/auth-client'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useRouter, useSearch } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { LanguageSwitcher } from '@/components/language-switcher'

type ResetValues = { password: string; confirm: string }

export function ResetPasswordForm() {
  const { t } = useTranslation(['auth', 'validation'])
  const router = useRouter()
  const queryClient = useQueryClient()
  // A API redireciona pra cá com ?token= (ou ?error= se o link for inválido).
  const { token, error } = useSearch({ from: '/_auth/reset-password' })

  const schema = useMemo(
    () =>
      z
        .object({
          password: z
            .string()
            .min(8, t('validation:passwordMin', { count: 8 })),
          confirm: z.string(),
        })
        .refine(values => values.password === values.confirm, {
          path: ['confirm'],
          message: t('reset.passwordsMismatch'),
        }),
    [t],
  )

  const form = useForm<ResetValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  })

  async function onSubmit(values: ResetValues) {
    if (!token) return
    const { error: resetError } = await authClient.resetPassword({
      newPassword: values.password,
      token,
    })
    if (resetError) {
      toast.error(resetError.message ?? t('errors.resetFailed'))
      return
    }
    // Sessões podem ter sido revogadas no reset; limpa o cache e manda pro login.
    queryClient.removeQueries({ queryKey: ['session'] })
    toast.success(t('reset.success'))
    await router.navigate({ to: '/login' })
  }

  // Link inválido/expirado: o Better Auth manda ?error=... ou vem sem token.
  if (error || !token) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{t('reset.title')}</CardTitle>
          <CardDescription>{t('reset.invalidToken')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button asChild>
            <Link to="/forgot-password">{t('reset.requestNew')}</Link>
          </Button>
          <Link
            to="/login"
            className="text-center text-muted-foreground text-sm hover:text-foreground"
          >
            {t('actions.backToLogin')}
          </Link>
        </CardContent>
        <CardFooter className="justify-center">
          <LanguageSwitcher />
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">{t('reset.title')}</CardTitle>
        <CardDescription>{t('reset.description')}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="reset-password">{t('reset.newPassword')}</Label>
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              {...form.register('password')}
            />
            {form.formState.errors.password && (
              <p className="text-destructive text-sm">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reset-confirm">{t('reset.confirmPassword')}</Label>
            <Input
              id="reset-confirm"
              type="password"
              autoComplete="new-password"
              {...form.register('confirm')}
            />
            {form.formState.errors.confirm && (
              <p className="text-destructive text-sm">
                {form.formState.errors.confirm.message}
              </p>
            )}
          </div>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? t('actions.updating')
              : t('actions.updatePassword')}
          </Button>
        </form>

        <Link
          to="/login"
          className="text-center text-muted-foreground text-sm hover:text-foreground"
        >
          {t('actions.backToLogin')}
        </Link>
      </CardContent>

      <CardFooter className="justify-center">
        <LanguageSwitcher />
      </CardFooter>
    </Card>
  )
}
