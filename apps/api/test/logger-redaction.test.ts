import { Writable } from 'node:stream'
import { pino } from 'pino'
import { describe, expect, it } from 'vitest'
import { loggerOptions, REDACTED_PATHS } from '@/utils/logger.js'

/**
 * Redaction do log.
 *
 * Log vai para um agregador de terceiros, fica meses retido e é lido por gente
 * que não precisaria daquele dado. Um `authorization` vazado ali é credencial
 * válida em texto puro; o cookie de sessão permite personificar o usuário — e
 * não expira quando ele troca a senha.
 *
 * Estes testes existem porque redaction quebra em silêncio: some um caminho da
 * lista, e nada falha até alguém ler o log e encontrar um token.
 */

/** Captura as linhas de log como objetos, sem escrever no stdout do teste. */
function captureLogger() {
  const lines: Record<string, unknown>[] = []
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(JSON.parse(String(chunk)))
      callback()
    },
  })
  // `transport` (pino-pretty) é incompatível com stream customizado e só existe
  // em desenvolvimento; o resto da config é o que interessa aqui.
  const { transport: _transport, ...options } = loggerOptions as Record<
    string,
    unknown
  >
  return { logger: pino(options, stream), lines }
}

describe('redaction do log', () => {
  it('esconde headers de autenticação da request', () => {
    const { logger, lines } = captureLogger()

    logger.info({
      req: {
        headers: {
          authorization: 'Bearer token-super-secreto',
          cookie: 'better-auth.session_token=abc123',
          'x-api-key': 'bk_chave_secreta',
          'user-agent': 'vitest',
        },
      },
    })

    const serialized = JSON.stringify(lines[0])
    expect(serialized).not.toContain('token-super-secreto')
    expect(serialized).not.toContain('abc123')
    expect(serialized).not.toContain('bk_chave_secreta')
    // O que não é sensível continua no log — redaction demais também atrapalha.
    expect(serialized).toContain('vitest')
  })

  it('esconde o set-cookie da resposta', () => {
    const { logger, lines } = captureLogger()

    logger.info({
      res: { headers: { 'set-cookie': 'session=valor-secreto; HttpOnly' } },
    })

    expect(JSON.stringify(lines[0])).not.toContain('valor-secreto')
  })

  it('esconde senha, token e segredo em objetos logados à mão', () => {
    const { logger, lines } = captureLogger()

    logger.info({
      user: {
        email: 'ana@test.dev',
        password: 'senha-em-texto-puro',
        sessionToken: 'sess_abc',
      },
      payload: { secret: 'webhook-secret', otp: '123456' },
    })

    const serialized = JSON.stringify(lines[0])
    for (const leak of [
      'senha-em-texto-puro',
      'sess_abc',
      'webhook-secret',
      '123456',
    ]) {
      expect(serialized).not.toContain(leak)
    }
    expect(serialized).toContain('ana@test.dev')
  })

  it('esconde em objetos aninhados (payload de job, corpo de webhook)', () => {
    const { logger, lines } = captureLogger()

    // Cenário real: o handler do job `email` loga o payload em caso de falha.
    logger.error({
      job: { name: 'email', data: { to: 'ana@test.dev', token: 'verif_xyz' } },
    })

    const serialized = JSON.stringify(lines[0])
    expect(serialized).not.toContain('verif_xyz')
    expect(serialized).toContain('[REDACTED]')
  })

  it('a lista cobre os campos sensíveis conhecidos do projeto', () => {
    // Trava a lista: adicionar um campo sensível novo ao domínio sem incluí-lo
    // aqui é o jeito silencioso de vazar. Se este teste falhar porque um campo
    // saiu da lista, a pergunta é por quê — não é para "consertar" o teste.
    for (const field of [
      '*.password',
      '*.token',
      '*.secret',
      '*.otp',
      '*.keyHash',
      '*.apiKey',
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
    ]) {
      expect(REDACTED_PATHS).toContain(field)
    }
  })
})
