import { z } from 'zod'
import { getAuthSession } from '@/utils/auth.js'
import { tp } from '@/utils/fastify.js'
import {
  markReadResponseSchema,
  notificationErrorSchema,
  notificationListResponseSchema,
  preferencesResponseSchema,
  updatePreferencesBodySchema,
} from './schemas.js'

/**
 * Notificações in-app + preferências (#13). Tudo escopado ao usuário da sessão.
 * `notify(...)` (no service) é o ponto de entrada para outras features
 * dispararem notificações. Ver UPGRADES.md.
 */
export const notificationsRoute = tp(async scope => {
  const { notifications } = scope.services

  // GET /notifications — lista + total de não lidas.
  scope.get(
    '/notifications',
    {
      schema: {
        tags: ['Notifications'],
        summary: 'Notificações do usuário + contagem de não lidas',
        response: {
          200: notificationListResponseSchema,
          401: notificationErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const session = await getAuthSession(scope, request)
      if (!session) {
        return reply
          .status(401)
          .send({ error: request.t('payment:unauthorized') })
      }
      const [items, unreadCount] = await Promise.all([
        notifications.list(session.userId),
        notifications.unreadCount(session.userId),
      ])
      return reply.status(200).send({
        notifications: items.map(n => ({
          id: n.id,
          category: n.category,
          title: n.title,
          body: n.body,
          data: n.data ?? null,
          read: n.readAt !== null,
          createdAt: n.createdAt.toISOString(),
        })),
        unreadCount,
      })
    },
  )

  // POST /notifications/:id/read — marca uma como lida.
  scope.post(
    '/notifications/:id/read',
    {
      schema: {
        tags: ['Notifications'],
        summary: 'Marca uma notificação como lida',
        params: z.object({ id: z.string() }),
        response: {
          200: markReadResponseSchema,
          401: notificationErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const session = await getAuthSession(scope, request)
      if (!session) {
        return reply
          .status(401)
          .send({ error: request.t('payment:unauthorized') })
      }
      const ok = await notifications.markRead(session.userId, request.params.id)
      const unreadCount = await notifications.unreadCount(session.userId)
      return reply.status(200).send({ ok, unreadCount })
    },
  )

  // POST /notifications/read-all — marca todas como lidas.
  scope.post(
    '/notifications/read-all',
    {
      schema: {
        tags: ['Notifications'],
        summary: 'Marca todas as notificações como lidas',
        response: {
          200: markReadResponseSchema,
          401: notificationErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const session = await getAuthSession(scope, request)
      if (!session) {
        return reply
          .status(401)
          .send({ error: request.t('payment:unauthorized') })
      }
      await notifications.markAllRead(session.userId)
      return reply.status(200).send({ ok: true, unreadCount: 0 })
    },
  )

  // GET /notifications/preferences — preferências por categoria.
  scope.get(
    '/notifications/preferences',
    {
      schema: {
        tags: ['Notifications'],
        summary: 'Preferências de notificação do usuário',
        response: {
          200: preferencesResponseSchema,
          401: notificationErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const session = await getAuthSession(scope, request)
      if (!session) {
        return reply
          .status(401)
          .send({ error: request.t('payment:unauthorized') })
      }
      const preferences = await notifications.getPreferences(session.userId)
      return reply.status(200).send({ preferences })
    },
  )

  // PUT /notifications/preferences — atualiza as preferências.
  scope.put(
    '/notifications/preferences',
    {
      schema: {
        tags: ['Notifications'],
        summary: 'Atualiza as preferências de notificação',
        body: updatePreferencesBodySchema,
        response: {
          200: preferencesResponseSchema,
          401: notificationErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const session = await getAuthSession(scope, request)
      if (!session) {
        return reply
          .status(401)
          .send({ error: request.t('payment:unauthorized') })
      }
      const preferences = await notifications.setPreferences(
        session.userId,
        request.body.preferences,
      )
      return reply.status(200).send({ preferences })
    },
  )

  // POST /notifications/test — cria uma notificação de exemplo (para si).
  scope.post(
    '/notifications/test',
    {
      schema: {
        tags: ['Notifications'],
        summary: 'Dispara uma notificação de teste para o próprio usuário',
        response: {
          200: markReadResponseSchema,
          401: notificationErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const session = await getAuthSession(scope, request)
      if (!session) {
        return reply
          .status(401)
          .send({ error: request.t('payment:unauthorized') })
      }
      await notifications.notify(session.userId, {
        category: 'system',
        title: request.t('notifications:test.title'),
        body: request.t('notifications:test.body'),
        locale: request.lang,
      })
      const unreadCount = await notifications.unreadCount(session.userId)
      return reply.status(200).send({ ok: true, unreadCount })
    },
  )
})
