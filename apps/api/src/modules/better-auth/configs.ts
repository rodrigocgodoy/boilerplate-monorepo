import { prisma } from '@repo/database'
import type { BetterAuthOptions, betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { organization } from 'better-auth/plugins'
import { env } from '@/utils/environment.js'

export type Auth = ReturnType<
  typeof betterAuth<ReturnType<typeof createAuthConfig>>
>

const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)

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
