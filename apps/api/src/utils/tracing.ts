import * as Sentry from '@sentry/node'
import type { FastifyInstance } from 'fastify'
import { env } from '@/utils/environment.js'

/**
 * Liga log e rastro: cada linha de log da request ganha o `trace_id` do Sentry.
 *
 * Sem isso, log e Sentry são duas ilhas — você abre um erro no Sentry e não
 * consegue puxar o que o servidor registrou naquela request, nem partir de uma
 * linha de log suspeita para o trace correspondente. O `requestId` já liga
 * cliente ↔ log; o `trace_id` liga log ↔ Sentry.
 *
 * No-op sem `SENTRY_DSN`: sem Sentry não há trace, e um campo sempre vazio só
 * ocuparia espaço em todas as linhas.
 */
export function registerTracing(app: FastifyInstance): void {
  if (!env.SENTRY_DSN) return

  app.addHook('onRequest', async request => {
    const traceId = Sentry.getActiveSpan()?.spanContext().traceId
    if (traceId) {
      // `child` cria um logger que carrega o campo em toda linha desta request.
      request.log = request.log.child({ trace_id: traceId })
    }

    // Correlação inversa: o `requestId` vira tag no Sentry, então dá para achar
    // o evento a partir de um id que o cliente reportou.
    Sentry.setTag('request_id', String(request.id))
  })
}

/**
 * Anexa o usuário autenticado ao evento do Sentry.
 *
 * Só o `id`: e-mail e nome são dados pessoais e o `sendDefaultPii` está
 * desligado de propósito. O id basta para responder "quantos usuários esse erro
 * atingiu" e para achar a conta, sem transformar o Sentry num cadastro.
 */
export function setSentryUser(userId: string | null): void {
  if (!env.SENTRY_DSN) return
  Sentry.setUser(userId ? { id: userId } : null)
}
