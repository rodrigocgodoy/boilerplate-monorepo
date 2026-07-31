import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { parseEnv } from '../src/parse'

/**
 * A mensagem de erro é o produto deste pacote — quem sobe a aplicação com
 * configuração errada precisa saber qual variável e por quê. Estes testes
 * fixam isso; sem eles, uma refatoração silenciosa devolve o dump do Zod.
 */
const schema = z.object({
  DATABASE_URL: z.string(),
  PORT: z.coerce.number(),
  LEVEL: z.enum(['info', 'debug']).default('info'),
})

const opts = { scope: 'teste', hint: 'confira o .env' }

describe('parseEnv', () => {
  it('devolve os valores já convertidos quando tudo é válido', () => {
    const env = parseEnv(
      schema,
      { DATABASE_URL: 'postgres://x', PORT: '3333' },
      opts,
    )
    expect(env).toEqual({
      DATABASE_URL: 'postgres://x',
      PORT: 3333,
      LEVEL: 'info',
    })
  })

  it('diz qual variável falta, pelo nome', () => {
    expect(() => parseEnv(schema, { PORT: '3333' }, opts)).toThrow(
      /DATABASE_URL\s+obrigatória, mas não foi definida/,
    )
  })

  it('distingue valor inválido de valor ausente', () => {
    // Regressão: a primeira versão reportava todo problema como "não foi
    // definida", inclusive erro de tipo — mensagem confiante e errada.
    try {
      parseEnv(schema, { DATABASE_URL: 'x', PORT: 'abc' }, opts)
      expect.unreachable('deveria ter lançado')
    } catch (error) {
      const message = (error as Error).message
      expect(message).toMatch(/PORT/)
      expect(message).not.toMatch(/PORT\s+obrigatória/)
      expect(message).toMatch(/recebido "abc"/)
    }
  })

  it('não imprime o valor de variáveis sensíveis', () => {
    const secrets = z.object({ COOKIE_SECRET: z.string().min(32) })
    try {
      parseEnv(secrets, { COOKIE_SECRET: 'curto-demais-mas-secreto' }, opts)
      expect.unreachable('deveria ter lançado')
    } catch (error) {
      const message = (error as Error).message
      // O log de boot costuma ir para um agregador; imprimir o segredo
      // errado ali o transforma num segredo vazado.
      expect(message).not.toContain('curto-demais-mas-secreto')
      expect(message).toContain('(valor omitido)')
    }
  })

  it('lista todos os problemas de uma vez', () => {
    try {
      parseEnv(schema, { PORT: 'abc', LEVEL: 'verboso' }, opts)
      expect.unreachable('deveria ter lançado')
    } catch (error) {
      const message = (error as Error).message
      // Corrigir uma variável por deploy é o pior jeito de descobrir as outras.
      for (const name of ['DATABASE_URL', 'PORT', 'LEVEL']) {
        expect(message).toContain(name)
      }
      expect(message).toContain('confira o .env')
    }
  })
})
