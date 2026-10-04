import { AlertTriangle, Clock, Flame, Utensils } from 'lucide-react'
import { Card, CardContent } from '../../../shared/ui/card'
import { cn } from '../../../shared/ui/utils'
import type { KitchenWorkload } from '../kitchen.api'

interface KitchenWorkloadKpisProps {
  workload?: KitchenWorkload
}

export function KitchenWorkloadKpis({ workload }: KitchenWorkloadKpisProps) {
  const totalOpenTickets =
    workload?.stations.reduce((acc, s) => acc + s.openTicketCount, 0) ?? 0
  const totalOpenUnits =
    workload?.stations.reduce((acc, s) => acc + s.openUnitCount, 0) ?? 0
  const totalOverdue =
    workload?.stations.reduce((acc, s) => acc + s.overdueTicketCount, 0) ?? 0
  const totalDueSoon =
    workload?.stations.reduce((acc, s) => acc + s.dueSoonTicketCount, 0) ?? 0

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Utensils className="h-3.5 w-3.5" /> Món cần làm
          </span>
          <p className="mt-1 text-2xl font-bold text-primary">
            {totalOpenUnits}
          </p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-slate-400">
        <CardContent className="p-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Vé đang chờ
          </span>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {totalOpenTickets}
          </p>
        </CardContent>
      </Card>

      <Card
        className={cn(
          'border-l-4',
          totalOverdue > 0 ? 'border-l-red-500 bg-red-50/20' : 'border-l-slate-300',
        )}
      >
        <CardContent className="p-4">
          <span
            className={cn(
              'flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider',
              totalOverdue > 0 ? 'text-red-700' : 'text-muted-foreground',
            )}
          >
            <AlertTriangle className="h-3.5 w-3.5" /> Quá giờ SLA
          </span>
          <p
            className={cn(
              'mt-1 text-2xl font-bold',
              totalOverdue > 0 ? 'text-red-600' : 'text-foreground',
            )}
          >
            {totalOverdue}
          </p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-amber-500">
        <CardContent className="p-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Flame className="h-3.5 w-3.5" /> Sắp tới hạn
          </span>
          <p className="mt-1 text-2xl font-bold text-amber-600">
            {totalDueSoon}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
