import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildTestApp } from './helpers/build-app.js'

/**
 * `GET /me` — a rota de exemplo do boilerplate e a ponta visível do fluxo
 * Zod → OpenAPI → Kubb → `useGetMe()`. Aqui ficam os caminhos que respondem
 * **antes** de qualquer query (não precisam de Postgres); o 200 com sessão real
 * é coberto em `auth-flow.int.test.ts`.
 */
let app: FastifyInstance

beforeAll(async () => {
  app = await buildTestApp()
})

afterAll(async () => {
  await app.close()
})

describe('GET /me', () => {
  it('responde 401 sem sessão', async () => {
    const res = await app.inject({ method: 'GET', url: '/me' })

    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({ error: expect.any(String) })
  })

  it('responde 401 com cookie de sessão inválido', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { cookie: 'better-auth.session_token=nao-existe' },
    })

    expect(res.statusCode).toBe(401)
  })

  it('traduz a mensagem do 401 pelo Accept-Language', async () => {
    const [ptBR, en, es] = await Promise.all(
      ['pt-BR', 'en', 'es'].map(lang =>
        app.inject({
          method: 'GET',
          url: '/me',
          headers: { 'accept-language': lang },
        }),
      ),
    )

    // Content-Language confirma qual idioma o servidor resolveu…
    expect(ptBR?.headers['content-language']).toBe('pt-BR')
    expect(en?.headers['content-language']).toBe('en')
    expect(es?.headers['content-language']).toBe('es')
    // …e as três mensagens são de fato diferentes entre si (o i18n não caiu
    // silenciosamente no fallback, que é o jeito clássico desse teste passar
    // sem provar nada).
    const messages = [ptBR, en, es].map(r => r?.json().error)
    expect(new Set(messages).size).toBe(3)
  })
})
