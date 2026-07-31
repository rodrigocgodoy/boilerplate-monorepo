import { z } from 'zod'

/**
 * Problem Details (RFC 9457) — o formato único de erro da API.
 *
 * Antes existiam três formatos incompatíveis: `{error}` nos módulos,
 * `{message,error,statusCode}` nos 404 do Fastify e, pior, `{"error":"Bad
 * Request"}` na validação — que **descartava** tudo o que o Zod sabia sobre
 * qual campo falhou. O cliente não conseguia escrever um único tratador nem
 * destacar o campo errado num formulário.
 *
 * A escolha da RFC 9457 em vez de um formato próprio é para não inventar
 * vocabulário: `type`/`title`/`status`/`detail` são conhecidos, e o
 * `application/problem+json` avisa o cliente antes mesmo do parse.
 */

/** Um problema de validação, campo a campo. */
export const problemErrorSchema = z.object({
  /** Caminho do campo, ex.: `body.email` ou `query.page`. */
  field: z.string(),
  /** Mensagem legível do que está errado. */
  message: z.string(),
})

export const problemSchema = z.object({
  /**
   * URI que identifica o **tipo** do problema. Usamos URNs relativas
   * (`about:blank` para o genérico) em vez de URLs de documentação: um
   * boilerplate não sabe onde a sua doc vai morar, e link quebrado é pior que
   * link ausente. Troque por URLs suas quando tiver a página.
   */
  type: z.string(),
  /** Resumo curto e estável do tipo — não muda entre ocorrências. */
  title: z.string(),
  /** Código HTTP, repetido no corpo (a RFC pede, e ajuda em log/telemetria). */
  status: z.number().int(),
  /** Detalhe **desta** ocorrência, já traduzido quando aplicável. */
  detail: z.string().optional(),
  /** Caminho que originou o erro. */
  instance: z.string().optional(),
  /** Correlaciona com o log e o Sentry (mesmo valor do header x-request-id). */
  requestId: z.string().optional(),
  /** Extensão: presente só em erro de validação. */
  errors: z.array(problemErrorSchema).optional(),
})

export type Problem = z.infer<typeof problemSchema>

export const PROBLEM_CONTENT_TYPE = 'application/problem+json'

/** Tipos de problema que a API emite. `about:blank` = sem semântica extra. */
export const problemTypes = {
  validation: 'urn:problem:validation-error',
  unauthorized: 'urn:problem:unauthorized',
  forbidden: 'urn:problem:forbidden',
  notFound: 'urn:problem:not-found',
  paymentRequired: 'urn:problem:payment-required',
  rateLimited: 'urn:problem:rate-limited',
  unavailable: 'urn:problem:service-unavailable',
  internal: 'about:blank',
} as const

/** Título padrão por status, quando quem chama não informa um. */
const TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
}

/** Tipo padrão por status. */
const TYPES: Record<number, string> = {
  400: problemTypes.validation,
  401: problemTypes.unauthorized,
  402: problemTypes.paymentRequired,
  403: problemTypes.forbidden,
  404: problemTypes.notFound,
  429: problemTypes.rateLimited,
  503: problemTypes.unavailable,
}

export function buildProblem(input: {
  status: number
  detail?: string
  title?: string
  type?: string
  instance?: string
  requestId?: string
  errors?: { field: string; message: string }[]
}): Problem {
  const { status } = input
  return {
    type: input.type ?? TYPES[status] ?? problemTypes.internal,
    title: input.title ?? TITLES[status] ?? 'Error',
    status,
    ...(input.detail ? { detail: input.detail } : {}),
    ...(input.instance ? { instance: input.instance } : {}),
    ...(input.requestId ? { requestId: input.requestId } : {}),
    ...(input.errors?.length ? { errors: input.errors } : {}),
  }
}
