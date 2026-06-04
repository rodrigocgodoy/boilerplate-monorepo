import { prisma } from '@repo/database'
import {
  sendOrganizationInvitationEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from '@repo/emails'
import { ac, roles } from '@repo/utils/permissions'
import type { BetterAuthOptions, betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { emailOTP, organization } from 'better-auth/plugins'
import { env } from '@/utils/environment.js'

export type Auth = ReturnType<
  typeof betterAuth<ReturnType<typeof createAuthConfig>>
>

const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // remove acentos
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'org'
  )
}

export function createAuthConfig(): BetterAuthOptions {
  return {
    appName: 'Boilerplate',
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/auth',
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),
    plugins: [
      organization({
        // RBAC: statement + roles compartilhados com o client (@repo/utils/permissions)
        ac,
        roles,
        allowUserToCreateOrganization: true,
        organizationLimit: 10,
        membershipLimit: 100,
        creatorRole: 'owner',
        invitationExpiresIn: 60 * 60 * 24 * 7, // 7 dias
        teams: {
          enabled: true,
          maximumTeams: 10,
          maximumMembersPerTeam: 50,
        },
        // Envia o convite por e-mail (Resend). Sem RESEND_API_KEY, o pacote
        // @repo/emails loga o link no console (dev). Ver UPGRADES.md.
        sendInvitationEmail: async data => {
          const url = new URL(
            `/accept-invitation/${data.invitation.id}`,
            env.APP_URL,
          ).toString()
          await sendOrganizationInvitationEmail({
            to: data.email,
            organizationName: data.organization.name,
            inviterName: data.inviter.user.name,
            url,
          })
        },
      }),
      // Reset de senha por código (OTP) em vez de link — mais portável (não exige
      // deep link em app mobile). Só usamos o tipo `forget-password`; sign-in e
      // email-verification por OTP ficam disponíveis se quiser ligar depois.
      emailOTP({
        // otpLength: 6, expiresIn: 300, allowedAttempts: 3 (defaults)
        sendVerificationOTP: async ({ email, otp, type }) => {
          if (type === 'forget-password') {
            await sendPasswordResetEmail({ to: email, otp })
          }
        },
      }),
    ],
    emailAndPassword: {
      enabled: true,
      // Invalida as sessões existentes ao redefinir a senha (higiene de segurança).
      revokeSessionsOnPasswordReset: true,
    },
    emailVerification: {
      // Envia verificação no cadastro. NÃO bloqueia o login por padrão
      // (sem `requireEmailVerification`) — ligue se quiser exigir verificação.
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        // O `url` aponta pro endpoint do API (/auth/verify-email) com
        // callbackURL=/ (raiz do API). Após verificar, o Better Auth redireciona
        // pra esse callbackURL — reescrevemos pro app (origem em trustedOrigins)
        // numa rota que existe, senão o usuário cai na raiz do API.
        const verifyUrl = new URL(url)
        verifyUrl.searchParams.set(
          'callbackURL',
          new URL('/dashboard', env.APP_URL).toString(),
        )
        await sendVerificationEmail({
          to: user.email,
          name: user.name,
          url: verifyUrl.toString(),
        })
      },
    },
    // Google só é registrado quando as credenciais existem (ver UPGRADES.md).
    socialProviders: googleEnabled
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            redirectURI: new URL(
              '/auth/callback/google',
              env.BETTER_AUTH_URL,
            ).toString(),
          },
        }
      : {},
    user: {
      modelName: 'users',
    },
    session: {
      modelName: 'sessions',
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
    account: {
      modelName: 'accounts',
    },
    verification: {
      modelName: 'verifications',
    },
    databaseHooks: {
      session: {
        create: {
          // Em TODA criação de sessão (signup e login): garante a organização
          // pessoal e já define a org ativa — na mesma operação, sem race entre
          // criar o usuário e a sessão. Contas antigas sem org ganham uma no
          // próximo login.
          before: async session => {
            const existing = await prisma.member.findFirst({
              where: { userId: session.userId },
              orderBy: { createdAt: 'asc' },
              select: { organizationId: true },
            })
            if (existing) {
              return {
                data: {
                  ...session,
                  activeOrganizationId: existing.organizationId,
                },
              }
            }
            // Primeiro acesso: cria a org pessoal (owner) e já ativa.
            try {
              const user = await prisma.users.findUnique({
                where: { id: session.userId },
                select: { name: true, email: true },
              })
              const base = slugify(
                user?.name || user?.email?.split('@')[0] || 'org',
              )
              const org = await prisma.organization.create({
                data: {
                  name: user?.name || 'Minha organização',
                  slug: `${base}-${Date.now().toString(36)}`,
                  members: {
                    create: { userId: session.userId, role: 'owner' },
                  },
                },
                select: { id: true },
              })
              return { data: { ...session, activeOrganizationId: org.id } }
            } catch (error) {
              // biome-ignore lint/suspicious/noConsole: log de dev
              console.error('[auto-org] falha ao criar organização', error)
              return { data: session }
            }
          },
        },
      },
    },
    advanced: {
      database: {
        generateId: false,
      },
      // app e api podem rodar em domínios/portas diferentes → cookies
      // cross-site. Em produção (https) usa SameSite=None + Secure.
      useSecureCookies: env.ENV !== 'development',
      defaultCookieAttributes: {
        sameSite: env.ENV === 'development' ? 'lax' : 'none',
        secure: env.ENV !== 'development',
        httpOnly: true,
      },
    },
    trustedOrigins: [env.APP_URL],
  } satisfies BetterAuthOptions
}
