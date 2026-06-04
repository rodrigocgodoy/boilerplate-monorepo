import { type Notifications, prisma } from '@repo/database'
import { enqueue } from '@/jobs/index.js'

/** Categorias suportadas (casam com as preferências por canal). */
export const NOTIFICATION_CATEGORIES = [
  'system',
  'billing',
  'security',
  'member',
] as const
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]

type ChannelPrefs = { email: boolean; inApp: boolean }
export type Preferences = Record<string, ChannelPrefs>

const DEFAULT_CHANNELS: ChannelPrefs = { email: true, inApp: true }

function defaultPreferences(): Preferences {
  return Object.fromEntries(
    NOTIFICATION_CATEGORIES.map(c => [c, { ...DEFAULT_CHANNELS }]),
  )
}

/** Normaliza um Json de prefs para o mapa conhecido (categorias válidas). */
function normalize(input: unknown): Preferences {
  const stored = (input ?? {}) as Record<string, Partial<ChannelPrefs>>
  const out = defaultPreferences()
  for (const c of NOTIFICATION_CATEGORIES) {
    const s = stored[c]
    if (s) out[c] = { email: Boolean(s.email), inApp: Boolean(s.inApp) }
  }
  return out
}

/**
 * Notificações in-app + preferências (#13). `notify` é o ponto de entrada que
 * outras features chamam — respeita as preferências do usuário (in-app e/ou
 * e-mail via fila, #5).
 */
export class NotificationService {
  async getPreferences(userId: string): Promise<Preferences> {
    const row = await prisma.notificationPreferences.findUnique({
      where: { userId },
    })
    return normalize(row?.preferences)
  }

  async setPreferences(
    userId: string,
    prefs: Preferences,
  ): Promise<Preferences> {
    const clean = normalize(prefs)
    await prisma.notificationPreferences.upsert({
      where: { userId },
      create: { userId, preferences: clean },
      update: { preferences: clean },
    })
    return clean
  }

  /** Dispara uma notificação respeitando as preferências do usuário. */
  async notify(
    userId: string,
    input: {
      category?: NotificationCategory
      title: string
      body?: string
      url?: string
    },
  ): Promise<void> {
    const category = input.category ?? 'system'
    const channel =
      (await this.getPreferences(userId))[category] ?? DEFAULT_CHANNELS

    if (channel.inApp) {
      await prisma.notifications.create({
        data: {
          userId,
          category,
          title: input.title,
          body: input.body ?? null,
          data: input.url ? { url: input.url } : undefined,
        },
      })
    }
    if (channel.email) {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { email: true },
      })
      if (user?.email) {
        await enqueue('email', {
          template: 'notification',
          to: user.email,
          title: input.title,
          body: input.body,
          url: input.url,
        })
      }
    }
  }

  list(userId: string, limit = 50): Promise<Notifications[]> {
    return prisma.notifications.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(1, limit), 200),
    })
  }

  unreadCount(userId: string): Promise<number> {
    return prisma.notifications.count({ where: { userId, readAt: null } })
  }

  async markRead(userId: string, id: string): Promise<boolean> {
    const { count } = await prisma.notifications.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    })
    return count > 0
  }

  async markAllRead(userId: string): Promise<number> {
    const { count } = await prisma.notifications.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    })
    return count
  }
}
