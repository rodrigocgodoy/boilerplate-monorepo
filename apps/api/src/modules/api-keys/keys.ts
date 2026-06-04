import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Núcleo puro das API keys (#10) — sem I/O, fácil de testar. Formato do token:
 * `bk_<segredo base64url>`. Só o token completo dá acesso; guardamos apenas o
 * hash SHA-256 e um prefixo visível (para lookup/UI).
 */

const PREFIX = 'bk'
/** Tamanho do prefixo visível guardado/exibido (inclui "bk_"). */
const PREFIX_LENGTH = 12

export type GeneratedKey = {
  /** Token completo — mostrado UMA vez ao criar; nunca persistido. */
  token: string
  /** Prefixo visível (lookup + exibição). */
  prefix: string
  /** Hash SHA-256 (hex) do token completo. */
  keyHash: string
}

/** Gera uma nova API key. */
export function generateApiKey(): GeneratedKey {
  const secret = randomBytes(24).toString('base64url')
  const token = `${PREFIX}_${secret}`
  return {
    token,
    prefix: token.slice(0, PREFIX_LENGTH),
    keyHash: hashApiKey(token),
  }
}

/** Hash SHA-256 (hex) — determinístico, usado no verify. */
export function hashApiKey(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Prefixo visível de um token (para o lookup). */
export function apiKeyPrefix(token: string): string {
  return token.slice(0, PREFIX_LENGTH)
}

/** Confere o formato (`bk_...`) antes de tocar o banco. */
export function isApiKeyFormat(token: string): boolean {
  return /^bk_[A-Za-z0-9_-]{16,}$/.test(token)
}

/** Comparação de hash em tempo constante (evita timing attacks). */
export function hashesMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

/**
 * A chave cobre o escopo exigido? `scopes` null/ausente = sem restrição (a
 * chave herda o acesso da organização). `"*"` cobre tudo. Sem escopo exigido,
 * sempre libera.
 */
export function hasScope(scopes: unknown, required?: string): boolean {
  if (!required) return true
  if (scopes == null) return true
  if (!Array.isArray(scopes)) return false
  return scopes.includes('*') || scopes.includes(required)
}
