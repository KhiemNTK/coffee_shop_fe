import { Filter } from 'lucide-react'
import { Card } from '../../../shared/ui/card'
import { cn } from '../../../shared/ui/utils'
import type { KitchenStation } from '../kitchen.api'

interface KitchenStationsBarProps {
  stations: KitchenStation[]
  selectedStationId: string
  onSelectStation: (id: string) => void
  includeCompleted: boolean
  onToggleIncludeCompleted: (val: boolean) => void
}

export function KitchenStationsBar({
  stations,
  selectedStationId,
  onSelectStation,
  includeCompleted,
  onToggleIncludeCompleted,
}: KitchenStationsBarProps) {
  return (
    <Card className="p-3.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground mr-1">
            <Filter className="h-3.5 w-3.5" /> Quầy:
          </span>
          <button
            type="button"
            onClick={() => onSelectStation('')}
            className={cn(
              'rounded-full px-3.5 py-1 text-xs font-semibold transition-colors cursor-pointer',
              selectedStationId === ''
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'border border-border bg-card text-foreground hover:bg-muted',
            )}
          >
            Tất cả quầy
          </button>
          {stations.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectStation(s.id)}
              className={cn(
                'rounded-full px-3.5 py-1 text-xs font-semibold transition-colors cursor-pointer',
                selectedStationId === s.id
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'border border-border bg-card text-foreground hover:bg-muted',
              )}
            >
              {s.name} ({s.code})
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeCompleted}
            onChange={(e) => onToggleIncludeCompleted(e.target.checked)}
            className="rounded border-border text-primary focus:ring-primary"
          />
          Xem cả món đã xong
        </label>
      </div>
    </Card>
  )
}
