// IMPORTANTE: 1º import — inicializa o Sentry antes dos demais módulos (ver
// instrument.ts). Sem SENTRY_DSN é no-op.
import './instrument.js'
import { randomUUID } from 'node:crypto'
import { isMainThread } from 'node:worker_threads'
import closeWithGrace from 'close-with-grace'
import fastify from 'fastify'
import { backendPlugin } from './plugin.js'
import { env } from './utils/environment.js'
import { loggerOptions } from './utils/logger.js'

// Ensures this file is not executed in test context
if (process.env.NODE_TEST_CONTEXT) {
  throw new Error('This file should not be executed in test context')
}

// Ensures this file is not executed in worker context
if (!isMainThread) {
  throw new Error('This file should not be executed in worker context')
}

const app = fastify({
  // Nível, redaction e pino-pretty (só em dev) vêm de `utils/logger.ts`,
  // compartilhados com o worker.
  logger: loggerOptions,
  // requestId: honra um `x-request-id` recebido (correlação entre serviços) ou
  // gera um UUID. Aparece em todo log da request (`reqId`) e nas respostas de
  // erro 5xx, facilitando rastrear no Sentry/logs.
  requestIdHeader: 'x-request-id',
  genReqId: () => randomUUID(),
})

// `delay` é o orçamento TOTAL até o kill forçado, não uma folga extra. Com
// `JOBS_IN_PROCESS=true` (default), o `app.close()` dispara o `onClose` que
// para o worker de jobs — e o BullMQ espera o job ativo terminar. Meio segundo
// não dá para isso: reusamos o mesmo teto do worker dedicado.
const closeListeners = closeWithGrace(
  { delay: env.JOBS_SHUTDOWN_TIMEOUT_MS },
  async ({ err }) => {
    if (err) {
      app.log.error(err)
    }

    await app.close()
  },
)

// Cancelling the close listeners
app.addHook('onClose', async () => {
  closeListeners.uninstall()
})

// Registers our backend
await app.register(backendPlugin)

// Starts the server
await app.listen({
  port: env.PORT,
  host: env.HOST,
})

app.log.info(`Server listening on ${env.HOST}:${env.PORT}`)
