import { spawnSync } from 'node:child_process'
import process from 'node:process'

/**
 * Sobe um Postgres **efêmero**, aplica as migrations, roda o comando recebido
 * com `TEST_DATABASE_URL` apontando pra ele e derruba tudo no fim — mesmo se o
 * comando falhar ou você der Ctrl+C.
 *
 * ```bash
 * pnpm test:db                       # a suíte inteira, integração incluída
 * pnpm tsx scripts/test-db.ts pnpm --filter @repo/api test
 * ```
 *
 * O teardown é o ponto do script: sem ele, um container órfão sobrevive à
 * suíte e o teste seguinte herda dados do anterior — o modo mais chato de
 * flakiness, porque só aparece na segunda execução.
 */

const COMPOSE_FILE = 'docker-compose.test.yml'
const SERVICE = 'postgres-test'
const PORT = process.env.TEST_DB_PORT ?? '55432'
const DATABASE_URL = `postgresql://postgres:postgres@localhost:${PORT}/boilerplate_test?schema=public`

/** Roda um comando herdando stdio; devolve o exit code. */
function run(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv = {},
): number {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: { ...process.env, ...env },
    shell: false,
  })
  if (result.error) {
    console.error(`[test-db] falha ao executar "${command}":`, result.error)
    return 1
  }
  return result.status ?? 1
}

const compose = (...args: string[]) =>
  run('docker', ['compose', '-f', COMPOSE_FILE, ...args])

function up(): void {
  console.info(`[test-db] subindo ${SERVICE} em localhost:${PORT}…`)
  // `--wait` só retorna quando o healthcheck passa: sem isso, o migrate deploy
  // corre antes do Postgres aceitar conexão.
  if (compose('up', '-d', '--wait', SERVICE) !== 0) {
    throw new Error(
      '[test-db] não consegui subir o Postgres de teste. O Docker está rodando?',
    )
  }

  console.info('[test-db] aplicando migrations…')
  const migrated = run(
    'pnpm',
    ['--filter', '@repo/database', 'exec', 'prisma', 'migrate', 'deploy'],
    { DATABASE_URL },
  )
  if (migrated !== 0) throw new Error('[test-db] migrate deploy falhou')
}

function down(): void {
  console.info('[test-db] derrubando o banco de teste…')
  // `-v` remove volumes anônimos; o tmpfs já morre com o container, mas isso
  // mantém o comando correto caso alguém troque o tmpfs por um volume.
  compose('down', '-v', '--remove-orphans')
}

const [command, ...args] = process.argv.slice(2)

if (!command) {
  console.error('[test-db] uso: tsx scripts/test-db.ts <comando> [args...]')
  process.exit(1)
}

// Ctrl+C durante a suíte também precisa derrubar o container.
let tornDown = false
const teardownOnce = () => {
  if (tornDown) return
  tornDown = true
  down()
}
process.on('SIGINT', () => {
  teardownOnce()
  process.exit(130)
})
process.on('SIGTERM', () => {
  teardownOnce()
  process.exit(143)
})

let exitCode = 1
try {
  up()
  exitCode = run(command, args, {
    TEST_DATABASE_URL: DATABASE_URL,
    DATABASE_URL,
  })
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  exitCode = 1
} finally {
  teardownOnce()
}

process.exit(exitCode)
