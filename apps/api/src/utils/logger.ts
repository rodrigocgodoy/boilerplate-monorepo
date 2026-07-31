import type { FastifyBaseLogger } from 'fastify'
import { pino } from 'pino'
import { env } from '@/utils/environment.js'

/**
 * Configuração de log compartilhada pela API e pelo worker.
 *
 * O Pino já é o logger nativo do Fastify — configurá-lo é melhor do que somar
 * outra biblioteca, e é o que garante que os dois processos emitam o **mesmo
 * formato**: um agregador que precisa de dois parsers acaba com metade dos
 * campos não indexados.
 */

/**
 * Campos que nunca podem aparecer no log.
 *
 * Log costuma ir para um agregador de terceiros, ficar meses retido e ser lido
 * por gente que não precisaria daquele dado. Um `authorization` vazado ali é
 * uma credencial válida em texto puro, e o `cookie` de sessão permite
 * personificar o usuário — pior que senha, porque não expira ao ser trocada.
 *
 * A lista cobre os três caminhos por onde isso escapa:
 *  - headers da request/response (o Fastify loga `req`/`res` por padrão);
 *  - objetos que a gente passa à mão (`log.error({ user })`);
 *  - qualquer profundidade, via wildcard — payload de job e corpo de webhook
 *    são aninhados, e listar caminho a caminho envelhece mal.
 */
export const REDACTED_PATHS = [
  // Headers — os nomes exatos que o Fastify serializa.
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.headers["proxy-authorization"]',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
  // Campos sensíveis em qualquer objeto logado, em qualquer profundidade.
  '*.password',
  '*.currentPassword',
  '*.newPassword',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.idToken',
  '*.sessionToken',
  '*.secret',
  '*.apiKey',
  '*.keyHash',
  '*.otp',
  '*.authorization',
  '*.cookie',
  // Um nível a mais: payloads de job e corpos de webhook aninham.
  '*.*.password',
  '*.*.token',
  '*.*.secret',
  '*.*.otp',
]

/** Opções de log usadas pelo Fastify (API) e pelo Pino do worker. */
export const loggerOptions = {
  level: env.API_LOG_LEVEL,
  redact: {
    paths: REDACTED_PATHS,
    censor: '[REDACTED]',
  },
  // JSON estruturado em produção. `pino-pretty` só em desenvolvimento: ele
  // custa CPU e destrói o parsing de quem consome o log.
  ...(env.ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {}),
}

/**
 * Logger do worker. O Fastify constrói o seu a partir de `loggerOptions`; aqui
 * criamos um Pino direto, com a mesma configuração — inclusive a redaction.
 *
 * Antes o worker usava `console.info`/`console.error`: texto solto, sem nível,
 * sem timestamp e sem redaction nenhuma. Um handler que logasse o payload de um
 * job de e-mail despejava o token de verificação no stdout.
 */
export function createWorkerLogger(): FastifyBaseLogger {
  return pino({
    ...loggerOptions,
    base: { service: 'worker' },
  }) as unknown as FastifyBaseLogger
}
