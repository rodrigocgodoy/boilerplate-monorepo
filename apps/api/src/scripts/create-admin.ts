import { createInterface } from 'node:readline/promises'
import { prisma } from '@repo/database'
import { auth } from '@/utils/auth.js'

/**
 * Cria (ou promove) um super-admin da plataforma.
 *
 * ```bash
 * pnpm admin:create                              # pergunta e-mail e senha
 * pnpm admin:create --email you@empresa.com      # pergunta só a senha
 * ADMIN_EMAIL=… ADMIN_PASSWORD=… pnpm admin:create   # não-interativo (CI/deploy)
 * ```
 *
 * **Por que um comando e não uma variável de ambiente.** A role de plataforma
 * vive em `users.role`, e esse é o único lugar que decide quem é admin. Uma
 * env que promovesse no login seria uma segunda fonte da verdade — e uma que
 * mente, porque tirar o e-mail da lista não rebaixa ninguém. Virar admin é um
 * ato deliberado e raro; merece um comando explícito, não configuração
 * ambiente que ninguém lembra de auditar.
 *
 * O usuário é criado pela própria API do Better Auth (mesmo hash de senha,
 * mesmos hooks — inclusive a organização pessoal). Nada de escrever na tabela
 * de usuários por fora.
 */

type Args = { email?: string; password?: string; name?: string }

function parseArgs(argv: string[]): Args {
  const args: Args = {}
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split('=')
    const value = inline ?? argv[i + 1]
    if (flag === '--email') args.email = value
    if (flag === '--password') args.password = value
    if (flag === '--name') args.name = value
  }
  return args
}

/**
 * Lê uma linha do terminal sem ecoar o que foi digitado.
 *
 * O `readline` não esconde entrada; sem isto a senha ficaria visível na tela e,
 * pior, no histórico de scroll de quem estiver assistindo um deploy.
 */
async function promptHidden(question: string): Promise<string> {
  process.stdout.write(question)
  const stdin = process.stdin
  const wasRaw = stdin.isRaw

  if (!stdin.isTTY) {
    // Sem terminal (pipe, CI): lê normalmente, sem prometer que esconde.
    const rl = createInterface({ input: stdin, output: process.stdout })
    const answer = await rl.question('')
    rl.close()
    return answer
  }

  stdin.setRawMode(true)
  stdin.resume()

  return new Promise(resolve => {
    let value = ''
    const onData = (chunk: Buffer) => {
      const char = chunk.toString('utf8')

      // Enter (LF ou CR) encerra a leitura.
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.removeListener('data', onData)
        stdin.setRawMode(wasRaw ?? false)
        stdin.pause()
        process.stdout.write('\n')
        resolve(value)
        return
      }

      // Ctrl-C precisa continuar interrompendo: em raw mode o terminal não
      // manda mais SIGINT sozinho, e sem isto o prompt ficaria preso.
      if (char === '\u0003') {
        stdin.setRawMode(wasRaw ?? false)
        process.stdout.write('\n')
        process.exit(130)
      }

      // Backspace (DEL) apaga o último caractere.
      if (char === '\u007f' || char === '\b') {
        value = value.slice(0, -1)
        return
      }

      value += char
    }
    stdin.on('data', onData)
  })
}

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(question)
  rl.close()
  return answer.trim()
}

export type EnsureAdminResult =
  | { status: 'already-admin'; email: string }
  | { status: 'promoted'; email: string; id: string }
  | { status: 'created'; email: string; id: string }

/**
 * Garante que existe um admin com este e-mail.
 *
 * Separado do I/O do terminal de propósito: é o que se pode testar contra um
 * banco de verdade, sem simular teclado. As três saídas cobrem o ciclo de vida
 * inteiro — conta nova, conta que existia e conta que já era admin.
 */
export async function ensureAdmin(input: {
  email: string
  password?: string
  name?: string
}): Promise<EnsureAdminResult> {
  const email = input.email.trim().toLowerCase()

  const existing = await prisma.users.findUnique({
    where: { email },
    select: { id: true, role: true },
  })

  if (existing) {
    if (existing.role === 'admin') return { status: 'already-admin', email }
    await prisma.users.update({
      where: { id: existing.id },
      data: { role: 'admin' },
    })
    return { status: 'promoted', email, id: existing.id }
  }

  if (!input.password || input.password.length < 8) {
    throw new Error('A senha precisa ter ao menos 8 caracteres.')
  }

  // Cria pela API do Better Auth: mesmo hash de senha e mesmos hooks (inclusive
  // a organização pessoal). Escrever direto na tabela criaria um usuário que
  // não consegue logar.
  await auth.api.signUpEmail({
    body: {
      name: input.name ?? email.split('@')[0],
      email,
      password: input.password,
    },
  })

  // Promoção em segundo passo: o signup sempre cria com a role padrão
  // (`user`), e forçar outra por dentro do plugin acoplaria isto à
  // implementação dele.
  const created = await prisma.users.update({
    where: { email },
    data: { role: 'admin' },
    select: { id: true },
  })
  return { status: 'created', email, id: created.id }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  const email = (
    args.email ??
    process.env.ADMIN_EMAIL ??
    (await ask('E-mail do admin: '))
  )
    .trim()
    .toLowerCase()

  if (!email.includes('@')) {
    console.error(`\n✗ E-mail inválido: "${email}"`)
    process.exit(1)
  }

  // Só pede senha se a conta não existe — promover não precisa dela.
  const known = await prisma.users.findUnique({
    where: { email },
    select: { id: true },
  })
  const password = known
    ? undefined
    : (args.password ??
      process.env.ADMIN_PASSWORD ??
      (await promptHidden('Senha (mínimo 8 caracteres): ')))

  try {
    const result = await ensureAdmin({
      email,
      password,
      name: args.name ?? process.env.ADMIN_NAME,
    })

    if (result.status === 'already-admin') {
      console.info(`\n✓ ${email} já é admin. Nada a fazer.`)
    } else if (result.status === 'promoted') {
      console.info(`\n✓ ${email} promovido a admin.`)
    } else {
      console.info(`\n✓ Admin criado: ${email} (${result.id})`)
      console.info('  Acesse o painel e promova os demais por lá.')
    }
  } catch (error) {
    console.error(
      `\n✗ ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exit(1)
  }
}

main()
  .catch(error => {
    console.error('\n✗ Falhou:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
