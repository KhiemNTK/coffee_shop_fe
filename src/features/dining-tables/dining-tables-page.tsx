import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useOutletContext, Link } from 'react-router-dom'
import {
  LayoutGrid,
  List,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Armchair,
  UtensilsCrossed,
  ArrowRightLeft,
  RotateCcw,
  Clock,
  Users,
  AlertCircle,
  Calendar,
  Coffee,
  CheckCircle2,
} from 'lucide-react'
import {
  getDiningTablesAdmin,
  createDiningTable,
  updateDiningTable,
  deleteDiningTable,
  clearDiningTable,
  transferTable,
  type DiningTableAdmin,
  type TableStatus,
} from './dining-tables.api'
import { errorMessage } from '../../shared/api/client'
import type { Session } from '../auth/session'
import {
  Button,
  Badge,
  Card,
  CardContent,
  Input,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../shared/ui'

function formatSessionDuration(createdAt?: string): string {
  if (!createdAt) return ''
  const createdMs = Date.parse(createdAt)
  if (Number.isNaN(createdMs)) return ''
  const diffMinutes = Math.max(0, Math.floor((Date.now() - createdMs) / 60000))
  if (diffMinutes < 60) return `${diffMinutes} phút`
  const hours = Math.floor(diffMinutes / 60)
  const mins = diffMinutes % 60
  return `${hours}h ${mins}p`
}

export function DiningTablesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { employee, authorization } = useOutletContext<Session>()
  const permissions = authorization.permissionKeys

  const canCreate = permissions.includes('/dining-tables_create')
  const canUpdate = permissions.includes('/dining-tables_update')
  const canDelete = permissions.includes('/dining-tables_delete')
  const canClear = permissions.includes('/orders_tables_clear')
  const canTransfer = permissions.includes('/orders_tables_transfer')
  const canAccessPos = permissions.some((p: string) =>
    ['/dining-tables_read', '/orders_sessions_read', '/orders_sessions_create'].includes(p),
  )

  // Filters & display state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | TableStatus>('ALL')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'status'>('name_asc')

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [keepCreating, setKeepCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [editingTable, setEditingTable] = useState<DiningTableAdmin | null>(null)
  const [editName, setEditName] = useState('')
  const [editError, setEditError] = useState<string | null>(null)

  const [deletingTable, setDeletingTable] = useState<DiningTableAdmin | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [clearingTable, setClearingTable] = useState<DiningTableAdmin | null>(null)
  const [clearError, setClearError] = useState<string | null>(null)

  const [transferringTable, setTransferringTable] = useState<DiningTableAdmin | null>(null)
  const [targetTableId, setTargetTableId] = useState('')
  const [transferError, setTransferError] = useState<string | null>(null)

  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  // Fetch tables
  const {
    data: tables = [],
    isLoading,
    isRefetching,
    refetch,
    error: fetchError,
  } = useQuery({
    queryKey: ['private', 'dining-tables-admin'],
    queryFn: ({ signal }) => getDiningTablesAdmin(signal),
  })

  // Invalidate related caches
  const invalidateTableQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ['private', 'dining-tables-admin'] })
    void queryClient.invalidateQueries({ queryKey: ['private', 'dining-tables'] })
    void queryClient.invalidateQueries({ queryKey: ['private', employee.id, 'dining-tables'] })
    void queryClient.invalidateQueries({ queryKey: ['private', employee.id, 'pos-sessions'] })
  }

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (name: string) => createDiningTable({ name }),
    onSuccess: (newTable) => {
      invalidateTableQueries()
      setActionSuccess(`Đã tạo bàn "${newTable.name}" thành công`)
      if (keepCreating) {
        setCreateName('')
        setCreateError(null)
      } else {
        setIsCreateOpen(false)
        setCreateName('')
        setCreateError(null)
      }
    },
    onError: (err) => {
      setCreateError(errorMessage(err))
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      updateDiningTable(id, { name }),
    onSuccess: (updatedTable) => {
      invalidateTableQueries()
      setActionSuccess(`Đã cập nhật tên bàn thành "${updatedTable.name}"`)
      setEditingTable(null)
      setEditName('')
      setEditError(null)
    },
    onError: (err) => {
      setEditError(errorMessage(err))
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDiningTable(id),
    onSuccess: () => {
      invalidateTableQueries()
      setActionSuccess('Đã xóa bàn thành công')
      setDeletingTable(null)
      setDeleteError(null)
    },
    onError: (err) => {
      setDeleteError(errorMessage(err))
    },
  })

  // Clear table mutation
  const clearMutation = useMutation({
    mutationFn: (id: string) => clearDiningTable(id),
    onSuccess: () => {
      invalidateTableQueries()
      setActionSuccess('Đã dọn bàn và giải phóng trạng thái thành công')
      setClearingTable(null)
      setClearError(null)
    },
    onError: (err) => {
      setClearError(errorMessage(err))
    },
  })

  // Transfer table mutation
  const transferMutation = useMutation({
    mutationFn: ({ fromId, toId }: { fromId: string; toId: string }) =>
      transferTable(fromId, toId),
    onSuccess: () => {
      invalidateTableQueries()
      setActionSuccess('Đã chuyển bàn thành công')
      setTransferringTable(null)
      setTargetTableId('')
      setTransferError(null)
    },
    onError: (err) => {
      setTransferError(errorMessage(err))
    },
  })

  // KPI Metrics
  const stats = useMemo(() => {
    const total = tables.length
    const empty = tables.filter((t) => t.status === 'EMPTY').length
    const occupied = tables.filter((t) => t.status === 'OCCUPIED').length
    const reserved = tables.filter((t) => t.status === 'RESERVED').length
    const emptyPercent = total > 0 ? Math.round((empty / total) * 100) : 0
    return { total, empty, occupied, reserved, emptyPercent }
  }, [tables])

  // Filtered & sorted tables
  const displayedTables = useMemo(() => {
    let result = [...tables]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter((t) => t.name.toLowerCase().includes(q))
    }

    if (statusFilter !== 'ALL') {
      result = result.filter((t) => t.status === statusFilter)
    }

    result.sort((a, b) => {
      if (sortBy === 'name_asc') {
        return a.name.localeCompare(b.name, 'vi', { numeric: true })
      }
      if (sortBy === 'name_desc') {
        return b.name.localeCompare(a.name, 'vi', { numeric: true })
      }
      if (sortBy === 'status') {
        const order: Record<TableStatus, number> = { OCCUPIED: 1, RESERVED: 2, EMPTY: 3 }
        return order[a.status] - order[b.status]
      }
      return 0
    })

    return result
  }, [tables, searchQuery, statusFilter, sortBy])

  // Available empty tables for transfer destination
  const availableTargetTables = useMemo(() => {
    if (!transferringTable) return []
    return tables.filter((t) => t.id !== transferringTable.id && t.status === 'EMPTY')
  }, [tables, transferringTable])

  const handleOpenCreate = () => {
    setCreateName('')
    setCreateError(null)
    setIsCreateOpen(true)
  }

  const handleOpenEdit = (table: DiningTableAdmin) => {
    setEditingTable(table)
    setEditName(table.name)
    setEditError(null)
  }

  const handleOpenDelete = (table: DiningTableAdmin) => {
    setDeletingTable(table)
    setDeleteError(null)
  }

  const handleOpenClear = (table: DiningTableAdmin) => {
    setClearingTable(table)
    setClearError(null)
  }

  const handleOpenTransfer = (table: DiningTableAdmin) => {
    setTransferringTable(table)
    setTargetTableId('')
    setTransferError(null)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Toast Notification */}
      {actionSuccess && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-300"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400">
              <LayoutGrid className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Sơ đồ & Quản lý Bàn ăn
              </h1>
              <p className="text-sm text-muted-foreground">
                Theo dõi tình trạng bàn thời gian thực, quản lý phân bổ và điều phối phục vụ
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isLoading || isRefetching}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </Button>

          {canCreate && (
            <Button
              onClick={handleOpenCreate}
              size="sm"
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm bàn mới</span>
            </Button>
          )}
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {/* Total Tables */}
        <Card className="border border-border/80 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Tổng số bàn
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Armchair className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{stats.total}</span>
              <span className="text-xs text-muted-foreground">bàn trong quán</span>
            </div>
          </CardContent>
        </Card>

        {/* Empty Tables */}
        <Card className="border border-emerald-200/80 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/10 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                Bàn trống
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                <Coffee className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {stats.empty}
              </span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400/80">
                ({stats.emptyPercent}% sẵn sàng)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Occupied Tables */}
        <Card className="border border-amber-200/80 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/10 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                Đang phục vụ
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                <UtensilsCrossed className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                {stats.occupied}
              </span>
              <span className="text-xs text-amber-600 dark:text-amber-400/80">đang có khách</span>
            </div>
          </CardContent>
        </Card>

        {/* Reserved Tables */}
        <Card className="border border-purple-200/80 bg-purple-50/30 dark:border-purple-900/40 dark:bg-purple-950/10 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-purple-800 dark:text-purple-300 uppercase tracking-wider">
                Đã đặt trước
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
                <Calendar className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                {stats.reserved}
              </span>
              <Link
                to="/staff/reservations"
                className="text-xs text-purple-600 hover:underline dark:text-purple-400"
              >
                Xem lịch đặt →
              </Link>
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
                placeholder="Tìm kiếm bàn theo tên (ví dụ: Bàn 01, VIP, Tầng 2...)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filter Tabs & Options */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Segmented Buttons */}
              <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
                {(
                  [
                    { key: 'ALL', label: 'Tất cả' },
                    { key: 'EMPTY', label: 'Trống' },
                    { key: 'OCCUPIED', label: 'Có khách' },
                    { key: 'RESERVED', label: 'Đã đặt' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setStatusFilter(tab.key)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      statusFilter === tab.key
                        ? 'bg-card text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Sort Dropdown */}
              <select
                aria-label="Sắp xếp danh sách bàn"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-8.5 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                <option value="name_asc">Tên (A → Z)</option>
                <option value="name_desc">Tên (Z → A)</option>
                <option value="status">Trạng thái ưu tiên</option>
              </select>

              {/* View Switcher */}
              <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
                <button
                  type="button"
                  aria-label="Chế độ lưới"
                  onClick={() => setViewMode('grid')}
                  className={`rounded-md p-1.5 text-xs transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Chế độ thẻ lưới"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Chế độ bảng"
                  onClick={() => setViewMode('table')}
                  className={`rounded-md p-1.5 text-xs transition-colors ${
                    viewMode === 'table'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Chế độ bảng danh sách"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Đang tải danh sách bàn ăn...</p>
        </div>
      ) : fetchError ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 py-12 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <h3 className="mt-3 text-base font-semibold text-foreground">Không thể tải dữ liệu bàn</h3>
          <p className="mt-1 text-sm text-muted-foreground">{errorMessage(fetchError)}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            className="mt-4 gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Thử lại
          </Button>
        </div>
      ) : displayedTables.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Armchair className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">Không tìm thấy bàn nào</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            {searchQuery || statusFilter !== 'ALL'
              ? 'Thử thay đổi bộ lọc tìm kiếm hoặc từ khóa để xem kết quả khác.'
              : 'Hệ thống chưa có bàn nào. Hãy thêm bàn mới để bắt đầu phục vụ.'}
          </p>
          {canCreate && !searchQuery && statusFilter === 'ALL' && (
            <Button
              onClick={handleOpenCreate}
              size="sm"
              className="mt-4 gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Plus className="h-4 w-4" />
              Thêm bàn đầu tiên
            </Button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {displayedTables.map((table) => {
            const activeSession = table.orderSessions?.[0]
            const orderItemsCount = activeSession?.orderItems?.length ?? 0
            const sessionDuration = formatSessionDuration(activeSession?.createdAt)

            return (
              <div
                key={table.id}
                className={`group relative flex flex-col justify-between rounded-2xl border bg-card p-4 transition-all duration-200 hover:shadow-md ${
                  table.status === 'OCCUPIED'
                    ? 'border-amber-300 dark:border-amber-800/80 shadow-xs'
                    : table.status === 'RESERVED'
                      ? 'border-purple-300 dark:border-purple-800/80'
                      : 'border-border/80 hover:border-emerald-300 dark:hover:border-emerald-800'
                }`}
              >
                {/* Card Top: Name & Status */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold text-sm ${
                          table.status === 'OCCUPIED'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : table.status === 'RESERVED'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        }`}
                      >
                        <Armchair className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-base text-foreground leading-tight">
                          {table.name}
                        </h3>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          ID: {table.id.slice(0, 8)}
                        </span>
                      </div>
                    </div>

                    {/* Status Pill Badge */}
                    <div>
                      {table.status === 'EMPTY' && (
                        <Badge
                          variant="outline"
                          className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-[11px]"
                        >
                          Trống
                        </Badge>
                      )}
                      {table.status === 'OCCUPIED' && (
                        <Badge
                          variant="outline"
                          className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-[11px]"
                        >
                          Có khách
                        </Badge>
                      )}
                      {table.status === 'RESERVED' && (
                        <Badge
                          variant="outline"
                          className="border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 text-[11px]"
                        >
                          Đặt trước
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Card Middle: Active Session Details if OCCUPIED */}
                  <div className="mt-3.5 space-y-2 border-t border-border/50 pt-3 text-xs">
                    {table.status === 'OCCUPIED' && (
                      <div className="space-y-1.5 rounded-xl bg-amber-50/50 p-2.5 dark:bg-amber-950/20">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                            Đã ngồi:
                          </span>
                          <span className="font-medium text-foreground">
                            {sessionDuration || 'Vừa vào'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                            Số khách:
                          </span>
                          <span className="font-medium text-foreground">
                            {activeSession?.guestCount ? `${activeSession.guestCount} người` : '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <UtensilsCrossed className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                            Số món:
                          </span>
                          <span className="font-semibold text-amber-700 dark:text-amber-400">
                            {orderItemsCount} món
                          </span>
                        </div>
                      </div>
                    )}

                    {table.status === 'EMPTY' && (
                      <div className="flex items-center gap-1.5 py-2 text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Sẵn sàng đón tiếp khách mới</span>
                      </div>
                    )}

                    {table.status === 'RESERVED' && (
                      <div className="flex items-center gap-1.5 py-2 text-purple-700 dark:text-purple-300">
                        <Calendar className="h-4 w-4" />
                        <span>Đã được giữ chỗ theo lịch</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Bottom Actions */}
                <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-3">
                  {/* Primary Workflow Button */}
                  {table.status === 'OCCUPIED' && activeSession && canAccessPos && (
                    <Button
                      size="sm"
                      onClick={() => navigate(`/staff/pos/sessions/${activeSession.id}`)}
                      className="w-full gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs h-8"
                    >
                      <UtensilsCrossed className="h-3.5 w-3.5" />
                      Vào đơn POS
                    </Button>
                  )}

                  {table.status === 'EMPTY' && canAccessPos && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('/staff/pos')}
                      className="w-full gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-300 dark:border-emerald-800 text-xs h-8"
                    >
                      <Coffee className="h-3.5 w-3.5" />
                      Mở bàn tại POS
                    </Button>
                  )}

                  {table.status === 'RESERVED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('/staff/reservations')}
                      className="w-full gap-1.5 text-purple-700 border-purple-300 hover:bg-purple-50 dark:text-purple-300 dark:border-purple-800 text-xs h-8"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      Xem lịch đặt bàn
                    </Button>
                  )}

                  {/* Secondary Table Management Actions */}
                  <div className="flex items-center justify-between gap-1 pt-1">
                    <div className="flex items-center gap-1">
                      {/* Edit Name */}
                      {canUpdate && (
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(table)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="Đổi tên bàn"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {/* Transfer Table (if occupied) */}
                      {table.status === 'OCCUPIED' && canTransfer && (
                        <button
                          type="button"
                          onClick={() => handleOpenTransfer(table)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-amber-100 hover:text-amber-800 dark:hover:bg-amber-950 transition-colors"
                          title="Chuyển bàn sang bàn khác"
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {/* Clear Table (if occupied or reserved) */}
                      {table.status !== 'EMPTY' && canClear && (
                        <button
                          type="button"
                          onClick={() => handleOpenClear(table)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          title="Dọn / Giải phóng bàn"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Delete Table (Backend only permits deleting EMPTY tables) */}
                    {canDelete && table.status === 'EMPTY' && (
                      <button
                        type="button"
                        onClick={() => handleOpenDelete(table)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="Xóa bàn"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* TABLE LIST VIEW */
        <Card className="border border-border/80 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Tên bàn</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Phiên phục vụ</th>
                  <th className="px-4 py-3">Thời lượng</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayedTables.map((table) => {
                  const activeSession = table.orderSessions?.[0]
                  const duration = formatSessionDuration(activeSession?.createdAt)

                  return (
                    <tr key={table.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <Armchair className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="font-semibold text-foreground">{table.name}</span>
                            <div className="text-[11px] font-mono text-muted-foreground">
                              {table.id.slice(0, 8)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {table.status === 'EMPTY' && (
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                          >
                            Trống
                          </Badge>
                        )}
                        {table.status === 'OCCUPIED' && (
                          <Badge
                            variant="outline"
                            className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                          >
                            Có khách
                          </Badge>
                        )}
                        {table.status === 'RESERVED' && (
                          <Badge
                            variant="outline"
                            className="border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                          >
                            Đặt trước
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {activeSession ? (
                          <div className="space-y-0.5">
                            <span className="font-mono text-xs font-medium text-foreground">
                              #{activeSession.id.slice(0, 8)}
                            </span>
                            <div className="text-xs text-muted-foreground">
                              {activeSession.guestCount ? `${activeSession.guestCount} khách • ` : ''}
                              {activeSession.orderItems?.length || 0} món
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {duration || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {table.status === 'OCCUPIED' && activeSession && canAccessPos && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/staff/pos/sessions/${activeSession.id}`)}
                              className="h-7 px-2.5 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                            >
                              Vào POS
                            </Button>
                          )}
                          {table.status === 'EMPTY' && canAccessPos && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate('/staff/pos')}
                              className="h-7 px-2.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                            >
                              Mở POS
                            </Button>
                          )}
                          {canUpdate && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(table)}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                              title="Sửa tên bàn"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                          {table.status === 'OCCUPIED' && canTransfer && (
                            <button
                              type="button"
                              onClick={() => handleOpenTransfer(table)}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-amber-100 hover:text-amber-800"
                              title="Chuyển bàn"
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                            </button>
                          )}
                          {table.status !== 'EMPTY' && canClear && (
                            <button
                              type="button"
                              onClick={() => handleOpenClear(table)}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              title="Dọn / Giải phóng bàn"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && table.status === 'EMPTY' && (
                            <button
                              type="button"
                              onClick={() => handleOpenDelete(table)}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              title="Xóa bàn"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* CREATE MODAL */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground">
                Thêm bàn ăn mới
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Đặt tên định danh cho bàn ăn (ví dụ: Bàn 01, VIP 02, Sân vườn 3)
              </DialogDescription>
            </DialogHeader>

            {createError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{createError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!createName.trim()) {
                  setCreateError('Vui lòng nhập tên bàn')
                  return
                }
                createMutation.mutate(createName.trim())
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="text-xs font-medium text-foreground">
                  Tên bàn <span className="text-destructive">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="Nhập tên bàn (tối đa 50 ký tự)..."
                  value={createName}
                  onChange={(e) => {
                    setCreateName(e.target.value)
                    setCreateError(null)
                  }}
                  autoFocus
                  maxLength={50}
                  className="mt-1"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="keepCreating"
                  type="checkbox"
                  checked={keepCreating}
                  onChange={(e) => setKeepCreating(e.target.checked)}
                  className="rounded border-border text-amber-600 focus:ring-amber-500"
                />
                <label htmlFor="keepCreating" className="text-xs text-muted-foreground cursor-pointer">
                  Tiếp tục tạo thêm bàn khác sau khi lưu
                </label>
              </div>

              <DialogFooter className="mt-6 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={createMutation.isPending}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={createMutation.isPending || !createName.trim()}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {createMutation.isPending ? 'Đang tạo...' : 'Lưu bàn mới'}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </div>
      </Dialog>

      {/* EDIT MODAL */}
      <Dialog open={!!editingTable} onOpenChange={(open) => !open && setEditingTable(null)}>
        {editingTable && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Đổi tên bàn ăn
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Cập nhật tên định danh cho bàn ({editingTable.name})
                </DialogDescription>
              </DialogHeader>

              {editError && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!editName.trim()) {
                    setEditError('Vui lòng nhập tên bàn')
                    return
                  }
                  updateMutation.mutate({ id: editingTable.id, name: editName.trim() })
                }}
                className="mt-4 space-y-4"
              >
                <div>
                  <label className="text-xs font-medium text-foreground">
                    Tên bàn mới <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="text"
                    value={editName}
                    onChange={(e) => {
                      setEditName(e.target.value)
                      setEditError(null)
                    }}
                    autoFocus
                    maxLength={50}
                    className="mt-1"
                  />
                </div>

                <DialogFooter className="mt-6 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingTable(null)}
                    disabled={updateMutation.isPending}
                  >
                    Hủy
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={updateMutation.isPending || !editName.trim()}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {updateMutation.isPending ? 'Đang lưu...' : 'Cập nhật'}
                  </Button>
                </DialogFooter>
              </form>
            </div>
          </div>
        )}
      </Dialog>

      {/* DELETE CONFIRM MODAL */}
      <Dialog open={!!deletingTable} onOpenChange={(open) => !open && setDeletingTable(null)}>
        {deletingTable && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
              <DialogHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive mb-2">
                  <Trash2 className="h-5 w-5" />
                </div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Xác nhận xóa bàn
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Bạn có chắc chắn muốn xóa bàn{' '}
                  <span className="font-semibold text-foreground">{deletingTable.name}</span>? Thao tác
                  này sẽ ẩn bàn khỏi sơ đồ phục vụ.
                </DialogDescription>
              </DialogHeader>

              {deleteError && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{deleteError}</span>
                </div>
              )}

              <DialogFooter className="mt-6 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDeletingTable(null)}
                  disabled={deleteMutation.isPending}
                >
                  Hủy
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => deleteMutation.mutate(deletingTable.id)}
                  disabled={deleteMutation.isPending}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                  {deleteMutation.isPending ? 'Đang xóa...' : 'Xác nhận xóa'}
                </Button>
              </DialogFooter>
            </div>
          </div>
        )}
      </Dialog>

      {/* CLEAR CONFIRM MODAL */}
      <Dialog open={!!clearingTable} onOpenChange={(open) => !open && setClearingTable(null)}>
        {clearingTable && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
              <DialogHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 mb-2">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Dọn dẹp & Giải phóng bàn
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Xác nhận giải phóng bàn{' '}
                  <span className="font-semibold text-foreground">{clearingTable.name}</span> về trạng
                  thái <span className="font-semibold text-emerald-600">Trống</span>. Nếu có món chưa
                  nấu hoặc chưa thanh toán, hệ thống sẽ tự động hủy phiên an toàn.
                </DialogDescription>
              </DialogHeader>

              {clearError && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{clearError}</span>
                </div>
              )}

              <DialogFooter className="mt-6 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setClearingTable(null)}
                  disabled={clearMutation.isPending}
                >
                  Hủy
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => clearMutation.mutate(clearingTable.id)}
                  disabled={clearMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {clearMutation.isPending ? 'Đang xử lý...' : 'Xác nhận dọn bàn'}
                </Button>
              </DialogFooter>
            </div>
          </div>
        )}
      </Dialog>

      {/* TRANSFER MODAL */}
      <Dialog
        open={!!transferringTable}
        onOpenChange={(open) => !open && setTransferringTable(null)}
      >
        {transferringTable && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
              <DialogHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 mb-2">
                  <ArrowRightLeft className="h-5 w-5" />
                </div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Chuyển bàn phục vụ
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Chuyển toàn bộ phiên order từ{' '}
                  <span className="font-semibold text-foreground">{transferringTable.name}</span> sang
                  bàn trống khác.
                </DialogDescription>
              </DialogHeader>

              {transferError && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{transferError}</span>
                </div>
              )}

              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-medium text-foreground">
                    Chọn bàn đích (chỉ các bàn đang trống) <span className="text-destructive">*</span>
                  </label>
                  {availableTargetTables.length === 0 ? (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      Hiện tại không có bàn trống nào để chuyển đến.
                    </p>
                  ) : (
                    <select
                      aria-label="Chọn bàn đích"
                      value={targetTableId}
                      onChange={(e) => setTargetTableId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-card p-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
                    >
                      <option value="">-- Chọn bàn trống --</option>
                      {availableTargetTables.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <DialogFooter className="mt-6 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTransferringTable(null)}
                    disabled={transferMutation.isPending}
                  >
                    Hủy
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      if (!targetTableId) {
                        setTransferError('Vui lòng chọn bàn đích')
                        return
                      }
                      transferMutation.mutate({
                        fromId: transferringTable.id,
                        toId: targetTableId,
                      })
                    }}
                    disabled={transferMutation.isPending || !targetTableId}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {transferMutation.isPending ? 'Đang chuyển...' : 'Xác nhận chuyển'}
                  </Button>
                </DialogFooter>
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
