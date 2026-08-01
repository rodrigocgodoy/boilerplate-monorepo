import { prisma } from '@repo/database'
import { beforeEach, expect, it } from 'vitest'
import { ensureAdmin } from '@/scripts/create-admin.js'
import { createUser, describeDb, resetDb } from './helpers/db.js'

/**
 * `pnpm admin:create` — o único jeito de criar o primeiro super-admin.
 *
 * Substituiu a variável `ADMIN_EMAILS`, que promovia no login. A env era uma
 * segunda fonte da verdade **e mentia**: tirar um e-mail da lista não rebaixava
 * ninguém, então ela dizia quem era admin sem ser quem decidia. Agora a coluna
 * `users.role` é o único lugar que responde essa pergunta.
 *
 * Como é o caminho de bootstrap de uma superfície que bane, remove conta e
 * impersona, os três estados do ciclo de vida ficam travados aqui.
 */
describeDb('ensureAdmin (bootstrap do super-admin)', () => {
  beforeEach(resetDb)

  it('cria a conta pela API do Better Auth e promove', async () => {
    const result = await ensureAdmin({
      email: 'Chefe@Empresa.com',
      password: 'senha-super-secreta',
      name: 'Chefe',
    })

    expect(result).toMatchObject({
      status: 'created',
      email: 'chefe@empresa.com', // normalizado para minúsculas
    })

    const user = await prisma.users.findUnique({
      where: { email: 'chefe@empresa.com' },
      select: { role: true, name: true },
    })
    expect(user).toMatchObject({ role: 'admin', name: 'Chefe' })

    // Criado pela API do Better Auth, então tem credencial e consegue logar.
    // Escrever direto na tabela produziria um admin que não entra.
    const account = await prisma.accounts.findFirst({
      where: { users: { email: 'chefe@empresa.com' } },
      select: { providerId: true, password: true },
    })
    expect(account?.providerId).toBe('credential')
    expect(account?.password).toBeTruthy()
  })

  it('promove uma conta que já existia, sem pedir senha', async () => {
    const existing = await createUser({ email: 'ana@empresa.com' })

    const result = await ensureAdmin({ email: 'ana@empresa.com' })

    expect(result).toMatchObject({ status: 'promoted', id: existing.id })
    const user = await prisma.users.findUnique({
      where: { id: existing.id },
      select: { role: true },
    })
    expect(user?.role).toBe('admin')
  })

  it('é idempotente: rodar de novo não muda nada', async () => {
    await createUser({ email: 'ja@empresa.com', role: 'admin' })

    const result = await ensureAdmin({ email: 'ja@empresa.com' })

    expect(result).toEqual({ status: 'already-admin', email: 'ja@empresa.com' })
  })

  it('recusa criar conta nova com senha fraca', async () => {
    await expect(
      ensureAdmin({ email: 'novo@empresa.com', password: '123' }),
    ).rejects.toThrow(/ao menos 8 caracteres/)

    // E não deixa lixo para trás.
    const user = await prisma.users.findUnique({
      where: { email: 'novo@empresa.com' },
    })
    expect(user).toBeNull()
  })

  it('cria a organização pessoal junto (hooks do Better Auth rodaram)', async () => {
    await ensureAdmin({
      email: 'org@empresa.com',
      password: 'senha-super-secreta',
    })

    // A org pessoal nasce num hook de `session.create`. Se ela existe, o
    // caminho oficial foi usado — e não um INSERT por fora.
    const member = await prisma.member.findFirst({
      where: { users: { email: 'org@empresa.com' } },
      select: { role: true },
    })
    expect(member?.role).toBe('owner')
  })
})
