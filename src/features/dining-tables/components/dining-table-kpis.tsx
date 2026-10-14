import { Link } from 'react-router-dom'
import { Armchair, Calendar, Coffee, UtensilsCrossed } from 'lucide-react'
import { Card, CardContent } from '../../../shared/ui'

interface DiningTableKpisProps {
  stats: {
    total: number
    empty: number
    occupied: number
    reserved: number
    emptyPercent: number
  }
}

export function DiningTableKpis({ stats }: DiningTableKpisProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {/* Total Tables */}
      <Card className="border border-border/70 bg-card shadow-xs transition-shadow hover:shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Tổng số bàn
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground/80">
              <Armchair className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums">
              {stats.total}
            </span>
            <span className="text-xs font-medium text-muted-foreground">bàn trong quán</span>
          </div>
        </CardContent>
      </Card>

      {/* Empty Tables */}
      <Card className="border border-emerald-500/20 bg-card shadow-xs transition-shadow hover:shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Bàn trống
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <Coffee className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400 tabular-nums">
              {stats.empty}
            </span>
            <span className="text-xs font-medium text-emerald-700/80 dark:text-emerald-400/80">
              ({stats.emptyPercent}% sẵn sàng)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Occupied Tables */}
      <Card className="border border-amber-500/20 bg-card shadow-xs transition-shadow hover:shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Đang phục vụ
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
              <UtensilsCrossed className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-700 dark:text-amber-400 tabular-nums">
              {stats.occupied}
            </span>
            <span className="text-xs font-medium text-amber-800/80 dark:text-amber-400/80">
              đang có khách
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Reserved Tables */}
      <Card className="border border-purple-500/20 bg-card shadow-xs transition-shadow hover:shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-purple-800 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-purple-500" />
              Đã đặt trước
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-400">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-purple-700 dark:text-purple-400 tabular-nums">
              {stats.reserved}
            </span>
            <Link
              to="/staff/reservations"
              className="text-xs font-semibold text-purple-700 hover:underline dark:text-purple-300"
            >
              Xem lịch đặt →
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
