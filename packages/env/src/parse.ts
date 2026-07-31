import type { ZodType } from 'zod'

/**
 * Valida variáveis de ambiente e **derruba o processo** se algo estiver errado.
 *
 * A mensagem é o produto aqui. O erro cru do Zod é um JSON de várias linhas por
 * problema — quem está subindo a aplicação às 3 da manhã precisa ler o nome da
 * variável e o que fazer, não um dump. Falhar no boot também é deliberado:
 * variável faltando descoberta no primeiro request vira 500 intermitente em
 * produção, difícil de associar à causa.
 */

/**
 * Nomes cujo valor não pode aparecer na mensagem de erro. O log de boot costuma
 * ir para stdout do container e daí para um agregador — imprimir o segredo
 * errado ali o transforma num segredo vazado.
 */
const SENSITIVE = /SECRET|KEY|PASSWORD|TOKEN|DSN|DATABASE_URL|REDIS_URL/i

function preview(name: string, value: unknown): string {
  if (SENSITIVE.test(name)) return '(valor omitido)'
  const text = String(value)
  return text.length > 40 ? `"${text.slice(0, 40)}…"` : `"${text}"`
}

/**
 * Descreve um problema em uma linha.
 *
 * Consulta o **valor de origem** em vez de `issue.input`: no Zod v4 esse campo
 * nem sempre vem preenchido, e confiar nele fazia toda falha ser reportada como
 * "não foi definida" — inclusive as de tipo, onde a variável existe e está
 * simplesmente errada. Mensagem confiante e errada é pior que mensagem vaga.
 */
function describe(
  issue: { message: string; path: PropertyKey[] },
  source: unknown,
): string {
  const name = String(issue.path[0] ?? '')
  const raw =
    typeof source === 'object' && source !== null
      ? (source as Record<string, unknown>)[name]
      : undefined

  if (raw === undefined || raw === '') {
    return 'obrigatória, mas não foi definida'
  }
  return `${issue.message} — recebido ${preview(name, raw)}`
}

export type ParseEnvOptions = {
  /** Onde o erro aconteceu (ex.: "API", "app"), para situar quem lê. */
  scope: string
  /** Uma linha dizendo onde corrigir. */
  hint: string
}

export function parseEnv<T>(
  schema: ZodType<T>,
  source: unknown,
  { scope, hint }: ParseEnvOptions,
): T {
  const result = schema.safeParse(source)
  if (result.success) return result.data

  const width = Math.max(
    ...result.error.issues.map(i => String(i.path.join('.')).length),
  )
  const lines = result.error.issues.map(issue => {
    const name = String(issue.path.join('.') || '(raiz)').padEnd(width)
    return `  ${name}  ${describe(issue, source)}`
  })

  throw new Error(
    [
      '',
      `Variáveis de ambiente inválidas (${scope}):`,
      '',
      ...lines,
      '',
      hint,
      '',
    ].join('\n'),
  )
}
