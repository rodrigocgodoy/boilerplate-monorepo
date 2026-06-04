import { type JobsOptions, Queue, Worker } from 'bullmq'
import { Redis } from 'ioredis'

/**
 * Infra de jobs em background (BullMQ + Redis), genérica e desacoplada da app.
 *
 * Filosofia do boilerplate: **funciona sem infra**. Sem `redisUrl`, `enqueue`
 * roda o handler **inline** (síncrono) — o app funciona em dev sem Redis. Com
 * `redisUrl`, vira uma fila de verdade (retries/backoff + jobs agendados).
 *
 * Os *handlers* concretos vivem na app (que pode importar prisma, e-mails,
 * serviços); aqui só tratamos da fila, do worker e do agendador.
 */

export type JobLogger = {
  info: (msg: string) => void
  error: (msg: string, err?: unknown) => void
}

const noopLogger: JobLogger = { info: () => {}, error: () => {} }

// biome-ignore lint/suspicious/noExplicitAny: o mapa de handlers é genérico
type AnyHandler = (data: any) => unknown | Promise<unknown>

/** Mapa nome-do-job → handler. As chaves viram os nomes dos jobs. */
export type JobHandlers = Record<string, AnyHandler>

/** Agendamento de um job recorrente (cron) — para tarefas periódicas. */
export type Schedule<H extends JobHandlers> = {
  [K in keyof H]: {
    job: K
    /** Padrão cron, ex.: `'0 3 * * *'` (todo dia às 03:00). */
    pattern: string
    data?: Parameters<H[K]>[0]
  }
}[keyof H]

export interface JobRunner<H extends JobHandlers> {
  /** `true` quando o Redis está configurado (jobs assíncronos ativos). */
  readonly enabled: boolean
  /** Enfileira um job. Sem Redis, roda o handler inline. */
  enqueue<K extends keyof H & string>(
    job: K,
    data: Parameters<H[K]>[0],
    opts?: JobsOptions,
  ): Promise<void>
  /** Sobe o worker e registra os jobs agendados. No-op sem Redis. */
  start(logger?: JobLogger): Promise<void>
  /** Encerra worker, fila e conexões. */
  stop(): Promise<void>
}

export interface JobRunnerConfig<H extends JobHandlers> {
  /** URL do Redis. Vazio/undefined = modo inline (sem fila). */
  redisUrl?: string
  handlers: H
  schedules?: Schedule<H>[]
  /** Nome da fila no Redis (default `jobs`). */
  queueName?: string
  /** Opções padrão dos jobs (retries/backoff/limpeza). */
  defaultJobOptions?: JobsOptions
}

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: 1_000,
  removeOnFail: 5_000,
}

export function createJobRunner<H extends JobHandlers>(
  config: JobRunnerConfig<H>,
): JobRunner<H> {
  const { handlers, schedules = [], queueName = 'jobs', redisUrl } = config

  async function runInline<K extends keyof H & string>(
    job: K,
    data: Parameters<H[K]>[0],
  ): Promise<void> {
    const handler = handlers[job]
    if (!handler) throw new Error(`Job desconhecido: ${job}`)
    await handler(data)
  }

  // ── Modo inline (sem Redis) ───────────────────────────────────────────────
  if (!redisUrl) {
    return {
      enabled: false,
      enqueue: runInline,
      async start(logger = noopLogger) {
        logger.info(
          '[jobs] REDIS_URL ausente — jobs rodam inline (dev). Ver UPGRADES.md.',
        )
      },
      async stop() {},
    }
  }

  // ── Modo fila (BullMQ + Redis) ────────────────────────────────────────────
  // `url` fixa o narrowing de `redisUrl` (string) para uso dentro das closures.
  // Conexões separadas para fila e worker (recomendação do BullMQ); o worker
  // exige `maxRetriesPerRequest: null` na conexão de bloqueio. A conexão da fila
  // é lazy: só abre no primeiro enqueue/start, para que apenas importar o runner
  // (ex.: CLIs como auth:generate, via configs.ts) não conecte no Redis.
  const url = redisUrl
  let queue: Queue | undefined
  let queueConnection: Redis | undefined
  let worker: Worker | undefined
  let workerConnection: Redis | undefined

  function getQueue(): Queue {
    if (!queue) {
      queueConnection = new Redis(url, { maxRetriesPerRequest: null })
      queue = new Queue(queueName, {
        connection: queueConnection,
        defaultJobOptions: config.defaultJobOptions ?? DEFAULT_JOB_OPTIONS,
      })
    }
    return queue
  }

  return {
    enabled: true,
    async enqueue(job, data, opts) {
      await getQueue().add(job, data, opts)
    },
    async start(logger = noopLogger) {
      const q = getQueue()
      workerConnection = new Redis(url, { maxRetriesPerRequest: null })
      worker = new Worker(
        queueName,
        async job => {
          const handler = handlers[job.name]
          if (!handler) throw new Error(`Job desconhecido: ${job.name}`)
          await handler(job.data)
        },
        { connection: workerConnection },
      )
      worker.on('failed', (job, err) =>
        logger.error(`[jobs] "${job?.name}" falhou`, err),
      )
      // Jobs agendados (idempotente — mesmo schedulerId só atualiza o padrão).
      for (const s of schedules) {
        await q.upsertJobScheduler(
          `sched:${String(s.job)}`,
          { pattern: s.pattern },
          { name: String(s.job), data: s.data },
        )
      }
      logger.info(
        `[jobs] worker iniciado · fila "${queueName}" · ${schedules.length} agendamento(s)`,
      )
    },
    async stop() {
      await worker?.close()
      await queue?.close()
      await queueConnection?.quit()
      await workerConnection?.quit()
    },
  }
}
