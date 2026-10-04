import { Calendar, Clock, Receipt, Sparkles } from 'lucide-react'
import { Card, CardContent } from '../../../shared/ui'

interface PromotionKpisProps {
  stats: {
    active: number
    upcoming: number
    expired: number
    totalUsage: number
  }
}

export function PromotionKpis({ stats }: PromotionKpisProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="border-border">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Đang áp dụng
            </span>
            <p className="text-2xl font-bold text-emerald-700 mt-1">
              {stats.active}
            </p>
          </div>
          <span className="p-2.5 rounded-full bg-emerald-50 text-emerald-700">
            <Sparkles className="h-5 w-5" />
          </span>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Sắp diễn ra
            </span>
            <p className="text-2xl font-bold text-blue-700 mt-1">
              {stats.upcoming}
            </p>
          </div>
          <span className="p-2.5 rounded-full bg-blue-50 text-blue-700">
            <Clock className="h-5 w-5" />
          </span>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Đã hết hạn
            </span>
            <p className="text-2xl font-bold text-slate-600 mt-1">
              {stats.expired}
            </p>
          </div>
          <span className="p-2.5 rounded-full bg-slate-100 text-slate-600">
            <Calendar className="h-5 w-5" />
          </span>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Lượt dùng trên hóa đơn
            </span>
            <p className="text-2xl font-bold text-foreground mt-1">
              {stats.totalUsage}
            </p>
          </div>
          <span className="p-2.5 rounded-full bg-amber-50 text-amber-700">
            <Receipt className="h-5 w-5" />
          </span>
        </CardContent>
      </Card>
    </div>
  )
}
