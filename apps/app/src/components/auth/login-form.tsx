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
import { GoogleAuthButton } from '@repo/ui/components/google-auth-button'
import { Input } from '@repo/ui/components/input'
import { Label } from '@repo/ui/components/label'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@repo/ui/components/tabs'
import { authClient } from '@repo/utils/auth-client'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter, useSearch } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { LanguageSwitcher } from '@/components/language-switcher'

type SignInValues = { email: string; password: string }
type SignUpValues = SignInValues & { name: string }

export function LoginForm() {
  const { t } = useTranslation(['auth', 'validation'])
  const router = useRouter()
  const queryClient = useQueryClient()
  const { redirect } = useSearch({ from: '/_auth' })
  const [googleLoading, setGoogleLoading] = useState(false)

  // Destino pós-login: o ?redirect= (ex.: convite) ou o dashboard.
  const destination = redirect || '/dashboard'

  // Após autenticar, remove a sessão do cache (ensureQueryData só revalida
  // dado stale com revalidateIfStale; removendo, ele é forçado a refazer o
  // fetch e os guards _app/_auth enxergam a sessão nova) e navega ao destino.
  async function goAfterAuth() {
    queryClient.removeQueries({ queryKey: ['session'] })
    router.history.push(destination)
  }

  const signInSchema = useMemo(
    () =>
      z.object({
        email: z.email(t('validation:email')),
        password: z.string().min(8, t('validation:passwordMin', { count: 8 })),
      }),
    [t],
  )

  const signUpSchema = useMemo(
    () =>
      signInSchema.extend({ name: z.string().min(2, t('validation:nameMin')) }),
    [signInSchema, t],
  )

  const signInForm = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  const signUpForm = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '' },
  })

  async function onSignIn(values: SignInValues) {
    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    })
    if (error) {
      toast.error(error.message ?? t('errors.signInFailed'))
      return
    }
    await goAfterAuth()
  }

  async function onSignUp(values: SignUpValues) {
    const { error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
    })
    if (error) {
      toast.error(error.message ?? t('errors.signUpFailed'))
      return
    }
    await goAfterAuth()
  }

  async function onGoogle() {
    setGoogleLoading(true)
    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: `${window.location.origin}${destination}`,
    })
    if (error) {
      toast.error(t('googleNotConfigured'))
      setGoogleLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">{t('welcome')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">{t('tabs.signIn')}</TabsTrigger>
            <TabsTrigger value="signup">{t('tabs.signUp')}</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-4">
            <form
              onSubmit={signInForm.handleSubmit(onSignIn)}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="signin-email">{t('fields.email')}</Label>
                <Input
                  id="signin-email"
                  type="email"
                  autoComplete="email"
                  {...signInForm.register('email')}
                />
                {signInForm.formState.errors.email && (
                  <p className="text-destructive text-sm">
                    {signInForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="signin-password">{t('fields.password')}</Label>
                <Input
                  id="signin-password"
                  type="password"
                  autoComplete="current-password"
                  {...signInForm.register('password')}
                />
                {signInForm.formState.errors.password && (
                  <p className="text-destructive text-sm">
                    {signInForm.formState.errors.password.message}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                disabled={signInForm.formState.isSubmitting}
              >
                {signInForm.formState.isSubmitting
                  ? t('actions.signingIn')
                  : t('actions.signIn')}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="mt-4">
            <form
              onSubmit={signUpForm.handleSubmit(onSignUp)}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-name">{t('fields.name')}</Label>
                <Input
                  id="signup-name"
                  autoComplete="name"
                  {...signUpForm.register('name')}
                />
                {signUpForm.formState.errors.name && (
                  <p className="text-destructive text-sm">
                    {signUpForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-email">{t('fields.email')}</Label>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  {...signUpForm.register('email')}
                />
                {signUpForm.formState.errors.email && (
                  <p className="text-destructive text-sm">
                    {signUpForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-password">{t('fields.password')}</Label>
                <Input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  {...signUpForm.register('password')}
                />
                {signUpForm.formState.errors.password && (
                  <p className="text-destructive text-sm">
                    {signUpForm.formState.errors.password.message}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                disabled={signUpForm.formState.isSubmitting}
              >
                {signUpForm.formState.isSubmitting
                  ? t('actions.signingUp')
                  : t('actions.signUp')}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="flex items-center gap-3 text-muted-foreground text-xs">
          <span className="h-px flex-1 bg-border" />
          {t('or')}
          <span className="h-px flex-1 bg-border" />
        </div>

        <GoogleAuthButton
          isLoading={googleLoading}
          onClick={onGoogle}
          label={t('google')}
          loadingLabel={t('googleLoading')}
        />
      </CardContent>

      <CardFooter className="justify-center">
        <LanguageSwitcher />
      </CardFooter>
    </Card>
  )
}
