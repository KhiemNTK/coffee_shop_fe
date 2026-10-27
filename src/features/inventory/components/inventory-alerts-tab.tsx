import { ArrowDownToLine, CheckCircle2, RefreshCw } from 'lucide-react'
import { type ReorderAlertRow, type ReorderAlertsResponse } from '../inventory.api'
import { formatQuantity } from '../quantity'
import { Badge, Button, Card, CardContent } from '../../../shared/ui'
import { Pagination } from '../../../shared/ui/pagination'

interface InventoryAlertsTabProps {
  data?: ReorderAlertsResponse
  isLoading: boolean
  onImport: (item: ReorderAlertRow) => void
  canAdjust: boolean
  page: number
  onPage: (page: number) => void
  isFetching: boolean
}

export function InventoryAlertsTab({
  data,
  isLoading,
  onImport,
  canAdjust,
  page, onPage, isFetching,
}: InventoryAlertsTabProps) {
  return (
    <section className="grid gap-4" aria-label="Cảnh báo nhập hàng">
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
              <thead className="border-b border-border bg-muted/50 text-xs font-semibold uppercase text-foreground">
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
                      <p className="font-semibold text-foreground">
                        {data.totalItems === 0 ? 'Không có nguyên liệu trong danh sách cảnh báo.' : 'Trang này không còn mục cảnh báo. Vui lòng quay lại trang đầu.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  data.list.map((alert) => (
                    <tr key={alert.id} className="transition-colors hover:bg-muted/50">
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
                      <td className="py-3.5 px-4 text-right font-bold text-amber-700 dark:text-amber-300">
                        +{formatQuantity(alert.shortageQuantity)} {alert.unitName}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-center">
                        {canAdjust && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => onImport(alert)}
                            className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1 font-semibold"
                          >
                            <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden="true" /> Nhập kho
                          </Button>
                        )}
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
    {data && !isLoading && <Pagination page={page} totalPages={data.totalPages} onPage={onPage} disabled={isFetching} />}
    {data && page > Math.max(1, data.totalPages) && <Button type="button" variant="outline" onClick={() => onPage(1)}>Về trang đầu</Button>}
    </section>
  )
}
