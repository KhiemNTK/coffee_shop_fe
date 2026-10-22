import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type Theme } from './theme-context'
import { cn } from '../ui/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const { t: translate } = useTranslation()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown on click outside or Escape
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const options: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
    { value: 'light', label: translate('theme.light', 'Sáng'), icon: Sun },
    { value: 'dark', label: translate('theme.dark', 'Tối'), icon: Moon },
    { value: 'system', label: translate('theme.system', 'Hệ thống'), icon: Monitor },
  ]

  const CurrentIcon = resolvedTheme === 'dark' ? Moon : Sun

  return (
    <div ref={containerRef} className={cn('relative inline-block text-left', className)}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={translate('theme.toggle', 'Chuyển đổi giao diện')}
        title={translate('theme.toggle', 'Chuyển đổi giao diện')}
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-primary shadow-2xs',
          isOpen && 'bg-muted text-foreground ring-2 ring-primary/30',
        )}
      >
        <CurrentIcon className="h-4 w-4 transition-transform duration-200" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-2 w-36 rounded-xl border border-border bg-card p-1 shadow-lg ring-1 ring-black/5 z-50 animate-in fade-in-50 zoom-in-95 duration-100"
        >
          {options.map(({ value, label, icon: Icon }) => {
            const isSelected = theme === value
            return (
              <button
                type="button"
                key={value}
                role="menuitem"
                onClick={() => {
                  setTheme(value)
                  setIsOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors cursor-pointer text-left',
                  isSelected
                    ? 'bg-primary text-primary-foreground font-bold'
                    : 'text-foreground hover:bg-muted',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="flex-1">{label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
