import { apiKeysRoute } from '@/modules/api-keys/route.js'
import { auditRoute } from '@/modules/audit/route.js'
import { betterAuthRoute } from '@/modules/better-auth/route.js'
import { entitlementsRoute } from '@/modules/entitlements/route.js'
import { meRoute } from '@/modules/me/route.js'
import { notificationsRoute } from '@/modules/notifications/route.js'
import { paymentRoute } from '@/modules/payment/route.js'
import { subscriptionRoute } from '@/modules/subscription/route.js'
import { tp } from '@/utils/fastify.js'

export const routesPlugin = tp(async app => {
  await app.register(betterAuthRoute)
  await app.register(meRoute)
  await app.register(paymentRoute)
  await app.register(subscriptionRoute)
  await app.register(entitlementsRoute)
  await app.register(auditRoute)
  await app.register(apiKeysRoute)
  await app.register(notificationsRoute)
})
