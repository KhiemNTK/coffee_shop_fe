import { formatPrice } from '@/shared/lib/format'
import { useTranslation } from 'react-i18next'
import { Sparkles, Plus } from 'lucide-react'
import { type MenuItem } from '../../menu/menu.api'

interface PosRecommendationsStripProps {
  recommendations?: MenuItem[]
  onSelectItem: (item: MenuItem) => void
  disabled?: boolean
}

export function PosRecommendationsStrip({
  recommendations,
  onSelectItem,
  disabled = false,
}: PosRecommendationsStripProps) {
  const { t: translate } = useTranslation()
  if (!recommendations || recommendations.length === 0) return null

  return (
    <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        <span>{translate('pos.suggestions')}</span>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-2 sm:grid-cols-3">
        {recommendations.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelectItem(item)}
            className="flex min-h-16 items-center justify-between gap-2 rounded-lg border border-primary/20 bg-card p-2 text-left text-xs transition-colors hover:border-primary hover:bg-primary/5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 min-w-0"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <span className="block break-words font-semibold text-foreground" title={item.name}>
                {item.name}
              </span>
              <span className="font-bold text-primary text-[11px] tabular-nums">
                {formatPrice(item.price)}
              </span>
            </div>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Plus className="h-3 w-3" />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
