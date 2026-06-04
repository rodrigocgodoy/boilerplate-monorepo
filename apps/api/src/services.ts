import type { FastifyInstance } from 'fastify'
import { BetterAuthService } from '@/modules/better-auth/service.js'
import { EntitlementsService } from '@/modules/entitlements/service.js'
import { PaymentService } from '@/modules/payment/service.js'
import { SubscriptionService } from '@/modules/subscription/service.js'
import { tp } from '@/utils/fastify.js'

declare module 'fastify' {
  interface FastifyInstance {
    services: {
      auth: BetterAuthService
      payment: PaymentService
      subscription: SubscriptionService
      entitlements: EntitlementsService
    }
  }
}

export const servicePlugin = tp(async scope => {
  scope.decorate('services', createServices())
})

export function createServices(): FastifyInstance['services'] {
  const subscription = new SubscriptionService()
  return {
    auth: new BetterAuthService(),
    payment: new PaymentService(),
    subscription,
    // Reusa a mesma instância de SubscriptionService (resolve o plano ativo).
    entitlements: new EntitlementsService(subscription),
  }
}
