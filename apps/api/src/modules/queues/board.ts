import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { FastifyAdapter } from '@bull-board/fastify'
import { prisma } from '@repo/database'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { jobs } from '@/jobs/index.js'
import { getAuthenticatedUserId } from '@/utils/auth.js'

/**
 * Bull Board — painel de inspeção das filas (jobs ativos, falhos, agendados e
 * a DLQ), montado em `/admin/queues`.
 *
 * **Protegido pela role de plataforma** (`admin`, do plugin admin do Better
 * Auth), a mesma que guarda o `/admin` no front. Deliberadamente não inventa
 * autenticação própria: o painel expõe payloads de jobs — e-mails, corpos de
 * webhook, ids de usuário — então precisa do mesmo nível de proteção do resto
 * da área administrativa, não de uma senha básica paralela que ninguém rotaciona.
 *
 * Só é montado quando há Redis. Sem fila, não há o que inspecionar.
 */

const BASE_PATH = '/admin/queues'

/**
 * A role de sistema vive na tabela `users` (o plugin admin adiciona a coluna).
 * Consultamos o banco em vez de confiar no que vem na sessão: é uma superfície
 * administrativa, e uma query a mais aqui não pesa.
 */
async function isSystemAdmin(userId: string): Promise<boolean> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  return user?.role === 'admin'
}

export async function registerQueueBoard(app: FastifyInstance): Promise<void> {
  if (!jobs.enabled) {
    app.log.info(
      `[jobs] Bull Board não montado (sem REDIS_URL). Ver UPGRADES.md.`,
    )
    return
  }

  const serverAdapter = new FastifyAdapter()
  createBullBoard({
    queues: jobs.inspectableQueues().map(queue => new BullMQAdapter(queue)),
    serverAdapter,
  })
  serverAdapter.setBasePath(BASE_PATH)

  await app.register(
    async (scope: FastifyInstance) => {
      // O guard fica em `onRequest` — antes de qualquer parsing e antes das
      // rotas do painel, inclusive os assets estáticos dele.
      scope.addHook(
        'onRequest',
        async (request: FastifyRequest, reply: FastifyReply) => {
          const userId = await getAuthenticatedUserId(
            scope as unknown as Parameters<typeof getAuthenticatedUserId>[0],
            request,
          )
          if (!userId || !(await isSystemAdmin(userId))) {
            // 404, e não 403: um painel de filas não precisa confirmar a
            // própria existência para quem não deveria alcançá-lo.
            return reply.status(404).send({ error: 'Not found' })
          }
        },
      )

      // O caminho base do painel já foi definido em `setBasePath` (é o que os
      // assets e links internos usam); aqui só montamos sob o mesmo prefixo.
      await scope.register(serverAdapter.registerPlugin(), {
        prefix: BASE_PATH,
      })
    },
    // `hide: true` equivalente: o painel serve HTML próprio e não entra no
    // OpenAPI/Kubb — não é contrato de API.
    { prefix: '/' },
  )

  app.log.info(`[jobs] Bull Board em ${BASE_PATH} (requer role admin)`)
}
