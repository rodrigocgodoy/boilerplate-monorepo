import { locales } from '@repo/i18n'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/select'
import { useTranslation } from 'react-i18next'

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const current = (locales as readonly string[]).includes(
    i18n.resolvedLanguage ?? '',
  )
    ? i18n.resolvedLanguage
    : 'pt-BR'

  return (
    <Select value={current} onValueChange={lng => i18n.changeLanguage(lng)}>
      <SelectTrigger
        size="sm"
        className="w-auto gap-2"
        aria-label={t('language')}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {locales.map(locale => (
          <SelectItem key={locale} value={locale}>
            {t(`languages.${locale}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
