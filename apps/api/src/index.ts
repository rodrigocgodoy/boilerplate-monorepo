import { isMainThread } from 'node:worker_threads'
import closeWithGrace from 'close-with-grace'
import fastify from 'fastify'
import { backendPlugin } from './plugin.js'
import { env } from './utils/environment.js'

// Ensures this file is not executed in test context
if (process.env.NODE_TEST_CONTEXT) {
  throw new Error('This file should not be executed in test context')
}

// Ensures this file is not executed in worker context
if (!isMainThread) {
  throw new Error('This file should not be executed in worker context')
}

const app = fastify({
  logger: {
    level: env.API_LOG_LEVEL,
  },
})

// Delay is the number of milliseconds for the graceful close to finish
const closeListeners = closeWithGrace({ delay: 500 }, async ({ err }) => {
  if (err) {
    app.log.error(err)
  }

  await app.close()
})

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
