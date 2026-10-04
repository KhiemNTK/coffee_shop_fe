import { useState, useMemo, useDeferredValue } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ScrollText,
  Search,
  RefreshCw,
  Eye,
  Copy,
  Check,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  FileCode,
  ArrowUpDown,
  Filter,
} from 'lucide-react'
import {
  auditLogsApi,
  type AuditLogItem,
} from '@/features/audit-logs/audit-logs.api'
import { formatDateTime } from '@/shared/lib/format'
import {
  Card,
  CardContent,
  Badge,
  Button,
  Input,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui'

const EMPTY_LOGS: AuditLogItem[] = []

const PRESET_ACTION_TYPES = [
  { value: 'ALL', label: 'Tất cả loại hành động' },
  { value: 'PROMOTION', label: 'Khuyến mãi (PROMOTION_*)' },
  { value: 'SYSTEM_SETTING', label: 'Cấu hình tham số (SYSTEM_SETTING_*)' },
  { value: 'ORDER', label: 'Đơn hàng & Món (ORDER_*)' },
  { value: 'PAYMENT', label: 'Thanh toán & Đối soát (PAYMENT_*)' },
  { value: 'EQUIPMENT', label: 'Thiết bị & Tài sản (EQUIPMENT_*)' },
  { value: 'EMPLOYEE', label: 'Nhân sự & Phân quyền (EMPLOYEE_*)' },
  { value: 'DAILY_SALES', label: 'Chốt ca & Khóa sổ (DAILY_SALES_*)' },
] as const

function calculateDateRange(filter: 'ALL' | 'TODAY' | '7DAYS' | '30DAYS'): {
  fromDate?: string
  toDate?: string
} {
  if (filter === 'ALL') return {}
  const now = new Date()
  const to = now.toISOString()
  const from = new Date()
  if (filter === 'TODAY') {
    from.setHours(0, 0, 0, 0)
  } else if (filter === '7DAYS') {
    from.setDate(now.getDate() - 7)
  } else if (filter === '30DAYS') {
    from.setDate(now.getDate() - 30)
  }
  return { fromDate: from.toISOString(), toDate: to }
}

function getActionBadgeVariant(actionType: string): {
  variant: 'default' | 'secondary' | 'outline' | 'destructive'
  customClass?: string
} {
  const upper = actionType.toUpperCase()
  if (upper.startsWith('PROMOTION')) {
    return {
      variant: 'secondary',
      customClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300',
    }
  }
  if (upper.startsWith('SYSTEM_SETTING')) {
    return {
      variant: 'secondary',
      customClass: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300',
    }
  }
  if (upper.startsWith('ORDER')) {
    return {
      variant: 'secondary',
      customClass: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300',
    }
  }
  if (upper.startsWith('PAYMENT') || upper.startsWith('CASH')) {
    return {
      variant: 'secondary',
      customClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300',
    }
  }
  if (upper.startsWith('EQUIPMENT')) {
    return {
      variant: 'secondary',
      customClass: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300',
    }
  }
  if (upper.startsWith('EMPLOYEE') || upper.startsWith('ROLE') || upper.startsWith('PERMISSION')) {
    return {
      variant: 'secondary',
      customClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300',
    }
  }
  return { variant: 'outline' }
}

export function AuditLogsPage() {
  // State for filters
  const [keyword, setKeyword] = useState('')
  const deferredKeyword = useDeferredValue(keyword)

  const [categoryPreset, setCategoryPreset] = useState<string>('ALL')
  const [dateRangeFilter, setDateRangeFilter] = useState<'ALL' | 'TODAY' | '7DAYS' | '30DAYS'>('ALL')
  const [dateBounds, setDateBounds] = useState<{ fromDate?: string; toDate?: string }>({})
  const [currentPage, setCurrentPage] = useState(1)

  // State for log detail dialog
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Map categoryPreset to actual actionType prefix or exact filter
  const actionTypeQuery = useMemo(() => {
    if (deferredKeyword.trim()) {
      return deferredKeyword.trim()
    }
    if (categoryPreset !== 'ALL') {
      return categoryPreset
    }
    return undefined
  }, [deferredKeyword, categoryPreset])

  // Main Query
  const {
    data: logsData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['audit-logs-list', currentPage, actionTypeQuery, dateBounds.fromDate, dateBounds.toDate],
    queryFn: ({ signal }) =>
      auditLogsApi.getAuditLogs(
        {
          page: currentPage,
          itemPerPage: 20,
          actionType: actionTypeQuery,
          from: dateBounds.fromDate,
          to: dateBounds.toDate,
        },
        signal,
      ),
  })

  const logs = logsData?.list ?? EMPTY_LOGS
  const totalItems = logsData?.totalItems ?? 0
  const totalPages = logsData?.totalPages ?? 1

  // Metric summaries calculated directly without impure useMemo
  let securityCount = 0
  let operationsCount = 0
  for (const log of logs) {
    const u = log.actionType.toUpperCase()
    if (u.includes('EMPLOYEE') || u.includes('ROLE') || u.includes('PERMISSION') || u.includes('SYSTEM_SETTING')) {
      securityCount++
    }
    if (u.includes('ORDER') || u.includes('PAYMENT') || u.includes('EQUIPMENT') || u.includes('PROMOTION')) {
      operationsCount++
    }
  }

  const handleDateFilterSelect = (filter: 'ALL' | 'TODAY' | '7DAYS' | '30DAYS') => {
    setDateRangeFilter(filter)
    setDateBounds(calculateDateRange(filter))
    setCurrentPage(1)
  }

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedId(id)
    setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev))
    }, 2000)
  }

  const handleResetFilters = () => {
    setKeyword('')
    setCategoryPreset('ALL')
    setDateRangeFilter('ALL')
    setDateBounds({})
    setCurrentPage(1)
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-2xs">
              <ScrollText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Nhật ký Kiểm toán & Truy vết
                </h1>
                <Badge variant="outline" className="border-primary/30 text-primary text-[11px] font-medium">
                  Security Audit
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ghi nhận và truy vết toàn diện mọi hành động thay đổi dữ liệu, cấu hình và bảo mật
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="gap-1.5 h-9"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Card className="border border-border/70 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Tổng lượt ghi nhận</span>
              <ScrollText className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">{totalItems}</span>
              <span className="text-[11px] text-muted-foreground">sự kiện</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Trong trang hiện tại</span>
              <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">{logs.length}</span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                Trang {currentPage} / {totalPages}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Bảo mật & Cấu hình</span>
              <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">{securityCount}</span>
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">sự kiện</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Nghiệp vụ vận hành</span>
              <ArrowUpDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">{operationsCount}</span>
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">hành động</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Control Bar */}
      <Card className="border border-border/70 shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Tìm theo loại hành động (VD: PROMOTION_CREATED, SYSTEM_SETTING...) hoặc requestId..."
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-9"
              />
            </div>

            {/* Filter Tabs & Options */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Category Preset Selector */}
              <select
                aria-label="Lọc nhóm hành động"
                value={categoryPreset}
                onChange={(e) => {
                  setCategoryPreset(e.target.value)
                  setCurrentPage(1)
                }}
                className="h-8.5 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                {PRESET_ACTION_TYPES.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>

              {/* Date Range Selector */}
              <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
                {(
                  [
                    { key: 'ALL', label: 'Tất cả' },
                    { key: 'TODAY', label: 'Hôm nay' },
                    { key: '7DAYS', label: '7 ngày qua' },
                    { key: '30DAYS', label: '30 ngày' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => handleDateFilterSelect(tab.key)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      dateRangeFilter === tab.key
                        ? 'bg-card text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Đang tải nhật ký kiểm toán...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Filter className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-3 text-base font-bold text-foreground">Không tìm thấy nhật ký kiểm toán nào</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {keyword || categoryPreset !== 'ALL' || dateRangeFilter !== 'ALL'
              ? 'Không có sự kiện nào khớp với tiêu chí tìm kiếm hiện tại.'
              : 'Chưa có hoạt động kiểm toán nào được ghi nhận trong cơ sở dữ liệu.'}
          </p>
          {(keyword || categoryPreset !== 'ALL' || dateRangeFilter !== 'ALL') && (
            <Button variant="outline" size="sm" onClick={handleResetFilters} className="mt-4 gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Đặt lại bộ lọc
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3">Thời điểm</th>
                  <th scope="col" className="px-4 py-3">Người thực hiện</th>
                  <th scope="col" className="px-4 py-3">Loại hành động</th>
                  <th scope="col" className="px-4 py-3">Mã Request ID</th>
                  <th scope="col" className="px-4 py-3 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {logs.map((log) => {
                  const badgeStyle = getActionBadgeVariant(log.actionType)
                  return (
                    <tr key={log.id} className="transition-colors hover:bg-muted/20">
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>{formatDateTime(log.createdAt)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs">
                          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-semibold text-foreground">
                            {log.employee?.fullName || 'Hệ thống'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={badgeStyle.variant}
                          className={`text-[11px] font-mono font-semibold ${badgeStyle.customClass || ''}`}
                        >
                          {log.actionType}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {log.requestId ? (
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs text-muted-foreground max-w-[120px] truncate sm:max-w-[200px]">
                              {log.requestId}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(log.requestId!, log.id)}
                              title="Sao chép Request ID"
                              className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                            >
                              {copiedId === log.id ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                          className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                          title="Xem chi tiết payload"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Chi tiết</span>
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-1">
              <p className="text-xs text-muted-foreground">
                Hiển thị trang <span className="font-bold text-foreground">{currentPage}</span> / {totalPages} (Tổng cộng {totalItems} lượt ghi)
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || isFetching}
                  className="h-8 px-3 text-xs"
                >
                  Trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages || isFetching}
                  className="h-8 px-3 text-xs"
                >
                  Tiếp
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Log Detail Modal */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        {selectedLog && (
          <div className="max-w-2xl">
            <DialogHeader>
              <div className="flex items-center justify-between pr-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileCode className="h-4 w-4" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold text-foreground">
                      Chi tiết Nhật ký Kiểm toán
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      ID: {selectedLog.id}
                    </DialogDescription>
                  </div>
                </div>
                <Badge
                  variant={getActionBadgeVariant(selectedLog.actionType).variant}
                  className={`font-mono text-xs ${getActionBadgeVariant(selectedLog.actionType).customClass || ''}`}
                >
                  {selectedLog.actionType}
                </Badge>
              </div>
            </DialogHeader>

            <div className="mt-4 space-y-4 text-xs">
              {/* Metadata Grid */}
              <div className="grid grid-cols-1 gap-2.5 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Thời điểm ghi nhận</span>
                  <span className="font-semibold text-foreground">{formatDateTime(selectedLog.createdAt)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Người thực hiện</span>
                  <span className="font-semibold text-foreground">
                    {selectedLog.employee?.fullName || 'Hệ thống'}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground block text-[11px]">Mã Request ID</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono text-foreground">{selectedLog.requestId || '—'}</span>
                    {selectedLog.requestId && (
                      <button
                        type="button"
                        onClick={() => handleCopyText(selectedLog.requestId!, 'modal-req')}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {copiedId === 'modal-req' ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* JSON Payload Viewer */}
              <div>
                <div className="flex items-center justify-between pb-1.5">
                  <span className="font-semibold text-foreground">Dữ liệu chi tiết (Payload Details):</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleCopyText(
                        JSON.stringify(selectedLog.details ?? {}, null, 2),
                        'modal-payload',
                      )
                    }
                    className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                  >
                    {copiedId === 'modal-payload' ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" />
                        <span>Đã sao chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Sao chép JSON</span>
                      </>
                    )}
                  </Button>
                </div>
                <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-muted/60 p-3 font-mono text-[11px] leading-relaxed text-foreground shadow-inner">
                  {selectedLog.details !== undefined && selectedLog.details !== null
                    ? JSON.stringify(selectedLog.details, null, 2)
                    : '// Không có dữ liệu payload đi kèm'}
                </pre>
              </div>
            </div>

            <DialogFooter className="mt-5">
              <Button variant="outline" onClick={() => setSelectedLog(null)} className="h-9">
                Đóng
              </Button>
            </DialogFooter>
          </div>
        )}
      </Dialog>
    </div>
  )
}
