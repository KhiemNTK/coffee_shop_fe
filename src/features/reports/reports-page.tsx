import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  ChefHat,
  Clock,
  CreditCard,
  DollarSign,
  FileSpreadsheet,
  PackageX,
  Receipt,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { type Session } from '../auth/session'
import { formatPrice } from '../menu/menu.api'
import {
  downloadDashboardExcel,
  executeDailySalesClose,
  getDailySalesClose,
  getDashboardReport,
  getKitchenBottlenecks,
  getKitchenSlaReport,
} from './reports.api'
import { errorMessage } from '../../shared/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card'
import { Button } from '../../shared/ui/button'
import { Input } from '../../shared/ui/input'
import { Badge } from '../../shared/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../shared/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../shared/ui/dialog'
import { cn } from '../../shared/ui/utils'

function getPresetDates(preset: 'today' | '7days' | '30days' | 'month') {
  const now = new Date()
  const to = now.toISOString()

  if (preset === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return { from: start.toISOString(), to }
  }
  if (preset === '7days') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    return { from: start.toISOString(), to }
  }
  if (preset === '30days') {
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    return { from: start.toISOString(), to }
  }
  // month
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return { from: start.toISOString(), to }
}

function getTodayDateString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ReportsPage() {
  const { employee, authorization } = useOutletContext<Session>()
  const queryClient = useQueryClient()
  const permissions = authorization.permissionKeys

  const canExport = permissions.includes('/reports_export')
  const canClose = permissions.includes('/reports_close')

  // Date filters
  const [preset, setPreset] = useState<'today' | '7days' | '30days' | 'month'>('today')
  const [dateRange, setDateRange] = useState(() => getPresetDates('today'))
  const [granularity, setGranularity] = useState<'day' | 'hour'>('day')
  const [activeTab, setActiveTab] = useState<'overview' | 'kitchen' | 'daily-close'>('overview')
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // Daily close date picker (defaults to yesterday or today)
  const [selectedCloseDate, setSelectedCloseDate] = useState<string>(getTodayDateString)
  const [confirmCloseModalOpen, setConfirmCloseModalOpen] = useState(false)

  function handleSelectPreset(p: 'today' | '7days' | '30days' | 'month') {
    setPreset(p)
    setDateRange(getPresetDates(p))
  }

  // Queries (lazy loaded according to activeTab)
  const dashboardQuery = useQuery({
    queryKey: ['private', employee.id, 'dashboard-report', dateRange.from, dateRange.to, granularity],
    queryFn: ({ signal }) =>
      getDashboardReport(
        {
          from: dateRange.from,
          to: dateRange.to,
          granularity,
          topLimit: 10,
        },
        signal,
      ),
    enabled: activeTab === 'overview',
  })

  const kitchenSlaQuery = useQuery({
    queryKey: ['private', employee.id, 'kitchen-sla-report', dateRange.from, dateRange.to],
    queryFn: ({ signal }) =>
      getKitchenSlaReport(
        {
          from: dateRange.from,
          to: dateRange.to,
        },
        signal,
      ),
    enabled: activeTab === 'kitchen',
  })

  const kitchenBottlenecksQuery = useQuery({
    queryKey: ['private', employee.id, 'kitchen-bottlenecks-report', dateRange.from, dateRange.to],
    queryFn: ({ signal }) =>
      getKitchenBottlenecks(
        {
          from: dateRange.from,
          to: dateRange.to,
        },
        signal,
      ),
    enabled: activeTab === 'kitchen',
  })

  const dailyCloseQuery = useQuery({
    queryKey: ['private', employee.id, 'daily-sales-close', selectedCloseDate],
    queryFn: async ({ signal }) => {
      try {
        return await getDailySalesClose(selectedCloseDate, signal)
      } catch {
        // If not closed yet, 404 is normal
        return null
      }
    },
    enabled: activeTab === 'daily-close' && !!selectedCloseDate,
  })

  // Execute daily close mutation
  const closeMutation = useMutation({
    mutationFn: () => executeDailySalesClose(selectedCloseDate),
    onSuccess: () => {
      setConfirmCloseModalOpen(false)
      void queryClient.invalidateQueries({
        queryKey: ['private', employee.id, 'daily-sales-close', selectedCloseDate],
      })
    },
  })

  // Excel download handler
  async function handleExportExcel() {
    try {
      setIsExporting(true)
      setExportError(null)
      const blob = await downloadDashboardExcel({
        from: dateRange.from,
        to: dateRange.to,
        granularity,
        topLimit: 20,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Bao-cao-doanh-thu-${preset}-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(errorMessage(err))
    } finally {
      setIsExporting(false)
    }
  }

  const report = dashboardQuery.data
  const trend = report?.trend

  // Calculate maximum revenue for bar chart scaling
  const maxTrendRevenue = useMemo(() => {
    if (!trend?.length) return 1
    const vals = trend.map((t) => Number(t.netRevenue) || 0)
    return Math.max(...vals, 1)
  }, [trend])

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">BÁO CÁO & THỐNG KÊ</p>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
            <BarChart3 className="h-7 w-7 text-primary" /> Báo cáo Doanh thu & Vận hành
          </h1>
          <p className="text-sm text-muted-foreground">
            Theo dõi dòng tiền, lợi nhuận gộp, hiệu suất quầy pha chế và chốt sổ doanh thu ngày.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick preset buttons */}
          <div className="flex items-center rounded-lg border border-border bg-card p-1 text-xs">
            <button
              type="button"
              onClick={() => handleSelectPreset('today')}
              className={cn(
                'rounded-md px-2.5 py-1 font-medium transition-colors',
                preset === 'today'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('7days')}
              className={cn(
                'rounded-md px-2.5 py-1 font-medium transition-colors',
                preset === '7days'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              7 ngày qua
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('30days')}
              className={cn(
                'rounded-md px-2.5 py-1 font-medium transition-colors',
                preset === '30days'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              30 ngày qua
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('month')}
              className={cn(
                'rounded-md px-2.5 py-1 font-medium transition-colors',
                preset === 'month'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Tháng này
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void dashboardQuery.refetch()
              void kitchenSlaQuery.refetch()
              void kitchenBottlenecksQuery.refetch()
            }}
            disabled={dashboardQuery.isFetching}
            className="gap-1.5"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={cn('h-4 w-4', dashboardQuery.isFetching && 'animate-spin')} />
            <span className="hidden sm:inline">Làm mới</span>
          </Button>

          {canExport && (
            <Button
              size="sm"
              onClick={() => void handleExportExcel()}
              disabled={isExporting}
              className="gap-1.5"
              title="Xuất bảng tính Excel đa trang"
            >
              {isExporting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              {isExporting ? 'Đang xuất...' : 'Xuất Excel'}
            </Button>
          )}
        </div>
      </div>

      {exportError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
          {exportError}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as typeof activeTab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Tổng quan tài chính
          </TabsTrigger>
          <TabsTrigger value="kitchen" className="gap-2">
            <ChefHat className="h-4 w-4" />
            Vận hành Bếp & SLA
          </TabsTrigger>
          <TabsTrigger value="daily-close" className="gap-2">
            <CalendarCheck className="h-4 w-4" />
            Chốt sổ doanh thu ngày
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: FINANCIAL OVERVIEW */}
        <TabsContent value="overview" className="space-y-6">
          {dashboardQuery.isError ? (
            <Card className="border-destructive/20 bg-destructive/5 p-8 text-center">
              <p className="font-semibold text-destructive">{errorMessage(dashboardQuery.error)}</p>
              <Button
                variant="outline"
                onClick={() => void dashboardQuery.refetch()}
                className="mt-4"
              >
                Thử lại
              </Button>
            </Card>
          ) : dashboardQuery.isPending || !report ? (
            <Card className="p-16 text-center text-muted-foreground animate-pulse">
              Đang tổng hợp báo cáo tài chính...
            </Card>
          ) : (
            <>
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
                      <span className="text-xs font-medium text-muted-foreground">Lợi nhuận gộp ước tính</span>
                      <TrendingUp className="h-4 w-4 text-primary" />
                    </div>
                    <p className="mt-2 text-xl font-bold text-primary">
                      {formatPrice(String(report.profitability.estimatedGrossProfit))}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Sau trừ NVL & hao hụt
                    </p>
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
                      <span className="text-xs font-medium text-muted-foreground">Giá trị đơn TB (AOV)</span>
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
                                  <span className="text-[10px] text-muted">{item.bucket} ({item.paidInvoiceCount} đơn)</span>
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

              {/* Bottom Tables: Top Selling Items & Low Stock / Waste */}
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
            </>
          )}
        </TabsContent>

        {/* TAB 2: KITCHEN SLA & BOTTLENECKS */}
        <TabsContent value="kitchen" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-foreground">
                Hiệu suất chế biến & Tuân thủ SLA Quầy Bếp
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {kitchenSlaQuery.isPending ? (
                <div className="p-12 text-center text-muted-foreground animate-pulse">
                  Đang tính toán chỉ số SLA quầy bếp...
                </div>
              ) : kitchenSlaQuery.isError ? (
                <div className="p-8 text-center text-destructive">
                  {errorMessage(kitchenSlaQuery.error)}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-y border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Quầy chế biến</th>
                        <th className="px-4 py-3 text-right">Tổng vé nhận</th>
                        <th className="px-4 py-3 text-right">Vé hoàn thành</th>
                        <th className="px-4 py-3 text-right">Vé trễ SLA</th>
                        <th className="px-4 py-3 text-center">Tỷ lệ trễ</th>
                        <th className="px-4 py-3 text-right">TG làm món TB</th>
                        <th className="px-4 py-3 text-right">P95 (95% vé)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {kitchenSlaQuery.data?.stations.map((st, idx) => (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3.5 font-bold text-foreground flex items-center gap-2">
                            <ChefHat className="h-4 w-4 text-primary" />
                            {st.stationName}
                          </td>
                          <td className="px-4 py-3.5 text-right font-medium">{st.totalTickets}</td>
                          <td className="px-4 py-3.5 text-right text-emerald-600 font-semibold">
                            {st.completedTickets}
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold text-destructive">
                            {st.breachedTickets}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <Badge
                              variant={st.breachRatePercent > 10 ? 'destructive' : 'outline'}
                              className="text-xs"
                            >
                              {st.breachRatePercent}%
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5 text-right text-xs">
                            {st.averageTicketToReadySeconds !== null &&
                            st.averageTicketToReadySeconds !== undefined
                              ? `${Math.round(st.averageTicketToReadySeconds / 60)} phút ${st.averageTicketToReadySeconds % 60}s`
                              : '—'}
                          </td>
                          <td className="px-4 py-3.5 text-right text-xs text-muted-foreground">
                            {st.p95TicketToReadySeconds !== null &&
                            st.p95TicketToReadySeconds !== undefined
                              ? `${Math.round(st.p95TicketToReadySeconds / 60)} phút`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                      {!kitchenSlaQuery.data?.stations.length && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                            Chưa có dữ liệu vé bếp trong khoảng thời gian này.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Kitchen Bottlenecks Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                Cảnh báo Khung giờ Nút thắt Cổ chai (Live Bottlenecks)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {kitchenBottlenecksQuery.isPending ? (
                <div className="p-8 text-center text-muted-foreground animate-pulse text-xs">
                  Đang phân tích các khung giờ nghẽn...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-y border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Khung giờ</th>
                        <th className="px-4 py-3">Quầy</th>
                        <th className="px-4 py-3 text-right">Tổng món yêu cầu</th>
                        <th className="px-4 py-3 text-right">Vé trễ SLA</th>
                        <th className="px-4 py-3 text-center">Tỷ lệ trễ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {kitchenBottlenecksQuery.data?.slots
                        .filter((slot) => slot.breachedTickets > 0)
                        .slice(0, 10)
                        .map((slot, idx) => (
                          <tr key={idx} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 text-xs font-semibold text-foreground">
                              {new Date(slot.bucketStartAt).toLocaleString('vi-VN')}
                            </td>
                            <td className="px-4 py-3 text-xs">{slot.stationName}</td>
                            <td className="px-4 py-3 text-right font-medium">
                              {slot.orderedUnitCount ?? slot.totalTickets}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-destructive">
                              {slot.breachedTickets}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Badge variant="destructive" className="text-xs">
                                {slot.breachRatePercent}%
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      {!kitchenBottlenecksQuery.data?.slots.some((s) => s.breachedTickets > 0) && (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-xs text-emerald-600">
                            Không phát hiện khung giờ nút thắt cổ chai nào nghiêm trọng.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: DAILY SALES CLOSE */}
        <TabsContent value="daily-close" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 gap-3">
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  Chứng từ & Thao tác Chốt sổ ngày (Daily Sales Close)
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Chốt sổ doanh thu toàn quán theo ngày kinh doanh chuẩn giờ Việt Nam. Yêu cầu toàn bộ ca thu ngân đã đóng.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Input
                  type="date"
                  value={selectedCloseDate}
                  onChange={(e) => setSelectedCloseDate(e.target.value)}
                  className="w-44 text-xs h-9"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void dailyCloseQuery.refetch()}
                  disabled={dailyCloseQuery.isFetching}
                >
                  Kiểm tra
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {dailyCloseQuery.isPending ? (
                <div className="py-12 text-center text-muted-foreground animate-pulse text-xs">
                  Đang kiểm tra chứng từ chốt sổ ngày {selectedCloseDate}...
                </div>
              ) : dailyCloseQuery.data ? (
                <div className="space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                    <div>
                      <h2 className="text-base font-bold text-foreground">
                        Ngày {dailyCloseQuery.data.businessDate} đã được chốt sổ thành công
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Thời điểm chốt: {new Date(dailyCloseQuery.data.closedAt).toLocaleString('vi-VN')} | Mã nhân viên thực hiện: {dailyCloseQuery.data.closedByEmployeeId}
                      </p>
                    </div>
                  </div>

                  {dailyCloseQuery.data.refundDeltaSinceClose && (
                    <div className="rounded-lg border border-border bg-card p-3 text-xs space-y-1">
                      <p className="font-semibold text-foreground">Biến động phát sinh sau khi chốt sổ:</p>
                      <p className="text-muted-foreground">
                        Hoàn tiền sau chốt: {dailyCloseQuery.data.refundDeltaSinceClose.count} giao dịch ({formatPrice(String(dailyCloseQuery.data.refundDeltaSinceClose.amount))})
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
                    <div>
                      <h2 className="text-base font-bold text-foreground">
                        Ngày {selectedCloseDate} chưa thực hiện chốt sổ
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Khi ngày kinh doanh kết thúc và các ca thu ngân đều đã đóng, bạn có thể thực hiện chốt sổ để khóa dữ liệu tài chính.
                      </p>
                    </div>
                  </div>

                  {canClose && (
                    <div className="pt-2">
                      <Button
                        onClick={() => setConfirmCloseModalOpen(true)}
                        className="gap-2"
                      >
                        <CalendarCheck className="h-4 w-4" />
                        Tiến hành Chốt sổ ngày {selectedCloseDate}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL: XÁC NHẬN CHỐT SỔ NGÀY */}
      {confirmCloseModalOpen && (
        <Dialog open onOpenChange={() => setConfirmCloseModalOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-primary flex items-center gap-2">
                <CalendarCheck className="h-5 w-5" />
                Xác nhận chốt sổ ngày {selectedCloseDate}
              </DialogTitle>
              <DialogDescription>
                Thao tác này sẽ khóa toàn bộ số liệu doanh thu và ghi lại snapshot tài chính của ngày {selectedCloseDate}. Hãy chắc chắn rằng tất cả nhân viên thu ngân đã đóng ca làm việc.
              </DialogDescription>
            </DialogHeader>

            {closeMutation.isError && (
              <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                {errorMessage(closeMutation.error)}
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmCloseModalOpen(false)}
                disabled={closeMutation.isPending}
              >
                Hủy
              </Button>
              <Button
                onClick={() => closeMutation.mutate()}
                disabled={closeMutation.isPending}
                className="gap-2"
              >
                {closeMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {closeMutation.isPending ? 'Đang xử lý...' : 'Xác nhận Chốt sổ'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
