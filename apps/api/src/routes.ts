import { betterAuthRoute } from '@/modules/better-auth/route.js'
import { meRoute } from '@/modules/me/route.js'
import { tp } from '@/utils/fastify.js'

export const routesPlugin = tp(async app => {
  await app.register(betterAuthRoute)
  await app.register(meRoute)
})
