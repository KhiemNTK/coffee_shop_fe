import { AlertTriangle, Clock, Flame, Utensils } from 'lucide-react'
import { Card, CardContent } from '../../../shared/ui/card'
import { cn } from '../../../shared/ui/utils'
import type { KitchenWorkload } from '../kitchen.api'

interface KitchenWorkloadKpisProps {
  workload: KitchenWorkload
}

export function KitchenWorkloadKpis({ workload }: KitchenWorkloadKpisProps) {
  const totalOpenTickets = workload.stations.reduce((acc, s) => acc + s.openTicketCount, 0)
  const totalOpenUnits = workload.stations.reduce((acc, s) => acc + s.openUnitCount, 0)
  const totalOverdue = workload.stations.reduce((acc, s) => acc + s.overdueTicketCount, 0)
  const totalDueSoon = workload.stations.reduce((acc, s) => acc + s.dueSoonTicketCount, 0)

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      <Card className="border-l-4 border-l-primary shadow-xs">
        <CardContent className="p-3.5 sm:p-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate" title="Món cần làm">
            <Utensils className="h-3.5 w-3.5 shrink-0 text-primary" /> Món cần làm
          </span>
          <p className="mt-1 text-2xl font-bold text-primary tabular-nums">{totalOpenUnits}</p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-slate-400 shadow-xs">
        <CardContent className="p-3.5 sm:p-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate" title="Vé đang chờ">
            <Clock className="h-3.5 w-3.5 shrink-0" /> Vé đang chờ
          </span>
          <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{totalOpenTickets}</p>
        </CardContent>
      </Card>

      <Card
        className={cn(
          'border-l-4 shadow-xs',
          totalOverdue > 0 ? 'border-l-rose-500 bg-rose-50/20' : 'border-l-slate-300',
        )}
      >
        <CardContent className="p-3.5 sm:p-4">
          <span
            className={cn(
              'flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider truncate',
              totalOverdue > 0 ? 'text-rose-700 font-bold' : 'text-muted-foreground',
            )}
            title="Quá giờ SLA"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Quá giờ SLA
          </span>
          <p
            className={cn(
              'mt-1 text-2xl font-bold tabular-nums',
              totalOverdue > 0 ? 'text-rose-600' : 'text-foreground',
            )}
          >
            {totalOverdue}
          </p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-amber-500 shadow-xs">
        <CardContent className="p-3.5 sm:p-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate" title="Sắp tới hạn">
            <Flame className="h-3.5 w-3.5 shrink-0 text-amber-500" /> Sắp tới hạn
          </span>
          <p className="mt-1 text-2xl font-bold text-amber-600 tabular-nums">{totalDueSoon}</p>
        </CardContent>
      </Card>
    </div>
  )
}
