import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import {
  BarChart3,
  CalendarCheck,
  ChefHat,
  FileSpreadsheet,
  RefreshCw,
  TrendingUp,
  Star,
} from 'lucide-react'
import { type Session } from '../auth/session'
import {
  downloadDashboardExcel,
  executeDailySalesClose,
  getDailySalesClose,
  getDashboardReport,
  getKitchenBottlenecks,
  getKitchenSlaReport,
} from './reports.api'
import { ApiError, errorMessage } from '../../shared/api/client'
import {
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
} from '../../shared/ui'
import { FinancialOverviewTab } from './components/financial-overview-tab'
import { KitchenOperationsTab } from './components/kitchen-operations-tab'
import { DailySalesCloseTab } from './components/daily-sales-close-tab'
import { OnlineBusinessTab } from './components/online-business-tab'
import { FeedbackReport } from './components/feedback-report'

function getPresetDates(preset: 'today' | '7days' | '30days' | 'month') {
  const now = new Date()
  const to = now.toISOString()

  if (preset === 'today') {
    const start = new Date(getTodayDateString() + 'T00:00:00+07:00')
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
  const start = new Date(
    getTodayDateString().slice(0, 7) + '-01T00:00:00+07:00',
  )
  return { from: start.toISOString(), to }
}

function getTodayDateString() {
  return new Date().toLocaleDateString('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh',
  })
}

export default function ReportsPage() {
  const { employee, authorization } = useOutletContext<Session>()
  const queryClient = useQueryClient()
  const permissions = authorization.permissionKeys

  const canExport = permissions.includes('/reports_export')
  const canClose = permissions.includes('/reports_close')

  // Date filters
  const [preset, setPreset] = useState<'today' | '7days' | '30days' | 'month'>(
    'today',
  )
  const [dateRange, setDateRange] = useState(() => getPresetDates('today'))
  const [granularity, setGranularity] = useState<'day' | 'hour'>('day')
  const [activeTab, setActiveTab] = useState<
    'overview' | 'kitchen' | 'daily-close' | 'online' | 'feedback'
  >('overview')
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // Daily close date picker (defaults to yesterday or today)
  const [selectedCloseDate, setSelectedCloseDate] =
    useState<string>(getTodayDateString)
  const [confirmCloseModalOpen, setConfirmCloseModalOpen] = useState(false)

  function handleSelectPreset(p: 'today' | '7days' | '30days' | 'month') {
    setPreset(p)
    setDateRange(getPresetDates(p))
  }

  // Queries (lazy loaded according to activeTab)
  const dashboardQuery = useQuery({
    queryKey: [
      'private',
      employee.id,
      'dashboard-report',
      dateRange.from,
      dateRange.to,
      granularity,
    ],
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
    queryKey: [
      'private',
      employee.id,
      'kitchen-sla-report',
      dateRange.from,
      dateRange.to,
    ],
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
    queryKey: [
      'private',
      employee.id,
      'kitchen-bottlenecks-report',
      dateRange.from,
      dateRange.to,
    ],
    queryFn: ({ signal }) =>
      getKitchenBottlenecks(
        {
          from: dateRange.from,
          to: dateRange.to,
        },
        signal,
      ),
    enabled:
      activeTab === 'kitchen' &&
      new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime() <=
        7 * 86400000,
  })

  const dailyCloseQuery = useQuery({
    queryKey: ['private', employee.id, 'daily-sales-close', selectedCloseDate],
    queryFn: async ({ signal }) => {
      try {
        return await getDailySalesClose(selectedCloseDate, signal)
      } catch (error) {
        // If not closed yet, 404 is normal
        if (error instanceof ApiError && error.status === 404) return null
        throw error
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
        queryKey: [
          'private',
          employee.id,
          'daily-sales-close',
          selectedCloseDate,
        ],
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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            BÁO CÁO & THỐNG KÊ
          </p>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
            <BarChart3 className="h-7 w-7 text-primary" /> Báo cáo Doanh thu &
            Vận hành
          </h1>
          <p className="text-sm text-muted-foreground">
            Theo dõi dòng tiền, lợi nhuận gộp, hiệu suất quầy pha chế và chốt sổ
            doanh thu ngày.
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
            <RefreshCw
              className={cn(
                'h-4 w-4',
                dashboardQuery.isFetching && 'animate-spin',
              )}
            />
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
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as typeof activeTab)}
      >
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
          <TabsTrigger value="online" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Hiệu quả đơn online
          </TabsTrigger>
          <TabsTrigger value="feedback" className="gap-2">
            <Star className="h-4 w-4" />
            Phản hồi khách
          </TabsTrigger>
        </TabsList>
        <TabsContent value="feedback">
          <FeedbackReport
            key={`${dateRange.from}:${dateRange.to}`}
            from={dateRange.from}
            to={dateRange.to}
          />
        </TabsContent>

        {/* TAB 1: FINANCIAL OVERVIEW */}
        <TabsContent value="overview">
          <FinancialOverviewTab
            report={dashboardQuery.data}
            isLoading={dashboardQuery.isPending}
            isError={dashboardQuery.isError}
            error={dashboardQuery.error}
            onRefetch={() => void dashboardQuery.refetch()}
            granularity={granularity}
            setGranularity={setGranularity}
          />
        </TabsContent>

        {/* TAB 2: KITCHEN SLA & BOTTLENECKS */}
        <TabsContent value="kitchen">
          <KitchenOperationsTab
            slaStations={kitchenSlaQuery.data?.stations}
            isSlaPending={kitchenSlaQuery.isPending}
            isSlaError={kitchenSlaQuery.isError}
            slaError={kitchenSlaQuery.error}
            bottleneckSlots={kitchenBottlenecksQuery.data?.slots}
            isBottlenecksPending={kitchenBottlenecksQuery.isPending}
            bottlenecksError={
              new Date(dateRange.to).getTime() -
                new Date(dateRange.from).getTime() >
              7 * 86400000
                ? new ApiError(
                    400,
                    undefined,
                    undefined,
                    'Báo cáo nghẽn bếp chỉ hỗ trợ tối đa 7 ngày. Chọn khoảng thời gian ngắn hơn.',
                  )
                : kitchenBottlenecksQuery.error
            }
          />
        </TabsContent>

        {/* TAB 3: DAILY SALES CLOSE */}
        <TabsContent value="online">
          <OnlineBusinessTab from={dateRange.from} to={dateRange.to} />
        </TabsContent>

        {/* TAB 3: DAILY SALES CLOSE */}
        <TabsContent value="daily-close">
          <DailySalesCloseTab
            selectedCloseDate={selectedCloseDate}
            setSelectedCloseDate={setSelectedCloseDate}
            dailyCloseData={dailyCloseQuery.data}
            isPending={dailyCloseQuery.isPending}
            isFetching={dailyCloseQuery.isFetching}
            readError={dailyCloseQuery.error}
            onRefetch={() => void dailyCloseQuery.refetch()}
            canClose={canClose}
            confirmCloseModalOpen={confirmCloseModalOpen}
            setConfirmCloseModalOpen={setConfirmCloseModalOpen}
            onExecuteClose={() => closeMutation.mutate()}
            isClosePending={closeMutation.isPending}
            isCloseError={closeMutation.isError}
            closeError={closeMutation.error}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
