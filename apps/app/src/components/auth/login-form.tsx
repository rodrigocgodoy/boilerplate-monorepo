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
import { Field, FieldError, FieldLabel } from '@repo/ui/components/field'
import { GoogleAuthButton } from '@repo/ui/components/google-auth-button'
import { Input } from '@repo/ui/components/input'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@repo/ui/components/tabs'
import { authClient } from '@repo/utils/auth-client'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useRouter, useSearch } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
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
    // `onTouched`: valida ao sair do campo. Só no submit, o usuário descobre
    // três erros de uma vez depois de preencher o formulário inteiro.
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  })

  const signUpForm = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    mode: 'onTouched',
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
              <Controller
                control={signInForm.control}
                name="email"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="signin-email">
                      {t('fields.email')}
                    </FieldLabel>
                    <Input
                      {...field}
                      id="signin-email"
                      type="email"
                      autoComplete="email"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                control={signInForm.control}
                name="password"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="signin-password">
                      {t('fields.password')}
                    </FieldLabel>
                    <Input
                      {...field}
                      id="signin-password"
                      type="password"
                      autoComplete="current-password"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Button
                type="submit"
                disabled={signInForm.formState.isSubmitting}
              >
                {signInForm.formState.isSubmitting
                  ? t('actions.signingIn')
                  : t('actions.signIn')}
              </Button>
              <Link
                to="/forgot-password"
                className="text-center text-muted-foreground text-sm hover:text-foreground"
              >
                {t('actions.forgot')}
              </Link>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="mt-4">
            <form
              onSubmit={signUpForm.handleSubmit(onSignUp)}
              className="flex flex-col gap-4"
            >
              <Controller
                control={signUpForm.control}
                name="name"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="signup-name">
                      {t('fields.name')}
                    </FieldLabel>
                    <Input
                      {...field}
                      id="signup-name"
                      autoComplete="name"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                control={signUpForm.control}
                name="email"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="signup-email">
                      {t('fields.email')}
                    </FieldLabel>
                    <Input
                      {...field}
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                control={signUpForm.control}
                name="password"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="signup-password">
                      {t('fields.password')}
                    </FieldLabel>
                    <Input
                      {...field}
                      id="signup-password"
                      type="password"
                      autoComplete="new-password"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
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
