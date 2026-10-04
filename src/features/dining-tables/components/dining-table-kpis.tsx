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
      <Card className="border border-border/80 shadow-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Tổng số bàn
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Armchair className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{stats.total}</span>
            <span className="text-xs text-muted-foreground">bàn trong quán</span>
          </div>
        </CardContent>
      </Card>

      {/* Empty Tables */}
      <Card className="border border-emerald-200/80 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/10 shadow-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              Bàn trống
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
              <Coffee className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {stats.empty}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400/80">
              ({stats.emptyPercent}% sẵn sàng)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Occupied Tables */}
      <Card className="border border-amber-200/80 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/10 shadow-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-800 dark:text-amber-300 uppercase tracking-wider">
              Đang phục vụ
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
              <UtensilsCrossed className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-700 dark:text-amber-400">
              {stats.occupied}
            </span>
            <span className="text-xs text-amber-600 dark:text-amber-400/80">đang có khách</span>
          </div>
        </CardContent>
      </Card>

      {/* Reserved Tables */}
      <Card className="border border-purple-200/80 bg-purple-50/30 dark:border-purple-900/40 dark:bg-purple-950/10 shadow-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-purple-800 dark:text-purple-300 uppercase tracking-wider">
              Đã đặt trước
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-purple-700 dark:text-purple-400">
              {stats.reserved}
            </span>
            <Link
              to="/staff/reservations"
              className="text-xs text-purple-600 hover:underline dark:text-purple-400"
            >
              Xem lịch đặt →
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
