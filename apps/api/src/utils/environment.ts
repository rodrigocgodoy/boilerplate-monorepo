/**
 * Ambiente da API.
 *
 * O schema em si vive em `@repo/env/server`, compartilhado com o worker — e o
 * pacote também expõe `@repo/env/client` para o app. Um único lugar descreve
 * cada variável, em vez de um schema por aplicação divergindo com o tempo.
 *
 * Este arquivo continua existindo como ponto de importação (`@/utils/environment.js`)
 * porque dezenas de módulos já apontam para cá.
 */
export { env, type ServerEnv } from '@repo/env/server'
