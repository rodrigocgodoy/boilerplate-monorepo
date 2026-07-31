import { createJobRunner, type JobRunner } from '@repo/jobs'
import { afterEach, expect, it, vi } from 'vitest'
import { z } from 'zod'
import {
  describeQueue,
  testRedisUrl,
  uniqueQueueName,
  waitFor,
} from './helpers/queue.js'

/**
 * Fila **de verdade**: BullMQ contra um Redis real. Cobre o que o modo inline
 * não consegue provar — que o job atravessa o Redis, que o retry acontece com
 * backoff, que o payload é revalidado do outro lado e que a falha definitiva
 * termina na DLQ.
 *
 * Rode com `pnpm test:db` (sobe Postgres + Redis efêmeros e derruba no fim).
 */

// Cada teste cria o seu runner; todos são fechados no final para não deixar
// conexão nem worker pendurados entre arquivos.
const runners: JobRunner<never>[] = []

function track<H extends Record<string, (data: never) => unknown>>(
  runner: JobRunner<H>,
): JobRunner<H> {
  runners.push(runner as unknown as JobRunner<never>)
  return runner
}

afterEach(async () => {
  await Promise.all(runners.splice(0).map(r => r.stop()))
})

describeQueue('fila real (BullMQ + Redis)', () => {
  it('enfileira e processa o job no worker', async () => {
    const processed: { to: string }[] = []
    const runner = track(
      createJobRunner({
        redisUrl: testRedisUrl,
        queueName: uniqueQueueName('basic'),
        handlers: {
          email: async (data: { to: string }) => {
            processed.push(data)
          },
        },
        schemas: { email: z.object({ to: z.email() }) },
      }),
    )

    expect(runner.enabled).toBe(true)
    await runner.start()
    await runner.enqueue('email', { to: 'ana@test.dev' })

    await waitFor(() => processed.length === 1, { label: 'o job processar' })
    expect(processed[0]).toEqual({ to: 'ana@test.dev' })
  })

  it('recusa payload inválido no enqueue, antes de publicar', async () => {
    const handler = vi.fn(async (_data: { to: string }) => {})
    const runner = track(
      createJobRunner({
        redisUrl: testRedisUrl,
        queueName: uniqueQueueName('invalid'),
        handlers: { email: handler },
        schemas: { email: z.object({ to: z.email() }) },
      }),
    )
    await runner.start()

    // O TypeScript não reprova isto — `'nao-e-email'` é uma `string` bem
    // tipada. O tipo garante a forma do payload; o schema garante o conteúdo.
    await expect(
      runner.enqueue('email', { to: 'nao-e-email' }),
    ).rejects.toThrow(/Payload inválido para o job "email"/)

    // Nada chegou na fila: a validação é no produtor.
    expect(handler).not.toHaveBeenCalled()
  })

  it('tenta de novo quando o handler falha e completa na tentativa seguinte', async () => {
    let attempts = 0
    const runner = track(
      createJobRunner({
        redisUrl: testRedisUrl,
        queueName: uniqueQueueName('retry'),
        handlers: {
          flaky: async (_data: { id: string }) => {
            attempts++
            if (attempts < 2) throw new Error('falha transitória')
          },
        },
        schemas: { flaky: z.object({ id: z.string() }) },
        // Backoff curto: o teste comprova que houve retry, não o valor do
        // atraso — 5s de produção só deixariam a suíte lenta.
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 50 },
        },
      }),
    )
    await runner.start()
    await runner.enqueue('flaky', { id: 'a' })

    await waitFor(() => attempts >= 2, { label: 'a segunda tentativa' })
    expect(attempts).toBe(2)

    // Sucesso na 2ª tentativa não deixa nada na DLQ.
    expect(await runner.listDeadLetters()).toHaveLength(0)
  })

  it('manda para a DLQ quando esgota as tentativas', async () => {
    const runner = track(
      createJobRunner({
        redisUrl: testRedisUrl,
        queueName: uniqueQueueName('dlq'),
        handlers: {
          doomed: async (_data: { id: string }) => {
            throw new Error('sempre falha')
          },
        },
        schemas: { doomed: z.object({ id: z.string() }) },
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: 'exponential', delay: 25 },
        },
      }),
    )
    await runner.start()
    await runner.enqueue('doomed', { id: 'x' })

    await waitFor(async () => (await runner.listDeadLetters()).length === 1, {
      label: 'o job cair na DLQ',
    })

    const [dead] = await runner.listDeadLetters()
    expect(dead).toMatchObject({
      job: 'doomed',
      data: { id: 'x' },
      error: 'sempre falha',
      attemptsMade: 2,
    })
    // O payload original é preservado — é o que torna o replay possível.
    expect(new Date(dead?.failedAt ?? '').getTime()).toBeGreaterThan(0)
  })

  it('replay devolve o job da DLQ para a fila principal', async () => {
    let shouldFail = true
    const processed: string[] = []
    const runner = track(
      createJobRunner({
        redisUrl: testRedisUrl,
        queueName: uniqueQueueName('replay'),
        handlers: {
          recoverable: async (data: { id: string }) => {
            if (shouldFail) throw new Error('indisponível')
            processed.push(data.id)
          },
        },
        schemas: { recoverable: z.object({ id: z.string() }) },
        defaultJobOptions: {
          attempts: 1,
          backoff: { type: 'exponential', delay: 25 },
        },
      }),
    )
    await runner.start()
    await runner.enqueue('recoverable', { id: 'pedido-1' })

    await waitFor(async () => (await runner.listDeadLetters()).length === 1, {
      label: 'o job cair na DLQ',
    })

    // Cenário real: a causa foi corrigida, agora reprocessa.
    shouldFail = false
    expect(await runner.replayDeadLetters()).toBe(1)

    await waitFor(() => processed.length === 1, { label: 'o replay processar' })
    expect(processed).toEqual(['pedido-1'])
    expect(await runner.listDeadLetters()).toHaveLength(0)
  })

  it('payload obsoleto no worker vai direto para a DLQ, sem queimar retries', async () => {
    const handler = vi.fn(async (_data: { to: string }) => {})
    const queueName = uniqueQueueName('stale')

    // Produtor com schema frouxo: simula uma versão anterior do código, que
    // enfileirou algo que o schema atual não aceita mais.
    const producer = track(
      createJobRunner({
        redisUrl: testRedisUrl,
        queueName,
        handlers: { email: (_data: { to: string }) => {} },
        schemas: { email: z.object({ to: z.string() }) },
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 25 },
        },
      }),
    )
    await producer.enqueue('email', { to: 'formato-antigo' })

    // Consumidor com o schema novo (exige e-mail válido).
    const consumer = track(
      createJobRunner({
        redisUrl: testRedisUrl,
        queueName,
        handlers: { email: handler },
        schemas: { email: z.object({ to: z.email() }) },
      }),
    )
    await consumer.start()

    await waitFor(async () => (await consumer.listDeadLetters()).length === 1, {
      label: 'o payload obsoleto cair na DLQ',
    })

    const [dead] = await consumer.listDeadLetters()
    expect(dead?.error).toMatch(/Payload inválido/)
    // `UnrecoverableError`: parou na 1ª tentativa das 5 configuradas. Retry não
    // conserta payload malformado, só gasta backoff.
    expect(dead?.attemptsMade).toBe(1)
    expect(handler).not.toHaveBeenCalled()
  })

  it('stop() espera o job em andamento terminar', async () => {
    let finished = false
    const runner = track(
      createJobRunner({
        redisUrl: testRedisUrl,
        queueName: uniqueQueueName('shutdown'),
        handlers: {
          slow: async (_data: { id: string }) => {
            await new Promise(resolve => setTimeout(resolve, 300))
            finished = true
          },
        },
        schemas: { slow: z.object({ id: z.string() }) },
      }),
    )
    await runner.start()
    await runner.enqueue('slow', { id: 'a' })

    // Espera o job realmente começar — parar antes disso não provaria nada.
    await new Promise(resolve => setTimeout(resolve, 150))
    await runner.stop()

    // É a garantia que o deploy depende: o BullMQ não abandona o job ativo.
    expect(finished).toBe(true)

    // `stop()` é idempotente: o `afterEach` chama de novo, e na API o hook
    // `onClose` e o `closeWithGrace` podem disparar juntos.
    await expect(runner.stop()).resolves.toBeUndefined()
  })
})
