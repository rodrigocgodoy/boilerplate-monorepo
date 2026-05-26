import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@repo/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
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
import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

const signInSchema = z.object({
  email: z.email('Email inválido'),
  password: z.string().min(8, 'Mínimo de 8 caracteres'),
})

const signUpSchema = signInSchema.extend({
  name: z.string().min(2, 'Informe seu nome'),
})

type SignInValues = z.infer<typeof signInSchema>
type SignUpValues = z.infer<typeof signUpSchema>

export function LoginForm() {
  const router = useRouter()
  const [googleLoading, setGoogleLoading] = useState(false)

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
      toast.error(error.message ?? 'Falha ao entrar')
      return
    }
    await router.navigate({ to: '/dashboard' })
  }

  async function onSignUp(values: SignUpValues) {
    const { error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
    })
    if (error) {
      toast.error(error.message ?? 'Falha ao criar conta')
      return
    }
    await router.navigate({ to: '/dashboard' })
  }

  async function onGoogle() {
    setGoogleLoading(true)
    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: `${window.location.origin}/dashboard`,
    })
    if (error) {
      toast.error('Google não configurado. Veja UPGRADES.md.')
      setGoogleLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Bem-vindo</CardTitle>
        <CardDescription>
          Entre ou crie sua conta para continuar
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Criar conta</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-4">
            <form
              onSubmit={signInForm.handleSubmit(onSignIn)}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="signin-email">Email</Label>
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
                <Label htmlFor="signin-password">Senha</Label>
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
                {signInForm.formState.isSubmitting ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="mt-4">
            <form
              onSubmit={signUpForm.handleSubmit(onSignUp)}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-name">Nome</Label>
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
                <Label htmlFor="signup-email">Email</Label>
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
                <Label htmlFor="signup-password">Senha</Label>
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
                  ? 'Criando...'
                  : 'Criar conta'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="flex items-center gap-3 text-muted-foreground text-xs">
          <span className="h-px flex-1 bg-border" />
          ou
          <span className="h-px flex-1 bg-border" />
        </div>

        <GoogleAuthButton isLoading={googleLoading} onClick={onGoogle} />
      </CardContent>
    </Card>
  )
}
