import { AlertTriangle, Boxes, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'
import { type ItemStockStatusResponse } from '../menu.admin.api'
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui/card'
import { Button } from '../../../shared/ui/button'
import { Badge } from '../../../shared/ui/badge'

interface StockAlertTabProps {
  stockStatusQuery: UseQueryResult<ItemStockStatusResponse, Error>
  stockMetrics: {
    insufficientCount: number
    lowCount: number
    okCount: number
    untrackedCount: number
  }
  canUpdate: boolean
  toggleMutation: UseMutationResult<unknown, Error, { id: string; isAvailable: boolean }>
}

export function StockAlertTab({
  stockStatusQuery,
  stockMetrics,
  canUpdate,
  toggleMutation,
}: StockAlertTabProps) {
  return (
    <div className="space-y-4">
      <Card className="border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-sm font-bold text-foreground">Giám sát Nguyên liệu Theo Món</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Hệ thống tự động tính toán tồn kho của từng nguyên liệu trong công thức. Nếu nguyên liệu bị thiếu hoặc chạm ngưỡng cảnh báo, bạn có thể tạm ngưng món hoặc chuyển tới màn hình Kho để nhập hàng.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-bold text-foreground">
            Các món cần lưu ý nguyên liệu ({stockMetrics.insufficientCount + stockMetrics.lowCount})
          </CardTitle>
          <Link to="/staff/inventory">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Boxes className="h-4 w-4" />
              Mở quản lý kho
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-y border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Món</th>
                  <th className="px-4 py-3">Tình trạng</th>
                  <th className="px-4 py-3">Nguyên liệu bị thiếu / chạm ngưỡng</th>
                  <th className="px-4 py-3 text-center">Trạng thái bán</th>
                  <th className="px-4 py-3 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stockStatusQuery.data?.list
                  .filter((item) => item.stockStatus === 'INSUFFICIENT' || item.stockStatus === 'LOW')
                  .map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-foreground">{item.name}</td>
                      <td className="px-4 py-3.5">
                        {item.stockStatus === 'INSUFFICIENT' ? (
                          <Badge variant="destructive">Hết nguyên liệu</Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-500/50 text-amber-600 bg-amber-500/10">
                            Sắp hết nguyên liệu
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {item.atRiskIngredients.map((ing) => (
                            <span
                              key={ing.id}
                              className="inline-flex items-center rounded-md border border-border bg-card px-2 py-0.5 text-xs text-foreground font-medium"
                            >
                              {ing.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Badge variant={item.isAvailable ? 'success' : 'secondary'}>
                          {item.isAvailable ? 'Đang bật bán' : 'Đã ngưng bán'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {canUpdate && item.isAvailable && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              toggleMutation.mutate({ id: item.id, isAvailable: false })
                            }
                            disabled={toggleMutation.isPending}
                            className="text-xs text-destructive hover:bg-destructive/10"
                          >
                            Tắt bán ngay
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {stockMetrics.insufficientCount === 0 && stockMetrics.lowCount === 0 && (
            <div className="p-8 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
              <p className="mt-2 font-semibold text-foreground">
                Tất cả các món đều đủ nguyên liệu!
              </p>
              <p className="text-xs text-muted-foreground">
                Không có món nào bị cảnh báo thiếu kho tại thời điểm hiện tại.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
