import { Sparkles, Plus } from 'lucide-react'
import { formatPrice, type MenuItem } from '../../menu/menu.api'

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
  if (!recommendations || recommendations.length === 0) return null

  return (
    <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        <span>Gợi ý món gọi kèm thông minh</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {recommendations.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelectItem(item)}
            className="flex items-center justify-between rounded-lg border border-primary/20 bg-card p-2 text-left text-xs transition-colors hover:border-primary hover:bg-primary/5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="truncate mr-1">
              <span className="font-semibold text-foreground truncate block">
                {item.name}
              </span>
              <span className="font-bold text-primary text-[11px]">
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
