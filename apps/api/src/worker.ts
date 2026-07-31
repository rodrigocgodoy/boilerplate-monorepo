// 1º import: inicializa o Sentry (no-op sem SENTRY_DSN). Ver instrument.ts.
import './instrument.js'
import closeWithGrace from 'close-with-grace'
import { jobs } from './jobs/index.js'
import { env } from './utils/environment.js'
import { createWorkerLogger } from './utils/logger.js'

/**
 * Worker de jobs dedicado (para escalar separado da API). Rode com
 * `JOBS_IN_PROCESS=false` na API para evitar processar duas vezes.
 *
 * Dev: `pnpm worker` · Produção: `node dist/worker.js`.
 */

// Pino com a mesma configuração da API — inclusive a redaction. Antes eram
// `console.info`/`console.error`: texto solto, sem nível, sem timestamp e sem
// redaction, num processo que manipula payloads de e-mail e webhook.
const logger = createWorkerLogger()

if (!env.REDIS_URL) {
  logger.info('[worker] REDIS_URL ausente — nada a processar. Ver UPGRADES.md.')
  process.exit(0)
}

await jobs.start(logger)
logger.info('[worker] pronto, aguardando jobs…')

/**
 * Shutdown gracioso.
 *
 * O `delay` do `close-with-grace` é o **orçamento total** até o kill forçado,
 * não uma folga depois do handler. Com os 500 ms que estavam aqui, qualquer job
 * mais lento que meio segundo — na prática todos: enviar e-mail, processar
 * webhook — era interrompido no meio de um deploy. O job voltava para a fila e
 * reprocessava; nos handlers idempotentes isso é desperdício, nos demais é
 * efeito duplicado.
 *
 * `jobs.stop()` fecha o worker sem `force`, então o BullMQ espera o job ativo
 * terminar. O teto existe para o caso de o job travar de vez.
 */
closeWithGrace(
  { delay: env.JOBS_SHUTDOWN_TIMEOUT_MS },
  async ({ err, signal }) => {
    if (err) logger.error({ err }, '[worker] erro ao encerrar')
    logger.info(
      `[worker] encerrando (${signal ?? 'sem sinal'}) — aguardando o job em andamento…`,
    )
    await jobs.stop()
    logger.info('[worker] encerrado')
  },
)
