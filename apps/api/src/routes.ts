import { betterAuthRoute } from '@/modules/better-auth/route.js'
import { meRoute } from '@/modules/me/route.js'
import { paymentRoute } from '@/modules/payment/route.js'
import { subscriptionRoute } from '@/modules/subscription/route.js'
import { tp } from '@/utils/fastify.js'

export const routesPlugin = tp(async app => {
  await app.register(betterAuthRoute)
  await app.register(meRoute)
  await app.register(paymentRoute)
  await app.register(subscriptionRoute)
})
