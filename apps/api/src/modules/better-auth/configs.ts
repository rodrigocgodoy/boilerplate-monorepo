import { prisma } from '@repo/database'
import { resolveLanguage } from '@repo/i18n'
import { ac, roles } from '@repo/utils/permissions'
import type { BetterAuthOptions, betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { admin, emailOTP, organization } from 'better-auth/plugins'
import { enqueue } from '@/jobs/index.js'
import { auditAfterHook } from '@/modules/audit/auth-hook.js'
import { env } from '@/utils/environment.js'

export type Auth = ReturnType<
  typeof betterAuth<ReturnType<typeof createAuthConfig>>
>

const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)

/**
 * Idioma do e-mail a partir do Accept-Language. Aceita tanto um `Request` web
 * quanto o `GenericEndpointContext` do Better Auth (ambos expõem `headers.get`).
 * Fallback no idioma default quando ausente.
 */
function localeFrom(ctx?: {
  headers?: { get?: (key: string) => string | null }
}): string {
  return resolveLanguage(ctx?.headers?.get?.('accept-language') ?? undefined)
}

/** Se o e-mail está na lista de super-admins (ADMIN_EMAILS). */
function isAdminEmail(email?: string | null): boolean {
  return !!email && env.ADMIN_EMAILS.includes(email.toLowerCase())
}

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
        sendInvitationEmail: async (data, request) => {
          const url = new URL(
            `/accept-invitation/${data.invitation.id}`,
            env.APP_URL,
          ).toString()
          await enqueue('email', {
            template: 'invitation',
            to: data.email,
            organizationName: data.organization.name,
            inviterName: data.inviter.user.name,
            url,
            locale: localeFrom(request),
          })
        },
      }),
      // Reset de senha por código (OTP) em vez de link — mais portável (não exige
      // deep link em app mobile). Só usamos o tipo `forget-password`; sign-in e
      // email-verification por OTP ficam disponíveis se quiser ligar depois.
      emailOTP({
        // otpLength: 6, expiresIn: 300, allowedAttempts: 3 (defaults)
        sendVerificationOTP: async ({ email, otp, type }, request) => {
          if (type === 'forget-password') {
            await enqueue('email', {
              template: 'reset',
              to: email,
              otp,
              locale: localeFrom(request),
            })
          }
        },
      }),
      // RBAC de plataforma: role de sistema (`admin` | `user`) no usuário, ban e
      // impersonation. Distinto dos papéis por organização (acima). Os endpoints
      // ficam sob `/auth/admin/*` e o front consome via `authClient.admin.*`.
      // O 1º admin vem de ADMIN_EMAILS (promovido nos databaseHooks). Ver
      // UPGRADES.md → "RBAC + painel admin".
      admin({
        defaultRole: 'user',
        adminRoles: ['admin'],
        impersonationSessionDuration: 60 * 60, // 1h
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
      sendVerificationEmail: async ({ user, url }, request) => {
        // O `url` aponta pro endpoint do API (/auth/verify-email) com
        // callbackURL=/ (raiz do API). Após verificar, o Better Auth redireciona
        // pra esse callbackURL — reescrevemos pro app (origem em trustedOrigins)
        // numa rota que existe, senão o usuário cai na raiz do API.
        const verifyUrl = new URL(url)
        verifyUrl.searchParams.set(
          'callbackURL',
          new URL('/dashboard', env.APP_URL).toString(),
        )
        await enqueue('email', {
          template: 'verification',
          to: user.email,
          name: user.name,
          url: verifyUrl.toString(),
          locale: localeFrom(request),
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
      // LGPD/GDPR (#11): exclusão de conta pelo próprio usuário. Sem
      // `sendDeleteAccountVerification`, o Better Auth exige reautenticação
      // (senha) na chamada — o front coleta a senha. `afterDelete` limpa os
      // dados da app que não caem por cascade (FK). Ver UPGRADES.md.
      deleteUser: {
        enabled: true,
        afterDelete: async user => {
          try {
            // Apaga as API keys criadas pelo usuário.
            await prisma.apiKeys.deleteMany({ where: { userId: user.id } })
            // Anonimiza a trilha de auditoria (preserva o evento, remove o autor).
            await prisma.auditLogs.updateMany({
              where: { actorId: user.id },
              data: { actorId: null },
            })
          } catch (error) {
            // biome-ignore lint/suspicious/noConsole: cleanup best-effort
            console.error('[deleteUser] falha ao limpar dados da app', error)
          }
        },
      },
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
            // Busca o usuário uma vez (reusado abaixo na criação da org).
            const user = await prisma.users.findUnique({
              where: { id: session.userId },
              select: { name: true, email: true, role: true },
            })
            // Sincroniza super-admin: promove contas que entraram em
            // ADMIN_EMAILS depois de criadas. Idempotente, roda a cada login.
            if (isAdminEmail(user?.email) && user?.role !== 'admin') {
              await prisma.users.update({
                where: { id: session.userId },
                data: { role: 'admin' },
              })
            }

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
    // Auditoria (#8): registra as ações mutantes do plugin organization
    // (mudou role, removeu membro, convites, times…) que o handler /auth/*
    // processa fora dos nossos módulos. Best-effort, ver modules/audit.
    hooks: {
      after: auditAfterHook,
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
