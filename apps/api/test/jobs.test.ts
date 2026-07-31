import { createJobRunner } from '@repo/jobs'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

/**
 * Sem REDIS_URL, o runner roda os handlers inline (modo dev). É o que garante
 * que o boilerplate funciona sem infra de fila. Testes puros — sem Redis/DB.
 * A fila de verdade é coberta em `queue.int.test.ts`.
 */
describe('createJobRunner (modo inline, sem Redis)', () => {
  it('marca enabled=false e roda o handler inline no enqueue', async () => {
    const email = vi.fn(async (_data: { to: string }) => {})
    const runner = createJobRunner({
      handlers: { email },
      schemas: { email: z.object({ to: z.string() }) },
    })

    expect(runner.enabled).toBe(false)
    await runner.enqueue('email', { to: 'a@b.com' })
    expect(email).toHaveBeenCalledWith({ to: 'a@b.com' })
  })

  it('valida o payload mesmo inline (dev não pode ser mais frouxo que produção)', async () => {
    const email = vi.fn(async (_data: { to: string }) => {})
    const runner = createJobRunner({
      handlers: { email },
      schemas: { email: z.object({ to: z.email() }) },
    })

    // O TypeScript não pega este caso — `'nao-e-email'` é uma `string` válida.
    // É exatamente por isso que a validação em runtime existe: o tipo garante a
    // forma, o schema garante o conteúdo.
    await expect(
      runner.enqueue('email', { to: 'nao-e-email' }),
    ).rejects.toThrow(/Payload inválido para o job "email"/)
    expect(email).not.toHaveBeenCalled()
  })

  it('propaga o erro do handler (sem fila, sem retry)', async () => {
    const boom = vi.fn(async () => {
      throw new Error('falhou')
    })
    const runner = createJobRunner({
      handlers: { boom },
      schemas: { boom: z.undefined() },
    })
    await expect(runner.enqueue('boom', undefined)).rejects.toThrow('falhou')
  })

  it('start() é no-op e stop() não quebra sem Redis', async () => {
    const runner = createJobRunner({
      handlers: { noop: async (): Promise<void> => {} },
      schemas: { noop: z.undefined() },
      schedules: [{ job: 'noop', pattern: '0 3 * * *' }],
    })
    await expect(runner.start()).resolves.toBeUndefined()
    await expect(runner.stop()).resolves.toBeUndefined()
    // Sem Redis não há o que inspecionar nem DLQ para ler.
    expect(runner.inspectableQueues()).toEqual([])
    expect(await runner.listDeadLetters()).toEqual([])
    expect(await runner.replayDeadLetters()).toBe(0)
  })
})
