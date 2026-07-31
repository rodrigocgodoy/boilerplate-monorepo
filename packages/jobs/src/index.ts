import { type JobsOptions, Queue, UnrecoverableError, Worker } from 'bullmq'
import { Redis } from 'ioredis'
import type { ZodType } from 'zod'

/**
 * Infra de jobs em background (BullMQ + Redis), genérica e desacoplada da app.
 *
 * Filosofia do boilerplate: **funciona sem infra**. Sem `redisUrl`, `enqueue`
 * roda o handler **inline** (síncrono) — o app funciona em dev sem Redis. Com
 * `redisUrl`, vira uma fila de verdade (retries/backoff, agendador e DLQ).
 *
 * Os *handlers* concretos vivem na app (que pode importar prisma, e-mails,
 * serviços); aqui só tratamos da fila, do worker, do agendador e da DLQ.
 */

export type JobLogger = {
  info: (msg: string) => void
  error: (msg: string, err?: unknown) => void
  /**
   * Cria um logger que carrega campos fixos em toda linha (assinatura do Pino).
   * Opcional: um logger simples continua funcionando, só sem correlação.
   */
  child?: (bindings: Record<string, unknown>) => JobLogger
}

const noopLogger: JobLogger = { info: () => {}, error: () => {} }

/**
 * Handler genérico. O parâmetro é `never` (e não `any`) de propósito: por
 * contravariância, qualquer handler concreto — `(data: EmailJob) => …` — é
 * atribuível a este tipo, e o payload real continua sendo inferido de cada
 * entrada do mapa via `JobPayload`. Nada de `any` no caminho.
 */
type AnyHandler = (data: never) => unknown | Promise<unknown>

/**
 * Chama um handler com o payload já validado.
 *
 * O `never` no parâmetro de `AnyHandler` é o que dá a contravariância do mapa
 * (e o que evita o `any`), mas em troca o TypeScript considera o handler
 * "inchamável". O cast é inevitável e fica isolado aqui, num único ponto, logo
 * depois do `parse` — ou seja, o dado já passou pelo schema.
 */
function invoke(handler: AnyHandler, data: unknown): Promise<unknown> {
  return Promise.resolve((handler as (d: unknown) => unknown)(data))
}

/** Mapa nome-do-job → handler. As chaves viram os nomes dos jobs. */
export type JobHandlers = Record<string, AnyHandler>

/** Payload que um handler recebe. */
export type JobPayload<H extends JobHandlers, K extends keyof H> = Parameters<
  H[K]
>[0]

/**
 * Schemas Zod dos payloads — um por handler, **obrigatório**.
 *
 * O tipo é mapeado sobre os handlers: esquecer um job, ou escrever um schema
 * cujo output não bate com o parâmetro do handler, é erro de compilação. É a
 * mesma disciplina de contrato que a API já aplica nas rotas, agora na borda da
 * fila — que é uma borda de verdade: o payload atravessa processo e tempo
 * (pode ter sido enfileirado por um deploy antigo).
 */
export type JobSchemas<H extends JobHandlers> = {
  [K in keyof H]: ZodType<JobPayload<H, K>>
}

/** Agendamento de um job recorrente (cron) — para tarefas periódicas. */
export type Schedule<H extends JobHandlers> = {
  [K in keyof H]: {
    job: K
    /** Padrão cron, ex.: `'0 3 * * *'` (todo dia às 03:00). */
    pattern: string
    data?: JobPayload<H, K>
  }
}[keyof H]

/** Registro de um job que esgotou as tentativas (conteúdo da DLQ). */
export type DeadLetter = {
  /** Nome do job original. */
  job: string
  /** Payload original, como estava na fila. */
  data: unknown
  /** Mensagem do último erro. */
  error: string
  /** Quantas tentativas foram feitas antes de desistir. */
  attemptsMade: number
  /** ISO string do momento em que entrou na DLQ. */
  failedAt: string
}

export interface JobRunner<H extends JobHandlers> {
  /** `true` quando o Redis está configurado (jobs assíncronos ativos). */
  readonly enabled: boolean
  /** Nome da fila principal. */
  readonly queueName: string
  /** Nome da dead-letter queue. */
  readonly deadLetterQueueName: string
  /**
   * Enfileira um job. Valida o payload **antes** de publicar: um payload
   * inválido falha aqui, no produtor, onde o stack trace aponta para quem
   * errou — e não horas depois, dentro do worker. Sem Redis, roda inline.
   */
  enqueue<K extends keyof H & string>(
    job: K,
    data: JobPayload<H, K>,
    opts?: JobsOptions,
  ): Promise<void>
  /** Sobe o worker e registra os jobs agendados. No-op sem Redis. */
  start(logger?: JobLogger): Promise<void>
  /**
   * Filas cruas (BullMQ) para ferramentas de inspeção, como o Bull Board.
   * Vazio no modo inline — sem Redis não há o que inspecionar.
   */
  inspectableQueues(): Queue[]
  /** Lê a DLQ (mais recentes primeiro). Vazio sem Redis. */
  listDeadLetters(limit?: number): Promise<DeadLetter[]>
  /**
   * Devolve os jobs da DLQ para a fila principal e limpa a DLQ. Retorna
   * quantos foram reprocessados.
   */
  replayDeadLetters(limit?: number): Promise<number>
  /**
   * Encerra worker, fila e conexões, **esperando o job em andamento
   * terminar**. Quem chama é que define o teto de tempo (ver `worker.ts`).
   */
  stop(): Promise<void>
}

