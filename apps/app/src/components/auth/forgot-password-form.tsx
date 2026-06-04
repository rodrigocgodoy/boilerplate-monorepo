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
import { Link, useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { LanguageSwitcher } from '@/components/language-switcher'

type RequestValues = { email: string }
type ResetValues = { otp: string; password: string; confirm: string }

/**
 * Reset de senha por código (OTP) — sem link/deep link, funciona em qualquer
 * dispositivo. Passo 1: informa o e-mail e recebe um código. Passo 2: digita o
 * código + a nova senha. Ver emailOTP no Better Auth (apps/api/.../configs.ts).
 */
export function ForgotPasswordForm() {
  const { t } = useTranslation(['auth', 'validation'])
  const router = useRouter()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState<string | null>(null)

  const requestSchema = useMemo(
    () => z.object({ email: z.email(t('validation:email')) }),
    [t],
  )

  const resetSchema = useMemo(
    () =>
      z
        .object({
          otp: z.string().min(6, t('validation:otp')),
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

  const requestForm = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: '' },
  })

  const resetForm = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { otp: '', password: '', confirm: '' },
  })

  async function onRequest(values: RequestValues) {
    const { error } = await authClient.emailOtp.requestPasswordReset({
      email: values.email,
    })
    if (error) {
      toast.error(error.message ?? t('errors.resetRequestFailed'))
      return
    }
    setEmail(values.email)
  }

  async function onResend() {
    if (!email) return
    const { error } = await authClient.emailOtp.requestPasswordReset({ email })
    toast[error ? 'error' : 'success'](
      error
        ? (error.message ?? t('errors.resetRequestFailed'))
        : t('forgot.codeSent', { email }),
    )
  }

  async function onReset(values: ResetValues) {
    if (!email) return
    const { error } = await authClient.emailOtp.resetPassword({
      email,
      otp: values.otp,
      password: values.password,
    })
    if (error) {
      toast.error(error.message ?? t('errors.resetFailed'))
      return
    }
    queryClient.removeQueries({ queryKey: ['session'] })
    toast.success(t('reset.success'))
    await router.navigate({ to: '/login' })
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">
          {email ? t('reset.title') : t('forgot.title')}
        </CardTitle>
        <CardDescription>
          {email ? t('forgot.codeSent', { email }) : t('forgot.description')}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {email ? (
          <form
            onSubmit={resetForm.handleSubmit(onReset)}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="reset-otp">{t('reset.otp')}</Label>
              <Input
                id="reset-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                {...resetForm.register('otp')}
              />
              {resetForm.formState.errors.otp && (
                <p className="text-destructive text-sm">
                  {resetForm.formState.errors.otp.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="reset-password">{t('reset.newPassword')}</Label>
              <Input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                {...resetForm.register('password')}
              />
              {resetForm.formState.errors.password && (
                <p className="text-destructive text-sm">
                  {resetForm.formState.errors.password.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="reset-confirm">
                {t('reset.confirmPassword')}
              </Label>
              <Input
                id="reset-confirm"
                type="password"
                autoComplete="new-password"
                {...resetForm.register('confirm')}
              />
              {resetForm.formState.errors.confirm && (
                <p className="text-destructive text-sm">
                  {resetForm.formState.errors.confirm.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={resetForm.formState.isSubmitting}>
              {resetForm.formState.isSubmitting
                ? t('actions.updating')
                : t('actions.updatePassword')}
            </Button>
            <div className="flex justify-between text-sm">
              <button
                type="button"
                onClick={onResend}
                className="text-muted-foreground hover:text-foreground"
              >
                {t('actions.resend')}
              </button>
              <button
                type="button"
                onClick={() => setEmail(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                {t('actions.changeEmail')}
              </button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={requestForm.handleSubmit(onRequest)}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="forgot-email">{t('fields.email')}</Label>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                {...requestForm.register('email')}
              />
              {requestForm.formState.errors.email && (
                <p className="text-destructive text-sm">
                  {requestForm.formState.errors.email.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={requestForm.formState.isSubmitting}>
              {requestForm.formState.isSubmitting
                ? t('actions.sending')
                : t('actions.sendCode')}
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
