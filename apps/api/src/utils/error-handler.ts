import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import { buildProblem, PROBLEM_CONTENT_TYPE } from '@/utils/problem.js'

/**
 * Error handler global — todo erro **lançado** sai daqui como Problem Details.
 *
 * O caso que mais importa é a validação. O `fastify-type-provider-zod` valida
 * com o mesmo schema que gera o OpenAPI, mas o handler padrão do Fastify
 * respondia `{"error":"Bad Request"}`: a API sabia exatamente qual campo tinha
 * falhado e jogava fora. Aqui esse detalhe vira `errors[]`, que é o que permite
 * ao formulário destacar o campo certo.
 */

/** Traduz o caminho do Zod (`/body/email`) para algo legível (`body.email`). */
function toFieldPath(instancePath: string, prefix: string): string {
  const path = instancePath.replace(/^\//, '').split('/').filter(Boolean)
  return [prefix, ...path].join('.')
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request: FastifyRequest, reply: FastifyReply) => {
    const requestId = String(request.id)
    const instance = request.url

    // ── Validação (Zod) ─────────────────────────────────────────────────────
    if (hasZodFastifySchemaValidationErrors(error)) {
      const errors = error.validation.map(issue => ({
        field: toFieldPath(
          issue.instancePath ?? '',
          // `context.method` diz de onde veio (body/query/params/headers).
          String(issue.schemaPath ?? '').includes('querystring')
            ? 'query'
            : 'body',
        ),
        message: issue.message ?? 'valor inválido',
      }))

      request.log.info({ errors }, 'requisição rejeitada na validação')

      return reply
        .status(400)
        .type(PROBLEM_CONTENT_TYPE)
        .send(
          buildProblem({
            status: 400,
            detail: request.t('validation:invalidRequest'),
            instance,
            requestId,
            errors,
          }),
        )
    }

    // ── Erros com status conhecido (404 do roteador, 429 do rate limit,
    // `httpErrors` do @fastify/sensible, throws nossos com statusCode) ───────
    // Fora do ramo do Zod o Fastify entrega o erro como `unknown` (qualquer
    // coisa pode ser lançada em JS, inclusive uma string).
    const err = error as { statusCode?: number; message?: string }
    const status = err.statusCode ?? 500

    if (status < 500) {
      return reply
        .status(status)
        .type(PROBLEM_CONTENT_TYPE)
        .send(
          buildProblem({
            status,
            detail: err.message,
            instance,
            requestId,
          }),
        )
    }

    // ── 5xx ─────────────────────────────────────────────────────────────────
    // Loga inteiro (o Sentry também captura, via hook onError) e responde
    // genérico: mensagem de erro interno costuma carregar nome de tabela,
    // caminho de arquivo e trecho de query — nada disso vai para o cliente.
    request.log.error({ err }, 'erro não tratado')

    return reply
      .status(status)
      .type(PROBLEM_CONTENT_TYPE)
      .send(
        buildProblem({
          status,
          detail: request.t('validation:internalError'),
          instance,
          requestId,
        }),
      )
  })

  // As rotas devolvem erros esperados com `reply.send(problem(...))`, sem
  // lançar — então não passam pelo handler acima e sairiam como
  // `application/json`. Este hook marca o content-type correto olhando o
  // formato do corpo, para o cliente poder distinguir erro de payload normal
  // pelo header, antes do parse. Só custa um parse em respostas de erro.
  app.addHook('onSend', async (_request, reply, payload) => {
    if (reply.statusCode < 400 || typeof payload !== 'string') return payload

    const contentType = String(reply.getHeader('content-type') ?? '')
    if (!contentType.startsWith('application/json')) return payload

    try {
      const body: unknown = JSON.parse(payload)
      const isProblem =
        typeof body === 'object' &&
        body !== null &&
        'type' in body &&
        'title' in body &&
        'status' in body
      if (isProblem) {
        reply.header('content-type', `${PROBLEM_CONTENT_TYPE}; charset=utf-8`)
      }
    } catch {
      // Corpo não-JSON (download, texto): não é problema nosso.
    }

    return payload
  })

  // 404 do roteador não passa pelo error handler por padrão.
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    return reply
      .status(404)
      .type(PROBLEM_CONTENT_TYPE)
      .send(
        buildProblem({
          status: 404,
          detail: `Rota ${request.method} ${request.url} não encontrada`,
          instance: request.url,
          requestId: String(request.id),
        }),
      )
  })
}
