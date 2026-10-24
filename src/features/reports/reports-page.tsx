import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import {
  CalendarCheck,
  ChefHat,
  FileSpreadsheet,
  RefreshCw,
  TrendingUp,
  Star,
  Sparkles,
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
import { formatDateTime } from '../../shared/lib/format'
import {
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
  OperationsHeader,
} from '../../shared/ui'
import { FinancialOverviewTab } from './components/financial-overview-tab'
import { KitchenOperationsTab } from './components/kitchen-operations-tab'
import { DailySalesCloseTab } from './components/daily-sales-close-tab'
import { OnlineBusinessTab } from './components/online-business-tab'
import { FeedbackReport } from './components/feedback-report'
import { BusinessInsightsTab } from './components/business-insights-tab'

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
  const start = new Date(getTodayDateString().slice(0, 7) + '-01T00:00:00+07:00')
  return { from: start.toISOString(), to }
}

function getTodayDateString() {
  return new Date().toLocaleDateString('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh',
  })
}

export default function ReportsPage() {
  const { t } = useTranslation()
  const { employee, access } = useOutletContext<Session>()
  const queryClient = useQueryClient()


  const canExport = access.has('/reports_export')
  const canClose = access.has('/reports_close')

  // Date filters
  const [preset, setPreset] = useState<'today' | '7days' | '30days' | 'month'>('today')
  const [dateRange, setDateRange] = useState(() => getPresetDates('today'))
  const [granularity, setGranularity] = useState<'day' | 'hour'>('day')
  const [activeTab, setActiveTab] = useState<
    'overview' | 'kitchen' | 'daily-close' | 'online' | 'feedback' | 'insights'
  >('overview')
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
    enabled:
      activeTab === 'kitchen' &&
      new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime() <= 7 * 86400000,
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
        queryKey: ['private', employee.id, 'daily-sales-close', selectedCloseDate],
      })
    },
  })

  function refreshReport() {
    if (activeTab === 'daily-close') void dailyCloseQuery.refetch()
    else setDateRange(getPresetDates(preset))
  }

  const refreshing =
    activeTab === 'overview'
      ? dashboardQuery.isFetching
      : activeTab === 'kitchen'
        ? kitchenSlaQuery.isFetching || kitchenBottlenecksQuery.isFetching
        : activeTab === 'daily-close' && dailyCloseQuery.isFetching

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
    <div className="admin-page space-y-5">
      {/* Top Header */}
      <OperationsHeader
        title={t('finance.title')}
        meta={t('finance.meta')}
        actions={
          <>
            {/* Quick preset buttons */}
            <div className="flex items-center rounded-lg border border-border bg-card p-1 text-xs">
              <button
                type="button"
                aria-pressed={preset === 'today'}
                onClick={() => handleSelectPreset('today')}
                className={cn(
                  'min-h-10 rounded-md px-2.5 py-1 font-medium transition-colors',
                  preset === 'today'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t('finance.today')}
              </button>
              <button
                type="button"
                aria-pressed={preset === '7days'}
                onClick={() => handleSelectPreset('7days')}
                className={cn(
                  'min-h-10 rounded-md px-2.5 py-1 font-medium transition-colors',
                  preset === '7days'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t('finance.last7Days')}
              </button>
              <button
                type="button"
                aria-pressed={preset === '30days'}
                onClick={() => handleSelectPreset('30days')}
                className={cn(
                  'min-h-10 rounded-md px-2.5 py-1 font-medium transition-colors',
                  preset === '30days'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t('finance.last30Days')}
              </button>
              <button
                type="button"
                aria-pressed={preset === 'month'}
                onClick={() => handleSelectPreset('month')}
                className={cn(
                  'min-h-10 rounded-md px-2.5 py-1 font-medium transition-colors',
                  preset === 'month'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t('finance.thisMonth')}
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={refreshReport}
              disabled={refreshing}
              className="min-h-10 gap-1.5"
              title={t('finance.refreshData')}
              aria-label={t('finance.refreshData')}
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              <span className="hidden sm:inline">{t('finance.refresh')}</span>
            </Button>

            {canExport && (
              <Button
                size="sm"
                onClick={() => void handleExportExcel()}
                disabled={isExporting}
                className="min-h-10 gap-1.5"
                title={t('finance.export')}
              >
                {isExporting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
                {t(isExporting ? 'finance.exporting' : 'finance.export')}
              </Button>
            )}
          </>
        }
      />

      {activeTab !== 'daily-close' && (
        <p className="text-xs text-muted-foreground">
          {t('finance.reportWindow', {
            from: formatDateTime(dateRange.from),
            to: formatDateTime(dateRange.to),
          })}
        </p>
      )}

      {exportError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive"
        >
          {exportError}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as typeof activeTab)}>
        <TabsList className="admin-tabs mb-4">
          <TabsTrigger value="overview" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            {t('finance.overview')}
          </TabsTrigger>
          <TabsTrigger value="kitchen" className="gap-2">
            <ChefHat className="h-4 w-4" />
            {t('finance.kitchen')}
          </TabsTrigger>
          <TabsTrigger value="daily-close" className="gap-2">
            <CalendarCheck className="h-4 w-4" />
            {t('finance.dailyClose')}
          </TabsTrigger>
          <TabsTrigger value="online" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            {t('finance.online')}
          </TabsTrigger>
          <TabsTrigger value="feedback" className="gap-2">
            <Star className="h-4 w-4" />
            {t('finance.feedback')}
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-2 whitespace-normal">
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t('finance.insights')}
          </TabsTrigger>
        </TabsList>
        <BusinessInsightsTab
          key={employee.id}
          employeeId={employee.id}
          from={dateRange.from}
          to={dateRange.to}
          active={activeTab === 'insights'}
          canRead={access.has('/reports_read')}
          canGenerate={access.has('/reports_insights_generate')}
        />
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
            onRefetch={refreshReport}
            granularity={granularity}
            setGranularity={setGranularity}
          />
        </TabsContent>

        {/* TAB 2: KITCHEN SLA & BOTTLENECKS */}
        <TabsContent value="kitchen">
          <KitchenOperationsTab
            key={`${dateRange.from}:${dateRange.to}`}
            slaStations={kitchenSlaQuery.data?.stations}
            isSlaPending={kitchenSlaQuery.isPending}
            isSlaError={kitchenSlaQuery.isError}
            slaError={kitchenSlaQuery.error}
            bottleneckSlots={kitchenBottlenecksQuery.data?.slots}
            isBottlenecksPending={kitchenBottlenecksQuery.isPending}
            bottlenecksError={
              new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime() > 7 * 86400000
                ? new ApiError(
                    400,
                    undefined,
                    undefined,
                    t('finance.kitchenRange'),
                  )
                : kitchenBottlenecksQuery.error
            }
          />
        </TabsContent>

        {/* TAB 3: DAILY SALES CLOSE */}
        <TabsContent value="online">
          <OnlineBusinessTab from={dateRange.from} to={dateRange.to} onRefresh={refreshReport} />
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
