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
import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { LanguageSwitcher } from '@/components/language-switcher'

type ForgotValues = { email: string }

export function ForgotPasswordForm() {
  const { t } = useTranslation(['auth', 'validation'])
  const [sent, setSent] = useState(false)

  const schema = useMemo(
    () => z.object({ email: z.email(t('validation:email')) }),
    [t],
  )

  const form = useForm<ForgotValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  async function onSubmit(values: ForgotValues) {
    // O destino do link precisa ser uma URL absoluta do app (a API resolve o
    // callbackURL contra a própria origem se for relativo). Ver _auth/reset-password.
    const { error } = await authClient.requestPasswordReset({
      email: values.email,
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      toast.error(error.message ?? t('errors.resetRequestFailed'))
      return
    }
    // Mensagem constante (não revela se a conta existe).
    setSent(true)
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">{t('forgot.title')}</CardTitle>
        <CardDescription>{t('forgot.description')}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {sent ? (
          <p className="text-muted-foreground text-sm">{t('forgot.sent')}</p>
        ) : (
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="forgot-email">{t('fields.email')}</Label>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? t('actions.sending')
                : t('actions.sendReset')}
            </Button>
          </form>
        )}

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