export interface JobRunnerConfig<H extends JobHandlers> {
  /** URL do Redis. Vazio/undefined = modo inline (sem fila). */
  redisUrl?: string
  handlers: H
  schemas: JobSchemas<H>
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
  // Mantém as falhas recentes na fila principal: é o que faz a aba "Failed" do
  // Bull Board ter o botão de retry nativo. A DLQ é o registro durável.
  removeOnFail: 5_000,
}

export function createJobRunner<H extends JobHandlers>(
  config: JobRunnerConfig<H>,
): JobRunner<H> {
  const {
    handlers,
    schemas,
    schedules = [],
    queueName = 'jobs',
    redisUrl,
  } = config
  const deadLetterQueueName = `${queueName}-dlq`

  /**
   * Valida e devolve o payload já parseado. A mensagem inclui o nome do job
   * porque o erro cru do Zod, sozinho, não diz de qual fila ele veio.
   */
  function parse<K extends keyof H & string>(
    job: K,
    data: unknown,
  ): JobPayload<H, K> {
    const schema = schemas[job]
    if (!schema) throw new Error(`Job desconhecido: ${job}`)
    const result = schema.safeParse(data)
    if (!result.success) {
      throw new Error(
        `Payload inválido para o job "${job}": ${result.error.message}`,
      )
    }
    return result.data
  }

  async function runInline<K extends keyof H & string>(
    job: K,
    data: JobPayload<H, K>,
  ): Promise<void> {
    const handler = handlers[job]
    if (!handler) throw new Error(`Job desconhecido: ${job}`)
    // Mesmo inline o payload é validado: o modo dev não pode ser mais frouxo
    // que produção, senão o erro só aparece no deploy.
    await invoke(handler, parse(job, data))
  }

  // ── Modo inline (sem Redis) ───────────────────────────────────────────────
  if (!redisUrl) {
    return {
      enabled: false,
      queueName,
      deadLetterQueueName,
      enqueue: runInline,
      async start(logger = noopLogger) {
        logger.info(
          '[jobs] REDIS_URL ausente — jobs rodam inline (dev). Ver UPGRADES.md.',
        )
      },
      inspectableQueues() {
        return []
      },
      async listDeadLetters() {
        return []
      },
      async replayDeadLetters() {
        return 0
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
  let deadLetterQueue: Queue | undefined
  let queueConnection: Redis | undefined
  let worker: Worker | undefined
  let workerConnection: Redis | undefined
  /** Promessa do shutdown em curso — torna `stop()` idempotente. */
  let stopping: Promise<void> | undefined

  /** Conexão compartilhada pela fila principal e pela DLQ (lazy). */
  function getQueueConnection(): Redis {
    if (!queueConnection) {
      queueConnection = new Redis(url, { maxRetriesPerRequest: null })
    }
    return queueConnection
  }

  function getQueue(): Queue {
    if (!queue) {
      queue = new Queue(queueName, {
        connection: getQueueConnection(),
        defaultJobOptions: config.defaultJobOptions ?? DEFAULT_JOB_OPTIONS,
      })
    }
    return queue
  }

  /**
   * Fila de dead-letter. Compartilha a conexão da fila principal e **não tem
   * worker**: nada consome daqui. É um registro durável do que falhou de vez,
   * para inspeção (Bull Board) e replay explícito.
   */
  function getDeadLetterQueue(): Queue {
    if (!deadLetterQueue) {
      deadLetterQueue = new Queue(deadLetterQueueName, {
        connection: getQueueConnection(),
        // Nada é reprocessado automaticamente aqui.
        defaultJobOptions: { attempts: 1, removeOnComplete: false },
      })
    }
    return deadLetterQueue
  }

  return {
    enabled: true,
    queueName,
    deadLetterQueueName,
    async enqueue(job, data, opts) {
      await getQueue().add(job, parse(job, data), opts)
    },
    async start(logger = noopLogger) {
      const q = getQueue()
      const dlq = getDeadLetterQueue()
      workerConnection = new Redis(url, { maxRetriesPerRequest: null })
      worker = new Worker(
        queueName,
        async job => {
          // Todo log deste job carrega `jobId` e `job`. É o que permite pegar
          // uma falha no worker e reconstruir o que aconteceu: sem isso, as
          // linhas de N jobs processados em paralelo se misturam no stdout sem
          // nada que as separe. O `jobId` é o mesmo que o produtor conhece
          // (passado em `opts.jobId` nos webhooks), então liga request → job.
          const log = logger.child?.({ jobId: job.id, job: job.name }) ?? logger
          const startedAt = Date.now()
          log.info('[jobs] processando')

          const handler = handlers[job.name]
          if (!handler) throw new Error(`Job desconhecido: ${job.name}`)

          // Revalida na entrada do worker. O payload atravessou processo e
          // tempo — pode ter sido enfileirado por uma versão anterior do
          // código, com outro formato.
          const schema = schemas[job.name]
          const parsed = schema?.safeParse(job.data)
          if (!parsed?.success) {
            // `UnrecoverableError` pula as tentativas restantes: payload
            // inválido não melhora com retry, só queima backoff.
            throw new UnrecoverableError(
              `Payload inválido para o job "${job.name}": ${
                parsed?.error.message ?? 'schema ausente'
              }`,
            )
          }

          await invoke(handler, parsed.data)
          log.info(`[jobs] concluído em ${Date.now() - startedAt}ms`)
        },
        { connection: workerConnection },
      )

      worker.on('failed', async (job, err) => {
        const log = logger.child?.({ jobId: job?.id, job: job?.name }) ?? logger
        log.error(`[jobs] falhou (tentativa ${job?.attemptsMade ?? '?'})`, err)
        if (!job) return

        // O evento `failed` dispara a cada tentativa. Só vai para a DLQ quando
        // não há mais tentativas pela frente — seja porque esgotaram, seja
        // porque o erro é irrecuperável (payload inválido).
        const maxAttempts = job.opts.attempts ?? 1
        const exhausted = job.attemptsMade >= maxAttempts
        const unrecoverable = err instanceof UnrecoverableError
        if (!exhausted && !unrecoverable) return

        const entry: DeadLetter = {
          job: job.name,
          data: job.data,
          error: err.message,
          attemptsMade: job.attemptsMade,
          failedAt: new Date().toISOString(),
        }
        try {
          await dlq.add(job.name, entry)
        } catch (dlqError) {
          // A DLQ é o último recurso; se ela falhar, o log é tudo que sobra.
          logger.error('[jobs] falha ao gravar na DLQ', dlqError)
        }
      })

      // Jobs agendados (idempotente — mesmo schedulerId só atualiza o padrão).
      for (const s of schedules) {
        await q.upsertJobScheduler(
          `sched:${String(s.job)}`,
          { pattern: s.pattern },
          { name: String(s.job), data: s.data },
        )
      }
      logger.info(
        `[jobs] worker iniciado · fila "${queueName}" · ${schedules.length} agendamento(s) · DLQ "${deadLetterQueueName}"`,
      )
    },

    inspectableQueues() {
      return [getQueue(), getDeadLetterQueue()]
    },

    async listDeadLetters(limit = 100) {
      const jobs = await getDeadLetterQueue().getJobs(
        ['waiting', 'delayed', 'prioritized'],
        0,
        limit - 1,
      )
      return jobs.map(j => j.data as DeadLetter).reverse()
    },

    async replayDeadLetters(limit = 100) {
      const dlq = getDeadLetterQueue()
      const q = getQueue()
      const jobs = await dlq.getJobs(
        ['waiting', 'delayed', 'prioritized'],
        0,
        limit - 1,
      )

      let replayed = 0
      for (const job of jobs) {
        const entry = job.data as DeadLetter
        // Republicar valida o payload de novo: se a DLQ guardou algo que o
        // schema atual recusa, o replay para aqui em vez de reenfileirar lixo.
        await q.add(entry.job, parse(entry.job as keyof H & string, entry.data))
        await job.remove()
        replayed++
      }
      return replayed
    },

    async stop() {
      // Idempotente e seguro em chamadas concorrentes: guarda a promessa e a
      // reaproveita. Sem isso, o segundo `quit()` numa conexão já fechada
      // lança "Connection is closed" — e um shutdown que estoura esconde o erro
      // que causou o shutdown. Acontece de verdade: a API chama `stop()` no
      // hook `onClose` enquanto o `closeWithGrace` também encerra o processo.
      if (!stopping) {
        stopping = (async () => {
          // `close()` sem `force`: o BullMQ espera o job em andamento terminar
          // antes de encerrar. É a metade do graceful shutdown que mora aqui; a
          // outra metade é o teto de tempo de quem chama.
          await worker?.close()
          await queue?.close()
          await deadLetterQueue?.close()
          await queueConnection?.quit()
          await workerConnection?.quit()
        })()
      }
      return stopping
    },
  }
}
