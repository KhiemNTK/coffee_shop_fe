import { Ban, Clock, Coins, FileText } from 'lucide-react'
import { Card, CardContent } from '../../../shared/ui'
import { formatPrice } from '../../menu/menu.api'

interface InvoicesKpisProps {
  totalPaidAmount: number
  totalItems: number
  unpaidCount: number
  voidedCount: number
}

export function InvoicesKpis({
  totalPaidAmount,
  totalItems,
  unpaidCount,
  voidedCount,
}: InvoicesKpisProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Doanh thu trang này
            </p>
            <h3 className="text-xl sm:text-2xl font-bold text-brand-900 mt-1">
              {formatPrice(String(totalPaidAmount))}
            </h3>
          </div>
          <div className="h-10 w-10 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center">
            <Coins className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Tổng hóa đơn
            </p>
            <h3 className="text-xl sm:text-2xl font-bold text-foreground mt-1">
              {totalItems}
            </h3>
          </div>
          <div className="h-10 w-10 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center">
            <FileText className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Chưa thanh toán
            </p>
            <h3 className="text-xl sm:text-2xl font-bold text-amber-700 mt-1">
              {unpaidCount}
            </h3>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <Clock className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Đã hủy / Hoàn trả
            </p>
            <h3 className="text-xl sm:text-2xl font-bold text-destructive mt-1">
              {voidedCount}
            </h3>
          </div>
          <div className="h-10 w-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
            <Ban className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
