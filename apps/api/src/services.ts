import type { FastifyInstance } from 'fastify'
import { BetterAuthService } from '@/modules/better-auth/service.js'
import { tp } from '@/utils/fastify.js'

declare module 'fastify' {
  interface FastifyInstance {
    services: {
      auth: BetterAuthService
    }
  }
}

export const servicePlugin = tp(async scope => {
  scope.decorate('services', createServices())
})

export function createServices(): FastifyInstance['services'] {
  return {
    auth: new BetterAuthService(),
  }
}
