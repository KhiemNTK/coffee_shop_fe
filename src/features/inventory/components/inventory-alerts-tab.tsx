import { ArrowDownToLine, CheckCircle2, RefreshCw } from 'lucide-react'
import { type ReorderAlertRow, type ReorderAlertsResponse } from '../inventory.api'
import { formatQuantity } from '../quantity'
import { Badge, Button, Card, CardContent } from '../../../shared/ui'

interface InventoryAlertsTabProps {
  data?: ReorderAlertsResponse
  isLoading: boolean
  onImport: (item: ReorderAlertRow) => void
}

export function InventoryAlertsTab({
  data,
  isLoading,
  onImport,
}: InventoryAlertsTabProps) {
  return (
    <Card className="border-border/80 shadow-xs overflow-hidden">
      <CardContent className="p-0">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <RefreshCw className="h-6 w-6 animate-spin text-brand-700" />
            <p className="text-sm">Đang kiểm tra cảnh báo tồn kho…</p>
          </div>
        )}

        {data && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-amber-50/50 border-b border-amber-200 text-xs uppercase text-amber-900 font-semibold">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Mặt hàng thiếu hụt</th>
                  <th className="py-3.5 px-4">Nhóm kho</th>
                  <th className="py-3.5 px-4">Đơn vị</th>
                  <th className="py-3.5 px-4 text-right">Tồn hiện tại</th>
                  <th className="py-3.5 px-4 text-right">Mức tối thiểu</th>
                  <th className="py-3.5 px-4 text-right">Cần nhập thêm</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.list.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                      <p className="font-semibold text-foreground">Kho hàng an toàn!</p>
                      <span className="text-xs">
                        Tất cả nguyên vật liệu đều đang trên mức tối thiểu.
                      </span>
                    </td>
                  </tr>
                ) : (
                  data.list.map((alert) => (
                    <tr key={alert.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6 font-semibold text-foreground">
                        {alert.name}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant="outline" className="text-xs">
                          {alert.categoryName}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-muted-foreground">
                        {alert.unitName}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-destructive">
                        {formatQuantity(alert.stock)} {alert.unitName}
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs text-muted-foreground">
                        {formatQuantity(alert.reorderPoint)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-amber-700">
                        +{formatQuantity(alert.shortageQuantity)} {alert.unitName}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-center">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => onImport(alert)}
                          className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1 font-semibold"
                        >
                          <ArrowDownToLine className="h-3.5 w-3.5" /> Tạo phiếu nhập
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
