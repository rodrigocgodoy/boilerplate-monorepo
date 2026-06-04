// 1º import: inicializa o Sentry (no-op sem SENTRY_DSN). Ver instrument.ts.
import './instrument.js'
import closeWithGrace from 'close-with-grace'
import { jobs } from './jobs/index.js'
import { env } from './utils/environment.js'

/**
 * Worker de jobs dedicado (para escalar separado da API). Rode com
 * `JOBS_IN_PROCESS=false` na API para evitar processar duas vezes.
 *
 * Dev: `pnpm worker` · Produção: `node dist/worker.js`.
 */

const logger = { info: console.info, error: console.error }

if (!env.REDIS_URL) {
  logger.info('[worker] REDIS_URL ausente — nada a processar. Ver UPGRADES.md.')
  process.exit(0)
}

await jobs.start(logger)
logger.info('[worker] pronto, aguardando jobs…')

closeWithGrace({ delay: 500 }, async ({ err }) => {
  if (err) logger.error('[worker] erro ao encerrar', err)
  await jobs.stop()
})
