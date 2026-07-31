import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { buildTestApp } from './helpers/build-app.js'
import { describeDb, resetDb } from './helpers/db.js'

/**
 * Fluxo de autenticação ponta a ponta **dentro do processo**: cadastro →
 * sessão → `GET /me` → logout. Usa `app.inject` (sem porta, sem HTTP real) e o
 * Postgres de teste — é aqui que o `GET /me` prova o caminho de sucesso, que os
 * testes DB-free não alcançam.
 *
 * Rode com `pnpm test:db` (sobe e derruba o banco sozinho) ou exporte
 * `TEST_DATABASE_URL`. Ver TESTING.md.
 */

// Endpoints mutantes do Better Auth exigem `Origin` em `trustedOrigins`
// (proteção CSRF). O browser manda sozinho; via inject, mandamos à mão.
const ORIGIN = 'http://localhost:5173'

const credentials = {
  name: 'Ana Tester',
  email: 'ana@test.dev',
  password: 'senha-super-secreta',
}

/**
 * Cookie jar mínimo, no comportamento de um browser: aplica os `set-cookie` de
 * cada resposta e **remove** os que vêm expirados (`Max-Age=0` ou valor vazio,
 * que é como o logout apaga a sessão).
 *
 * Concatenar `set-cookie` ingenuamente daria um teste que mente: o logout
 * continuaria "logado" porque o cookie velho nunca sairia do header.
 */
class CookieJar {
  private readonly jar = new Map<string, string>()

  apply(headers: Record<string, unknown>): this {
    const raw = headers['set-cookie']
    const list = Array.isArray(raw) ? raw : raw ? [String(raw)] : []

    for (const entry of list) {
      const [pair = '', ...attributes] = String(entry).split(';')
      const separator = pair.indexOf('=')
      if (separator < 0) continue

      const name = pair.slice(0, separator).trim()
      const value = pair.slice(separator + 1).trim()
      const expired =
        value === '' ||
        attributes.some(a => /^\s*max-age\s*=\s*0\s*$/i.test(a)) ||
        attributes.some(a => /^\s*expires\s*=\s*Thu, 01 Jan 1970/i.test(a))

      if (expired) this.jar.delete(name)
      else this.jar.set(name, value)
    }

    return this
  }

  get header(): string {
    return [...this.jar].map(([name, value]) => `${name}=${value}`).join('; ')
  }
}

describeDb('fluxo de autenticação (integração)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(resetDb)

  it('cadastro cria sessão e GET /me devolve o usuário', async () => {
    const signUp = await app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: { origin: ORIGIN },
      payload: credentials,
    })

    expect(signUp.statusCode).toBe(200)

    const jar = new CookieJar().apply(signUp.headers)
    expect(jar.header).toContain('session_token')

    const me = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { cookie: jar.header },
    })

    expect(me.statusCode).toBe(200)
    expect(me.json()).toMatchObject({
      id: expect.any(String),
      name: credentials.name,
      email: credentials.email,
      emailVerified: false,
      image: null,
    })
    // `createdAt` é serializado como ISO string pelo schema Zod da rota — o
    // contrato que o Kubb publica para o `useGetMe()` no app.
    expect(() => new Date(me.json().createdAt).toISOString()).not.toThrow()
  })

  it('login com a senha correta devolve sessão válida para o GET /me', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: { origin: ORIGIN },
      payload: credentials,
    })

    const signIn = await app.inject({
      method: 'POST',
      url: '/auth/sign-in/email',
      headers: { origin: ORIGIN },
      payload: { email: credentials.email, password: credentials.password },
    })

    expect(signIn.statusCode).toBe(200)

    const me = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { cookie: new CookieJar().apply(signIn.headers).header },
    })

    expect(me.statusCode).toBe(200)
    expect(me.json().email).toBe(credentials.email)
  })

  it('login com senha errada não autentica', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: { origin: ORIGIN },
      payload: credentials,
    })

    const signIn = await app.inject({
      method: 'POST',
      url: '/auth/sign-in/email',
      headers: { origin: ORIGIN },
      payload: { email: credentials.email, password: 'senha-errada-mesmo' },
    })

    expect(signIn.statusCode).toBeGreaterThanOrEqual(400)

    const me = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { cookie: new CookieJar().apply(signIn.headers).header },
    })

    expect(me.statusCode).toBe(401)
  })

  it('logout invalida a sessão: GET /me volta a 401', async () => {
    const signUp = await app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: { origin: ORIGIN },
      payload: credentials,
    })
    const jar = new CookieJar().apply(signUp.headers)

    const signOut = await app.inject({
      method: 'POST',
      url: '/auth/sign-out',
      headers: { origin: ORIGIN, cookie: jar.header },
    })
    expect(signOut.statusCode).toBe(200)

    // O logout manda o browser apagar os cookies de sessão; o jar aplica isso.
    jar.apply(signOut.headers)
    expect(jar.header).not.toContain('session_token')

    const me = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { cookie: jar.header },
    })
    expect(me.statusCode).toBe(401)
  })

  it('documenta o trade-off do cookieCache: token capturado sobrevive ao logout', async () => {
    // `session.cookieCache` (configs.ts) está ligado com maxAge de 5 min: nesse
    // intervalo o Better Auth valida a sessão a partir de um cookie assinado,
    // **sem consultar o banco**. É uma troca deliberada (menos uma query por
    // request), mas tem consequência: um token capturado ANTES do logout
    // continua valendo até o cache expirar, porque a revogação só existe no
    // banco. O browser normal não é afetado (o logout apaga os cookies dele).
    //
    // Este teste existe para que essa propriedade seja visível e intencional.
    // Se ela deixar de valer — porque alguém desligou o cookieCache, o que é
    // uma escolha legítima —, é aqui que a mudança aparece.
    const signUp = await app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: { origin: ORIGIN },
      payload: credentials,
    })
    const capturado = new CookieJar().apply(signUp.headers).header

    await app.inject({
      method: 'POST',
      url: '/auth/sign-out',
      headers: { origin: ORIGIN, cookie: capturado },
    })

    const me = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { cookie: capturado },
    })

    expect(me.statusCode).toBe(200)
  })

  it('e-mail duplicado não cria um segundo usuário', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: { origin: ORIGIN },
      payload: credentials,
    })
    expect(first.statusCode).toBe(200)

    const second = await app.inject({
      method: 'POST',
      url: '/auth/sign-up/email',
      headers: { origin: ORIGIN },
      payload: credentials,
    })
    expect(second.statusCode).toBeGreaterThanOrEqual(400)
  })
})
