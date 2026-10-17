import { Filter } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../../shared/ui/utils'
import type { KitchenStation } from '../kitchen.api'

interface KitchenStationsBarProps {
  stations: Pick<KitchenStation, 'id' | 'name' | 'code'>[]
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
  const { t: translate } = useTranslation()
  return (
    <section
      aria-label={translate('ops.kitchen.station')}
      className="border-y border-border bg-card px-4 py-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground mr-1">
            <Filter className="h-3.5 w-3.5" aria-hidden="true" /> {translate('ops.kitchen.station')}
            :
          </span>
          <button
            type="button"
            onClick={() => onSelectStation('')}
            aria-pressed={selectedStationId === ''}
            className={cn(
              'min-h-11 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              selectedStationId === ''
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'border border-border bg-card text-foreground hover:bg-muted',
            )}
          >
            {translate('ops.kitchen.allStations')}
          </button>
          {stations.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectStation(s.id)}
              aria-pressed={selectedStationId === s.id}
              className={cn(
                'min-h-11 max-w-full break-words rounded-md px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                selectedStationId === s.id
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'border border-border bg-card text-foreground hover:bg-muted',
              )}
            >
              {s.name} ({s.code})
            </button>
          ))}
        </div>

        <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs font-medium text-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeCompleted}
            onChange={(e) => onToggleIncludeCompleted(e.target.checked)}
            className="rounded border-border text-primary focus:ring-primary"
          />
          {translate('ops.kitchen.showFinished')}
        </label>
      </div>
    </section>
  )
}
