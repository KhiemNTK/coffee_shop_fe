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
      <Card className="border border-border shadow-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">
              Tổng số bàn
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-xs">
              <Armchair className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground tabular-nums">{stats.total}</span>
            <span className="text-xs font-medium text-muted-foreground">bàn trong quán</span>
          </div>
        </CardContent>
      </Card>

      {/* Empty Tables */}
      <Card className="border border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20 shadow-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">
              Bàn trống
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-300 shadow-xs">
              <Coffee className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {stats.empty}
            </span>
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              ({stats.emptyPercent}% sẵn sàng)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Occupied Tables */}
      <Card className="border border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 shadow-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
              Đang phục vụ
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/60 dark:text-amber-300 shadow-xs">
              <UtensilsCrossed className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">
              {stats.occupied}
            </span>
            <span className="text-xs font-medium text-amber-800 dark:text-amber-300">đang có khách</span>
          </div>
        </CardContent>
      </Card>

      {/* Reserved Tables */}
      <Card className="border border-purple-300 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20 shadow-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider">
              Đã đặt trước
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-900/60 dark:text-purple-300 shadow-xs">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-purple-700 dark:text-purple-400 tabular-nums">
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
