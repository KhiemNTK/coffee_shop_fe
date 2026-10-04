import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import {
  AlertTriangle,
  ChefHat,
  Clock,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
} from 'lucide-react'
import { type Session } from '@/features/auth/session'
import { printingApi, type PrintDevice, type PrintJob } from './printing.api'
import {
  Badge,
  Button,
  Card,
  CardContent,
} from '@/shared/ui'
import { PrintDevicesTab } from './components/print-devices-tab'
import { PrintJobsTab } from './components/print-jobs-tab'
import { ReprintReceiptTab } from './components/reprint-receipt-tab'

const EMPTY_DEVICES: PrintDevice[] = []
const EMPTY_JOBS: PrintJob[] = []

export function PrintingPage() {
  const { authorization } = useOutletContext<Session>()
  const permissions = authorization.permissionKeys
  const canManageDevices = permissions.includes('/print-devices_manage')
  const canManageJobs = permissions.includes('/print-jobs_manage')
  const canReprint = permissions.includes('/receipts_reprint')

  // Main Active Tab
  const [activeTab, setActiveTab] = useState<'DEVICES' | 'JOBS' | 'REPRINT'>('DEVICES')

  // Create Device Modal state (shared with header action)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  // Fetch Print Devices for KPIs and options
  const {
    data: devicesData,
    refetch: refetchDevices,
    isFetching: isFetchingDevices,
  } = useQuery({
    queryKey: ['print-devices', 'all-for-kpi'],
    queryFn: ({ signal }) => printingApi.getDevices({ itemPerPage: 50 }, signal),
  })

  // Fetch Print Jobs summary for KPI
  const {
    data: jobsData,
    refetch: refetchJobs,
    isFetching: isFetchingJobs,
  } = useQuery({
    queryKey: ['print-jobs', 'kpi-summary'],
    queryFn: ({ signal }) => printingApi.getJobs({ itemPerPage: 10 }, signal),
  })

  const devices = devicesData?.list ?? EMPTY_DEVICES
  const jobs = jobsData?.list ?? EMPTY_JOBS

  // Top KPI Metrics
  const stats = useMemo(() => {
    const totalDevices = devices.length
    const onlineDevices = devices.filter((d) => d.isOnline).length
    const receiptPrinters = devices.filter((d) => d.type === 'RECEIPT')
    const kitchenPrinters = devices.filter((d) => d.type === 'KITCHEN')
    const defaultReceipt = receiptPrinters.find((d) => d.isDefault)

    const failedJobs = jobs.filter((j) => j.status === 'FAILED').length
    const pendingJobs = jobs.filter((j) => j.status === 'PENDING').length

    return {
      totalDevices,
      onlineDevices,
      receiptCount: receiptPrinters.length,
      kitchenCount: kitchenPrinters.length,
      defaultReceiptName: defaultReceipt?.name || 'Chưa thiết lập',
      attentionJobsCount: failedJobs + pendingJobs,
    }
  }, [devices, jobs])

  const handleRefresh = () => {
    void refetchDevices()
    void refetchJobs()
  }

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Quản trị Thiết bị In & Lệnh in
                </h1>
                <span className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary uppercase tracking-wider">
                  Hardware Infrastructure
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cấu hình máy in hóa đơn bill, trạm in bếp KDS và điều phối hàng đợi lệnh in thời gian thực
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetchingDevices || isFetchingJobs}
            className="h-9 gap-1.5 text-xs"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isFetchingDevices || isFetchingJobs ? 'animate-spin' : ''}`}
            />
            <span>Làm mới</span>
          </Button>

          {canManageDevices && (
            <Button
              size="sm"
              onClick={() => {
                setActiveTab('DEVICES')
                setIsCreateOpen(true)
              }}
              className="h-9 gap-1.5 bg-primary text-primary-foreground text-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm máy in</span>
            </Button>
          )}
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Devices */}
        <Card className="border border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Tổng thiết bị in</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{stats.totalDevices}</p>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  <strong className="text-foreground">{stats.onlineDevices}</strong> trực tuyến
                </span>
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Printer className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Receipt Printers */}
        <Card className="border border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Máy in Hóa đơn</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{stats.receiptCount}</p>
              <p className="mt-1.5 text-xs text-muted-foreground truncate max-w-[160px]">
                Mặc định: <span className="font-semibold text-foreground">{stats.defaultReceiptName}</span>
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Receipt className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Kitchen Printers */}
        <Card className="border border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Máy in Bếp & Bar</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{stats.kitchenCount}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Trạm in phiếu chế biến thực đơn
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <ChefHat className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Jobs Alert */}
        <Card className="border border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Lệnh in cần chú ý</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{stats.attentionJobsCount}</p>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                {stats.attentionJobsCount > 0 ? (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                    Cần xử lý
                  </Badge>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    Hàng đợi ổn định
                  </span>
                )}
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab('DEVICES')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === 'DEVICES'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Printer className="h-4 w-4" />
          <span>Danh sách Máy in ({devices.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('JOBS')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === 'JOBS'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Hàng đợi Lệnh in</span>
        </button>

        {canReprint && (
          <button
            onClick={() => setActiveTab('REPRINT')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === 'REPRINT'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Receipt className="h-4 w-4" />
            <span>In lại Hóa đơn</span>
          </button>
        )}
      </div>

      {/* Tab 1: Devices */}
      {activeTab === 'DEVICES' && (
        <PrintDevicesTab
          canManageDevices={canManageDevices}
          isCreateOpen={isCreateOpen}
          setIsCreateOpen={setIsCreateOpen}
        />
      )}

      {/* Tab 2: Jobs */}
      {activeTab === 'JOBS' && (
        <PrintJobsTab
          canManageJobs={canManageJobs}
          devices={devices}
        />
      )}

      {/* Tab 3: Reprint */}
      {activeTab === 'REPRINT' && canReprint && (
        <ReprintReceiptTab devices={devices} />
      )}
    </div>
  )
}

export default PrintingPage
