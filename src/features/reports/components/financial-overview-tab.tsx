import { useMemo } from 'react'
import {
  AlertTriangle,
  CreditCard,
  DollarSign,
  PackageX,
  Receipt,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { type DashboardReport } from '../reports.api'
import { formatPrice } from '../../menu/menu.api'
import { errorMessage } from '../../../shared/api/client'
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, cn } from '../../../shared/ui'

interface FinancialOverviewTabProps {
  report?: DashboardReport
  isLoading: boolean
  isError: boolean
  error: unknown
  onRefetch: () => void
  granularity: 'day' | 'hour'
  setGranularity: (g: 'day' | 'hour') => void
}

export function FinancialOverviewTab({
  report,
  isLoading,
  isError,
  error,
  onRefetch,
  granularity,
  setGranularity,
}: FinancialOverviewTabProps) {
  const trend = report?.trend
  // Calculate maximum revenue for bar chart scaling
  const maxTrendRevenue = useMemo(() => {
    if (!trend?.length) return 1
    const vals = trend.map((t) => Number(t.netRevenue) || 0)
    return Math.max(...vals, 1)
  }, [trend])

  if (isError) {
    return (
      <Card className="border-destructive/20 bg-destructive/5 p-8 text-center">
        <p className="font-semibold text-destructive">{errorMessage(error)}</p>
        <Button variant="outline" onClick={onRefetch} className="mt-4">
          Thử lại
        </Button>
      </Card>
    )
  }

  if (isLoading || !report) {
    return (
      <Card className="p-16 text-center text-muted-foreground animate-pulse">
        Đang tổng hợp báo cáo tài chính...
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* 6 Executive Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Thực thu thuần</span>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-xl font-bold text-foreground">
              {formatPrice(String(report.summary.netRevenue))}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Gộp: {formatPrice(String(report.summary.grossSales))}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Lợi nhuận gộp ước tính
              </span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-xl font-bold text-primary">
              {formatPrice(String(report.profitability.estimatedGrossProfit))}
            </p>
            <p className="text-[11px] text-muted-foreground">Sau trừ NVL & hao hụt</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Số đơn đã TT</span>
              <Receipt className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-xl font-bold text-foreground">
              {report.summary.paidInvoiceCount}
            </p>
            <p className="text-[11px] text-muted-foreground">Hóa đơn hoàn tất</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Giá trị đơn TB (AOV)
              </span>
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-xl font-bold text-foreground">
              {formatPrice(String(report.summary.averageTicket))}
            </p>
            <p className="text-[11px] text-muted-foreground">Trung bình / hóa đơn</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Giá vốn NVL (COGS)</span>
              <PackageX className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-2 text-xl font-bold text-amber-600">
              {formatPrice(String(report.profitability.ingredientCost))}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Hủy kho: {formatPrice(String(report.profitability.wasteCost))}
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            Number(report.summary.cashShortageAmount) > 0 &&
              'border-destructive/40 bg-destructive/5',
          )}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Chênh lệch ca</span>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </div>
            <p
              className={cn(
                'mt-2 text-xl font-bold',
                Number(report.summary.cashShortageAmount) > 0
                  ? 'text-destructive'
                  : 'text-foreground',
              )}
            >
              {Number(report.summary.cashShortageAmount) > 0
                ? `-${formatPrice(String(report.summary.cashShortageAmount))}`
                : '0 ₫'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {report.summary.discrepantShiftCount} ca phát sinh lệch
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts & Distributions Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Visual Sales Trend Bar Chart */}
        <Card className="lg:col-span-8">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-bold text-foreground">
              Biến động Doanh thu theo thời gian
            </CardTitle>
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setGranularity('day')}
                className={cn(
                  'rounded-md px-2 py-0.5 font-medium transition-colors cursor-pointer',
                  granularity === 'day'
                    ? 'bg-muted text-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Ngày
              </button>
              <button
                type="button"
                onClick={() => setGranularity('hour')}
                className={cn(
                  'rounded-md px-2 py-0.5 font-medium transition-colors cursor-pointer',
                  granularity === 'hour'
                    ? 'bg-muted text-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Giờ
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {report.trend.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-xs text-muted-foreground">
                Không có giao dịch trong khoảng thời gian này.
              </div>
            ) : (
              <div className="space-y-4">
                {/* CSS/SVG Bar Chart */}
                <div className="flex h-56 items-end gap-1.5 border-b border-border pb-2 pt-6">
                  {report.trend.map((item, idx) => {
                    const rev = Number(item.netRevenue) || 0
                    const heightPct = Math.max(Math.round((rev / maxTrendRevenue) * 100), 4)
                    return (
                      <div
                        key={idx}
                        className="group relative flex flex-1 flex-col items-center h-full justify-end"
                      >
                        {/* Tooltip */}
                        <div className="absolute -top-12 z-20 hidden whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] text-background shadow-md group-hover:flex flex-col items-center">
                          <span className="font-semibold">{formatPrice(String(item.netRevenue))}</span>
                          <span className="text-[10px] text-muted">
                            {item.bucket} ({item.paidInvoiceCount} đơn)
                          </span>
                        </div>

                        {/* Bar */}
                        <div
                          style={{ height: `${heightPct}%` }}
                          className="w-full max-w-[32px] rounded-t-sm bg-primary transition-all duration-300 hover:bg-primary/80"
                        />

                        {/* Label */}
                        <span className="mt-1.5 text-[10px] text-muted-foreground truncate w-full text-center">
                          {item.bucket.slice(-5)}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground text-center">
                  Di chuột lên cột để xem chi tiết doanh thu và số lượng đơn hàng tương ứng.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Methods Distribution */}
        <Card className="lg:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground">
              Phương thức thanh toán
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {report.paymentMethods.map((pm) => {
              const totalNet = Number(report.summary.netRevenue) || 1
              const currentNet = Number(pm.netRevenue) || 0
              const pct = Math.round((currentNet / totalNet) * 100)

              const labelMap: Record<string, string> = {
                CASH: 'Tiền mặt',
                CARD: 'Thẻ ngân hàng (POS)',
                TRANSFER: 'Chuyển khoản / QR',
              }

              return (
                <div key={pm.paymentMethod} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">
                      {labelMap[pm.paymentMethod] || pm.paymentMethod}
                    </span>
                    <span className="font-bold text-primary">
                      {formatPrice(String(pm.netRevenue))} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {pm.paidInvoiceCount} giao dịch hoàn tất
                  </p>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Tables: Top Selling Items & Low Stock */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Top Selling Items */}
        <Card className="lg:col-span-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground">
              Top 10 Món bán chạy nhất
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-y border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center">#</th>
                    <th className="px-4 py-3">Tên món</th>
                    <th className="px-4 py-3">Danh mục</th>
                    <th className="px-4 py-3 text-right">Số lượng bán</th>
                    <th className="px-4 py-3 text-right">Tổng doanh thu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {report.topItems.map((item, index) => (
                    <tr key={item.menuItemId} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-center font-bold text-muted-foreground">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {item.name}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">
                          {item.categoryName}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">
                        {item.quantitySold}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-primary">
                        {formatPrice(String(item.grossSales))}
                      </td>
                    </tr>
                  ))}
                  {!report.topItems.length && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                        Chưa có dữ liệu bán hàng trong kỳ này.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Warning Card */}
        <Card className="lg:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Nguyên liệu chạm ngưỡng cảnh báo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-y border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Nguyên liệu</th>
                    <th className="px-4 py-3 text-right">Tồn kho</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {report.lowStockItems.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-xs font-semibold text-foreground">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant="destructive" className="text-xs">
                          {item.stock} {item.unitName}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {!report.lowStockItems.length && (
                    <tr>
                      <td colSpan={2} className="py-8 text-center text-xs text-emerald-600">
                        Tất cả nguyên liệu đều ở mức an toàn.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
