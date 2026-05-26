import { betterAuth } from 'better-auth'
import { createAuthConfig } from '@/modules/better-auth/configs.js'

/**
 * Instância do Better Auth usada pelo CLI (`pnpm auth:generate`) para derivar
 * o schema do Prisma. Em runtime, a API usa a instância de `BetterAuthService`.
 */
export const auth = betterAuth(createAuthConfig())

type AuthScope = {
  services: {
    auth: {
      auth: {
        api: {
          getSession: (opts: {
            headers: Headers
          }) => Promise<{ user?: { id: string } } | null>
        }
      }
    }
  }
}

type AuthRequest = {
  headers: Record<string, string | string[] | undefined>
}

/**
 * Retorna o id do usuário autenticado a partir do cookie de sessão, ou null.
 */
export async function getAuthenticatedUserId(
  scope: AuthScope,
  request: AuthRequest,
): Promise<string | null> {
  const headers = new Headers()
  for (const [key, value] of Object.entries(request.headers)) {
    if (value) headers.append(key, Array.isArray(value) ? value[0] : value)
  }

  const session = await scope.services.auth.auth.api.getSession({ headers })

  return session?.user?.id ?? null
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized')
    this.name = 'UnauthorizedError'
  }
}
