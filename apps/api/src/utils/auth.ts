import { betterAuth } from 'better-auth'
import { createAuthConfig } from '@/modules/better-auth/configs.js'

/**
 * Instância do Better Auth usada pelo CLI (`pnpm auth:generate`) para derivar
 * o schema do Prisma. Em runtime, a API usa a instância de `BetterAuthService`.
 */
export const auth = betterAuth(createAuthConfig())

type SessionResult = {
  user?: { id: string }
  // O plugin organization adiciona activeOrganizationId à sessão em runtime; o
  // index signature acomoda os demais campos concretos da sessão do Better Auth.
  session?: { activeOrganizationId?: string | null; [key: string]: unknown }
} | null

type AuthScope = {
  services: {
    auth: {
      auth: {
        api: {
          getSession: (opts: { headers: Headers }) => Promise<SessionResult>
        }
      }
    }
  }
}

type AuthRequest = {
  headers: Record<string, string | string[] | undefined>
}

function toHeaders(request: AuthRequest): Headers {
  const headers = new Headers()
  for (const [key, value] of Object.entries(request.headers)) {
    if (value) headers.append(key, Array.isArray(value) ? value[0] : value)
  }
  return headers
}

/**
 * Sessão resolvida: id do usuário + organização ativa (do plugin organization).
 * Retorna null se não autenticado. Uma única chamada a `getSession`.
 */
export async function getAuthSession(
  scope: AuthScope,
  request: AuthRequest,
): Promise<{ userId: string; activeOrganizationId: string | null } | null> {
  const session = await scope.services.auth.auth.api.getSession({
    headers: toHeaders(request),
  })
  if (!session?.user?.id) return null
  return {
    userId: session.user.id,
    activeOrganizationId: session.session?.activeOrganizationId ?? null,
  }
}

/**
 * Retorna o id do usuário autenticado a partir do cookie de sessão, ou null.
 */
export async function getAuthenticatedUserId(
  scope: AuthScope,
  request: AuthRequest,
): Promise<string | null> {
  return (await getAuthSession(scope, request))?.userId ?? null
}

/** Retorna o id da organização ativa na sessão, ou null. */
export async function getActiveOrganizationId(
  scope: AuthScope,
  request: AuthRequest,
): Promise<string | null> {
  return (await getAuthSession(scope, request))?.activeOrganizationId ?? null
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized')
    this.name = 'UnauthorizedError'
  }
}
