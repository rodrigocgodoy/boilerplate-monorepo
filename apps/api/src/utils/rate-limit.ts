import { Redis } from 'ioredis'
import { env } from '@/utils/environment.js'

/**
 * Perfis de rate limit por rota.
 *
 * O teto global (`RATE_LIMIT_MAX`, 100/min por IP) serve para a maioria. Estes
 * perfis existem para os dois extremos, onde o número único erra feio:
 *
 * - **`webhook`** — precisa ser folgado. O emissor não é um usuário, é o
 *   gateway de pagamento: um pico de reentregas legítimas levando 429 faz
 *   eventos de cobrança serem descartados. A autenticidade aqui é garantida
 *   pelo HMAC, não pelo rate limit.
 * - **`expensive`** — precisa ser apertado. `GET /me/export` varre meia dúzia
 *   de tabelas por chamada; 100/min por IP é um DoS barato contra o banco.
 *
 * Rotas de autenticação **não** aparecem aqui: o Better Auth já aplica limites
 * próprios e mais restritos (3 tentativas de login por 10s, 3 pedidos de reset
 * por 60s) — e eles só ligam com `NODE_ENV=production`, o que o boot verifica.
 */
export const rateLimitProfiles = {
  webhook: { max: 600, timeWindow: '1 minute' },
  expensive: { max: 5, timeWindow: '1 minute' },
} as const

/**
 * Conexão dedicada para o storage do rate limit, quando há Redis.
 *
 * Sem ela, o contador é por processo: com N réplicas o limite efetivo vira N×,
 * e cada deploy zera tudo. Em dev (sem `REDIS_URL`) o modo em memória continua
 * valendo — é o suficiente e não exige infra.
 *
 * `connectTimeout` curto e `enableOfflineQueue: false` de propósito: se o Redis
 * cair, o `@fastify/rate-limit` degrada para "deixa passar" em vez de pendurar
 * a requisição numa fila offline. Perder o limite por alguns segundos é melhor
 * que derrubar a API inteira junto com o Redis.
 */
export const rateLimitRedis = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      connectTimeout: 500,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      keyPrefix: 'rl:',
    })
  : undefined
