import { organizationClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { getApiBaseUrl } from './api-url.js'
import { ac, roles } from './permissions.js'

/**
 * Cliente Better Auth para o frontend. Conversa com a API em `${API}/auth`.
 *
 * Para adicionar plugins de client (admin, 2FA, etc.), inclua-os no array
 * `plugins` aqui e o plugin server correspondente em
 * `apps/api/src/modules/better-auth/configs.ts`. Veja `UPGRADES.md`.
 */
export const authClient = createAuthClient({
  baseURL: getApiBaseUrl(),
  basePath: '/auth',
  plugins: [organizationClient({ teams: { enabled: true }, ac, roles })],
})
