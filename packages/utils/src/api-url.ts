import { env } from '@repo/env/client'

/**
 * Base da API para o frontend.
 *
 * A validação (existe? é uma URL completa?) acontece no boot, dentro de
 * `@repo/env/client`. Antes ela morava aqui e só disparava quando alguém
 * chamava a função — ou seja, a tela quebrava no meio do fluxo em vez de o app
 * recusar subir com configuração inválida.
 */
export const getApiBaseUrl = (): string => env.VITE_API_URL
