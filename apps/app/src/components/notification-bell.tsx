import { useGetNotifications } from '@repo/api-client/hooks'
import { Button } from '@repo/ui/components/button'
import { Link } from '@tanstack/react-router'
import { Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * Sino de notificações no header: mostra o nº de não lidas e leva à página
 * `/notifications`. (#13)
 */
export function NotificationBell() {
  const { t } = useTranslation('notifications')
  const { data } = useGetNotifications()
  const count = data?.data.unreadCount ?? 0

  return (
    <Button
      asChild
      variant="outline"
      size="icon"
      className="relative"
      aria-label={t('title')}
    >
      <Link to="/notifications">
        <Bell className="size-4" />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 font-medium text-[10px] text-primary-foreground">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </Link>
    </Button>
  )
}
