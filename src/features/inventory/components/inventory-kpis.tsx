import { AlertTriangle, FileText, PackageCheck } from 'lucide-react'
import { Card, CardContent, cn } from '../../../shared/ui'

interface InventoryKpisProps {
  totalItems: number
  alertCount: number
  categoriesCount: number
}

export function InventoryKpis({
  totalItems,
  alertCount,
  categoriesCount,
}: InventoryKpisProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Nguyên liệu khớp bộ lọc
            </p>
            <h3 className="text-xl sm:text-2xl font-bold text-foreground mt-1">
              {totalItems}
            </h3>
          </div>
          <div className="h-10 w-10 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center">
            <PackageCheck className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      <Card
        className={cn(
          'border-border/80 shadow-xs transition-all',
          alertCount > 0 && 'border-amber-300 bg-amber-50/30',
        )}
      >
        <CardContent className="p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Cần nhập hàng (Sắp hết)
            </p>
            <h3
              className={cn(
                'text-xl sm:text-2xl font-bold mt-1',
                alertCount > 0 ? 'text-amber-800' : 'text-emerald-700',
              )}
            >
              {alertCount} mặt hàng
            </h3>
          </div>
          <div
            className={cn(
              'h-10 w-10 rounded-xl flex items-center justify-center',
              alertCount > 0
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-50 text-emerald-700',
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 sm:p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Danh mục kho
            </p>
            <h3 className="text-xl sm:text-2xl font-bold text-brand-900 mt-1">
              {categoriesCount} nhóm
            </h3>
          </div>
          <div className="h-10 w-10 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center">
            <FileText className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
