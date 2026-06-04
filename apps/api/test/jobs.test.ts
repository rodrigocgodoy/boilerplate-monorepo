import { createJobRunner } from '@repo/jobs'
import { describe, expect, it, vi } from 'vitest'

/**
 * Sem REDIS_URL, o runner roda os handlers inline (modo dev). É o que garante
 * que o boilerplate funciona sem infra de fila. Testes puros — sem Redis/DB.
 */
describe('createJobRunner (modo inline, sem Redis)', () => {
  it('marca enabled=false e roda o handler inline no enqueue', async () => {
    const email = vi.fn(async (_data: { to: string }) => {})
    const runner = createJobRunner({ handlers: { email } })

    expect(runner.enabled).toBe(false)
    await runner.enqueue('email', { to: 'a@b.com' })
    expect(email).toHaveBeenCalledWith({ to: 'a@b.com' })
  })

  it('propaga o erro do handler (sem fila, sem retry)', async () => {
    const boom = vi.fn(async () => {
      throw new Error('falhou')
    })
    const runner = createJobRunner({ handlers: { boom } })
    await expect(runner.enqueue('boom', undefined)).rejects.toThrow('falhou')
  })

  it('start() é no-op e stop() não quebra sem Redis', async () => {
    const runner = createJobRunner({
      handlers: { noop: async () => {} },
      schedules: [{ job: 'noop', pattern: '0 3 * * *' }],
    })
    await expect(runner.start()).resolves.toBeUndefined()
    await expect(runner.stop()).resolves.toBeUndefined()
  })
})
