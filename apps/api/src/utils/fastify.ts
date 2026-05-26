import type {
  FastifyBaseLogger,
  FastifyInstance,
  FastifyPluginAsync,
  FastifyPluginOptions,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from 'fastify'
import fp, { type PluginMetadata } from 'fastify-plugin'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

/**
 * Plugin para Fastify com os tipos corretos do TypeProvider
 */
export function tp<Options extends FastifyPluginOptions = Record<never, never>>(
  plugin: FastifyPluginAsync<
    Options,
    RawServerDefault,
    ZodTypeProvider,
    FastifyBaseLogger
  >,
  options?: PluginMetadata,
) {
  return fp<Options>(plugin, options)
}

/**
 * Tipo do objeto FastifyInstance com os tipos corretos do TypeProvider
 */
export type FastifyTypeInstance = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression<RawServerDefault>,
  RawReplyDefaultExpression<RawServerDefault>,
  FastifyBaseLogger,
  ZodTypeProvider
>

/**
 * Tipo do objeto FastifyRequest com os tipos corretos do TypeProvider
 */
export type FastifyTypeRequest = Parameters<
  Parameters<FastifyTypeInstance['get']>[1]['handler']
>[0]

/**
 * Tipo do objeto FastifyReply com os tipos corretos do TypeProvider
 */
export type FastifyTypeReply = Parameters<
  Parameters<FastifyTypeInstance['get']>[1]['handler']
>[1]
