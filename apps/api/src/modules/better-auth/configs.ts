import { prisma } from '@repo/database'
import type { BetterAuthOptions, betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { organization } from 'better-auth/plugins'
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
        // Ainda não há e-mail transacional (ver UPGRADES.md → Resend). Por isso
        // logamos o link de aceite; a UI também lista os convites pendentes com
        // "copiar link". Ao ligar o Resend, troque por um envio de e-mail real.
        sendInvitationEmail: async data => {
          const url = new URL(
            `/accept-invitation/${data.invitation.id}`,
            env.APP_URL,
          ).toString()
          // biome-ignore lint/suspicious/noConsole: log de dev até o Resend entrar
          console.info(
            `[org-invite] ${data.email} → "${data.organization.name}": ${url}`,
          )
        },
      }),
    ],
    emailAndPassword: {
      enabled: true,
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
      user: {
        create: {
          // Auto-cria uma organização pessoal logo após o cadastro: o novo
          // usuário já entra como `owner`. Falha aqui não derruba o signup.
          after: async user => {
            try {
              const base = slugify(user.name || user.email.split('@')[0])
              await prisma.organization.create({
                data: {
                  name: user.name ? `${user.name}` : 'Minha organização',
                  slug: `${base}-${Date.now().toString(36)}`,
                  members: { create: { userId: user.id, role: 'owner' } },
                },
              })
            } catch (error) {
              // biome-ignore lint/suspicious/noConsole: log de dev
              console.error('[auto-org] falha ao criar organização', error)
            }
          },
        },
      },
      session: {
        create: {
          // Ao logar, define a organização ativa = a mais antiga do usuário,
          // para a sessão já vir com escopo de org (billing/membros).
          before: async session => {
            const member = await prisma.member.findFirst({
              where: { userId: session.userId },
              orderBy: { createdAt: 'asc' },
            })
            return {
              data: {
                ...session,
                activeOrganizationId: member?.organizationId,
              },
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
