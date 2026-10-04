import { useState, useMemo, useDeferredValue } from 'react'
import { posKeys } from '../pos/pos.keys'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import {
  LayoutGrid,
  List,
  Plus,
  Search,
  RefreshCw,
  Armchair,
  AlertCircle,
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
import { Button, Card, CardContent, Input } from '../../shared/ui'
import { DiningTableKpis } from './components/dining-table-kpis'
import { DiningTablesGrid } from './components/dining-tables-grid'
import { DiningTablesTable } from './components/dining-tables-table'
import {
  CreateTableModal,
  EditTableModal,
  DeleteTableModal,
  ClearTableModal,
  TransferTableModal,
} from './components/dining-table-modals'

export function DiningTablesPage() {
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
  const deferredSearchQuery = useDeferredValue(searchQuery)
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
    void queryClient.invalidateQueries({ queryKey: posKeys.tables(employee.id) })
    void queryClient.invalidateQueries({ queryKey: posKeys.sessions(employee.id) })
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

    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase().trim()
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
  }, [tables, deferredSearchQuery, statusFilter, sortBy])

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
      <DiningTableKpis stats={stats} />

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
        <DiningTablesGrid
          tables={displayedTables}
          canAccessPos={canAccessPos}
          canUpdate={canUpdate}
          canTransfer={canTransfer}
          canClear={canClear}
          canDelete={canDelete}
          onEdit={handleOpenEdit}
          onTransfer={handleOpenTransfer}
          onClear={handleOpenClear}
          onDelete={handleOpenDelete}
        />
      ) : (
        <DiningTablesTable
          tables={displayedTables}
          canAccessPos={canAccessPos}
          canUpdate={canUpdate}
          canTransfer={canTransfer}
          canClear={canClear}
          canDelete={canDelete}
          onEdit={handleOpenEdit}
          onTransfer={handleOpenTransfer}
          onClear={handleOpenClear}
          onDelete={handleOpenDelete}
        />
      )}

      {/* DIALOGS */}
      <CreateTableModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        createMutation={createMutation}
        createError={createError}
        setCreateError={setCreateError}
        keepCreating={keepCreating}
        setKeepCreating={setKeepCreating}
        createName={createName}
        setCreateName={setCreateName}
      />

      <EditTableModal
        table={editingTable}
        onClose={() => setEditingTable(null)}
        updateMutation={updateMutation}
        editError={editError}
        setEditError={setEditError}
        editName={editName}
        setEditName={setEditName}
      />

      <DeleteTableModal
        table={deletingTable}
        onClose={() => setDeletingTable(null)}
        deleteMutation={deleteMutation}
        deleteError={deleteError}
      />

      <ClearTableModal
        table={clearingTable}
        onClose={() => setClearingTable(null)}
        clearMutation={clearMutation}
        clearError={clearError}
      />

      <TransferTableModal
        table={transferringTable}
        onClose={() => setTransferringTable(null)}
        transferMutation={transferMutation}
        transferError={transferError}
        setTransferError={setTransferError}
        availableTargetTables={availableTargetTables}
      />
    </div>
  )
}
