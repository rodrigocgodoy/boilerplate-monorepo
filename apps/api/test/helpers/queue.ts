import { describe } from 'vitest'

/**
 * Infra para os testes de **fila real** (BullMQ + Redis). Rodam só quando
 * `TEST_REDIS_URL` está setado — `pnpm test:db` sobe o Redis efêmero e injeta a
 * variável; sem ela, os blocos se pulam e `pnpm test` segue nos unitários.
 */
export const hasTestRedis = Boolean(process.env.TEST_REDIS_URL)

/** `describe` que só roda com Redis de teste configurado. */
export const describeQueue = hasTestRedis ? describe : describe.skip

export const testRedisUrl = process.env.TEST_REDIS_URL ?? ''

/**
 * Espera uma condição virar verdadeira, ou estoura.
 *
 * Fila é assíncrona por definição: depois do `enqueue` não há nada para
 * `await`. Um `sleep` fixo tornaria o teste lento no caso bom e instável no
 * caso ruim; o polling curto termina assim que o worker processou.
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  { timeout = 10_000, interval = 25, label = 'condição' } = {},
): Promise<void> {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await condition()) return
    await new Promise(resolve => setTimeout(resolve, interval))
  }
  throw new Error(`Timeout esperando ${label} (${timeout}ms)`)
}

/** Nome de fila único por teste — isola execuções que dividem o mesmo Redis. */
export function uniqueQueueName(prefix: string): string {
  return `test-${prefix}-${Math.random().toString(36).slice(2, 10)}`
}
