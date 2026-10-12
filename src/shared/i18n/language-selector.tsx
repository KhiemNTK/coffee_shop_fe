import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Languages } from 'lucide-react'
import { changeLanguage, currentLanguage } from './index'

export function LanguageSelector() {
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const flight = useRef(false)
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border bg-card px-4 py-1.5 text-sm">
      {failed && (
        <span role="alert" className="text-destructive">
          {t('app.languageFailed')}
        </span>
      )}
      <Languages size={16} aria-hidden="true" />
      <select
        aria-label={t('app.language')}
        className="min-h-9 rounded-md border border-border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-primary"
        value={currentLanguage()}
        disabled={pending}
        aria-busy={pending}
        onChange={async (event) => {
          const language = event.target.value
          if (flight.current || (language !== 'vi' && language !== 'en')) return
          flight.current = true
          setPending(true)
          setFailed(false)
          try {
            await changeLanguage(language)
          } catch {
            setFailed(true)
          } finally {
            flight.current = false
            setPending(false)
          }
        }}
      >
        <option value="vi">Tiếng Việt</option>
        <option value="en">English</option>
      </select>
    </div>
  )
}
