import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  Boxes,
  CheckCircle2,
  Edit2,
  FileText,
  History,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import {
  getInventoryItems,
  getReorderAlerts,
  getInventoryCategories,
  getInventoryUnits,
  getInventoryTransactions,
  importInventory,
  exportInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  type InventoryItem,
  type ReorderAlertRow,
} from './inventory.api'
import { formatPrice } from '../menu/menu.api'
import { errorMessage } from '../../shared/api/client'
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  Input,
  cn,
} from '../../shared/ui'

export default function InventoryPage() {
  const queryClient = useQueryClient()

  // Tab: 'items' | 'alerts' | 'transactions'
  const [activeTab, setActiveTab] = useState<'items' | 'alerts' | 'transactions'>('items')

  // Search & Filter state
  const [keyword, setKeyword] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [page, setPage] = useState(1)

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [importItem, setImportItem] = useState<InventoryItem | ReorderAlertRow | null>(null)
  const [exportItem, setExportItem] = useState<InventoryItem | null>(null)
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null)

  // Queries
  const categoriesQuery = useQuery({
    queryKey: ['inventory-categories'],
    queryFn: ({ signal }) => getInventoryCategories(signal),
  })

  const unitsQuery = useQuery({
    queryKey: ['inventory-units'],
    queryFn: ({ signal }) => getInventoryUnits(signal),
  })

  const itemsQuery = useQuery({
    queryKey: ['inventory-items', { page, keyword, categoryId: selectedCategoryId, unitId: selectedUnitId, lowStockOnly }],
    queryFn: ({ signal }) =>
      getInventoryItems(
        {
          page,
          itemPerPage: 15,
          keyword: keyword.trim() || undefined,
          categoryId: selectedCategoryId || undefined,
          unitId: selectedUnitId || undefined,
          lowStockOnly,
        },
        signal,
      ),
  })

  const alertsQuery = useQuery({
    queryKey: ['inventory-reorder-alerts'],
    queryFn: ({ signal }) => getReorderAlerts({}, signal),
  })

  const transactionsQuery = useQuery({
    queryKey: ['inventory-transactions'],
    queryFn: ({ signal }) => getInventoryTransactions({ itemPerPage: 20 }, signal),
    enabled: activeTab === 'transactions',
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInventoryItem(id),
    onSuccess: () => {
      setDeleteItem(null)
      void queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory-reorder-alerts'] })
    },
  })

  const alertCount = alertsQuery.data?.totalItems ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand-800 text-white flex items-center justify-center shadow-xs">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Quản lý Kho & Nguyên vật liệu
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Theo dõi tồn kho, định mức an toàn, nhập xuất nguyên liệu pha chế và cảnh báo thiếu hàng
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void itemsQuery.refetch()
              void alertsQuery.refetch()
              if (activeTab === 'transactions') void transactionsQuery.refetch()
            }}
            disabled={itemsQuery.isFetching}
            className="gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', itemsQuery.isFetching && 'animate-spin')} />
            Làm mới
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="gap-1.5 font-semibold text-xs"
          >
            <Plus className="h-4 w-4" />
            Thêm nguyên liệu
          </Button>
        </div>
      </div>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/80 shadow-xs">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Mặt hàng đang quản lý
              </p>
              <h3 className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                {itemsQuery.data?.totalItems ?? 0}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center">
              <PackageCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className={cn('border-border/80 shadow-xs transition-all', alertCount > 0 && 'border-amber-300 bg-amber-50/30')}>
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Cần nhập hàng (Sắp hết)
              </p>
              <h3 className={cn('text-xl sm:text-2xl font-bold mt-1', alertCount > 0 ? 'text-amber-800' : 'text-emerald-700')}>
                {alertCount} mặt hàng
              </h3>
            </div>
            <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', alertCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700')}>
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-xs">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Danh mục kho
              </p>
              <h3 className="text-xl sm:text-2xl font-bold text-brand-900 mt-1">
                {categoriesQuery.data?.length ?? 0} nhóm
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Control */}
      <div className="flex border-b border-border gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('items')}
          className={cn(
            'px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2',
            activeTab === 'items'
              ? 'border-brand-800 text-brand-900'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <Boxes className="h-4 w-4" />
          Kho hàng & Tồn kho
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('alerts')}
          className={cn(
            'px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2',
            activeTab === 'alerts'
              ? 'border-brand-800 text-brand-900'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Cảnh báo cần nhập hàng
          {alertCount > 0 && (
            <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
              {alertCount}
            </Badge>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('transactions')}
          className={cn(
            'px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2',
            activeTab === 'transactions'
              ? 'border-brand-800 text-brand-900'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <History className="h-4 w-4" />
          Lịch sử Xuất / Nhập
        </button>
      </div>

      {/* TAB 1: ITEMS INVENTORY */}
      {activeTab === 'items' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <Card className="border-border/80 shadow-xs">
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground pointer-events-none" />
                  <Input
                    type="search"
                    placeholder="Tìm tên nguyên liệu…"
                    value={keyword}
                    onChange={(e) => {
                      setKeyword(e.target.value)
                      setPage(1)
                    }}
                    className="pl-9"
                  />
                </div>

                <div>
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => {
                      setSelectedCategoryId(e.target.value)
                      setPage(1)
                    }}
                    className="w-full text-xs p-2.5 rounded-lg border border-border bg-white"
                  >
                    <option value="">Tất cả danh mục kho</option>
                    {categoriesQuery.data?.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <select
                    value={selectedUnitId}
                    onChange={(e) => {
                      setSelectedUnitId(e.target.value)
                      setPage(1)
                    }}
                    className="w-full text-xs p-2.5 rounded-lg border border-border bg-white"
                  >
                    <option value="">Tất cả đơn vị tính</option>
                    {unitsQuery.data?.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={lowStockOnly}
                      onChange={(e) => {
                        setLowStockOnly(e.target.checked)
                        setPage(1)
                      }}
                      className="rounded border-stone-300 text-brand-700 h-4 w-4"
                    />
                    <span>Chỉ hiển thị hàng sắp hết</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card className="border-border/80 shadow-xs overflow-hidden">
            {itemsQuery.isLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                <RefreshCw className="h-6 w-6 animate-spin text-brand-700" />
                <p className="text-sm">Đang tải danh sách tồn kho…</p>
              </div>
            )}

            {itemsQuery.isError && (
              <div className="p-4 bg-destructive/10 text-destructive flex items-center justify-between m-4 rounded-xl">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage(itemsQuery.error)}</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => void itemsQuery.refetch()}>
                  Thử lại
                </Button>
              </div>
            )}

            {itemsQuery.data && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-stone-50 border-b border-border text-xs uppercase text-muted-foreground font-semibold">
                    <tr>
                      <th className="py-3.5 px-4 sm:px-6">Tên nguyên liệu</th>
                      <th className="py-3.5 px-4">Nhóm kho</th>
                      <th className="py-3.5 px-4">Đơn vị</th>
                      <th className="py-3.5 px-4 text-right">Tồn kho hiện tại</th>
                      <th className="py-3.5 px-4 text-right">Ngưỡng tối thiểu</th>
                      <th className="py-3.5 px-4 text-right">Giá vốn BQ</th>
                      <th className="py-3.5 px-4 sm:px-6 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {itemsQuery.data.list.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-muted-foreground">
                          Không tìm thấy nguyên vật liệu nào.
                        </td>
                      </tr>
                    ) : (
                      itemsQuery.data.list.map((item) => {
                        const stockNum = Number(item.stock)
                        const reorderNum = Number(item.reorderPoint || 0)
                        const isLow = reorderNum > 0 && stockNum <= reorderNum

                        return (
                          <tr key={item.id} className="hover:bg-stone-50/70 transition-colors">
                            <td className="py-3.5 px-4 sm:px-6">
                              <span className="font-semibold text-foreground block">
                                {item.name}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <Badge variant="outline" className="text-xs">
                                {item.category?.name ?? 'Chung'}
                              </Badge>
                            </td>
                            <td className="py-3.5 px-4 text-xs text-muted-foreground">
                              {item.unit?.name ?? 'Đơn vị'}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <span
                                className={cn(
                                  'font-bold text-sm',
                                  isLow ? 'text-amber-800 bg-amber-50 px-2 py-0.5 rounded' : 'text-foreground',
                                )}
                              >
                                {Number(item.stock).toLocaleString('vi-VN')} {item.unit?.name}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right text-xs text-muted-foreground">
                              {item.reorderPoint ? Number(item.reorderPoint).toLocaleString('vi-VN') : '—'}
                            </td>
                            <td className="py-3.5 px-4 text-right text-xs font-semibold text-brand-800">
                              {item.averageUnitCost ? formatPrice(String(item.averageUnitCost)) : '—'}
                            </td>
                            <td className="py-3.5 px-4 sm:px-6">
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setImportItem(item)}
                                  className="h-7 text-xs text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 gap-1 border-emerald-200"
                                  title="Nhập thêm hàng"
                                >
                                  <ArrowDownToLine className="h-3.5 w-3.5" /> Nhập
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setExportItem(item)}
                                  className="h-7 text-xs text-amber-700 hover:bg-amber-50 hover:text-amber-800 gap-1 border-amber-200"
                                  title="Xuất kho / Hao hụt"
                                >
                                  <ArrowUpFromLine className="h-3.5 w-3.5" /> Xuất
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditItem(item)}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                  title="Chỉnh sửa"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteItem(item)}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  title="Xóa"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {itemsQuery.data && itemsQuery.data.totalPages > 1 && (
              <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Trang {itemsQuery.data.currentPage} / {itemsQuery.data.totalPages} (Tổng{' '}
                  {itemsQuery.data.totalItems} mặt hàng)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || itemsQuery.isFetching}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-8 gap-1"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Trước
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= itemsQuery.data.totalPages || itemsQuery.isFetching}
                    onClick={() => setPage((p) => p + 1)}
                    className="h-8 gap-1"
                  >
                    Sau
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 2: REORDER ALERTS */}
      {activeTab === 'alerts' && (
        <Card className="border-border/80 shadow-xs overflow-hidden">
          <CardContent className="p-0">
            {alertsQuery.isLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                <RefreshCw className="h-6 w-6 animate-spin text-brand-700" />
                <p className="text-sm">Đang kiểm tra cảnh báo tồn kho…</p>
              </div>
            )}

            {alertsQuery.data && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-amber-50/50 border-b border-amber-200 text-xs uppercase text-amber-900 font-semibold">
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
                    {alertsQuery.data.list.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-muted-foreground">
                          <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                          <p className="font-semibold text-foreground">Kho hàng an toàn!</p>
                          <span className="text-xs">Tất cả nguyên vật liệu đều đang trên mức tối thiểu.</span>
                        </td>
                      </tr>
                    ) : (
                      alertsQuery.data.list.map((alert) => (
                        <tr key={alert.id} className="hover:bg-amber-50/30 transition-colors">
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
                            {Number(alert.stock).toLocaleString('vi-VN')} {alert.unitName}
                          </td>
                          <td className="py-3.5 px-4 text-right text-xs text-muted-foreground">
                            {Number(alert.reorderPoint).toLocaleString('vi-VN')}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-amber-700">
                            +{Number(alert.shortageQuantity).toLocaleString('vi-VN')} {alert.unitName}
                          </td>
                          <td className="py-3.5 px-4 sm:px-6 text-center">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => setImportItem(alert)}
                              className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1 font-semibold"
                            >
                              <ArrowDownToLine className="h-3.5 w-3.5" /> Tạo phiếu nhập
                            </Button>
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
      )}

      {/* TAB 3: TRANSACTIONS HISTORY */}
      {activeTab === 'transactions' && (
        <Card className="border-border/80 shadow-xs overflow-hidden">
          <CardContent className="p-0">
            {transactionsQuery.isLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                <RefreshCw className="h-6 w-6 animate-spin text-brand-700" />
                <p className="text-sm">Đang tải lịch sử xuất nhập…</p>
              </div>
            )}

            {transactionsQuery.data && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-stone-50 border-b border-border text-xs uppercase text-muted-foreground font-semibold">
                    <tr>
                      <th className="py-3.5 px-4 sm:px-6">Thời gian</th>
                      <th className="py-3.5 px-4">Loại biến động</th>
                      <th className="py-3.5 px-4">Nguyên vật liệu</th>
                      <th className="py-3.5 px-4 text-right">Số lượng</th>
                      <th className="py-3.5 px-4 text-right">Đơn giá nhập</th>
                      <th className="py-3.5 px-4 sm:px-6">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {transactionsQuery.data.list.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-muted-foreground">
                          Chưa có lịch sử biến động kho.
                        </td>
                      </tr>
                    ) : (
                      transactionsQuery.data.list.map((tx) => (
                        <tr key={tx.id} className="hover:bg-stone-50/70 transition-colors">
                          <td className="py-3.5 px-4 sm:px-6 text-xs text-muted-foreground">
                            {new Date(tx.transactionDate).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            •{' '}
                            {new Date(tx.transactionDate).toLocaleDateString([], {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-3.5 px-4">
                            {tx.type === 'IMPORT' ? (
                              <Badge variant="success" className="gap-1 text-xs">
                                <ArrowDownToLine className="h-3 w-3" /> Nhập kho
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1 text-xs text-amber-800 bg-amber-50 border-amber-200">
                                <ArrowUpFromLine className="h-3 w-3" /> Xuất kho
                              </Badge>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-foreground">
                            {tx.inventoryItem?.name ?? 'Nguyên liệu'}
                          </td>
                          <td
                            className={cn(
                              'py-3.5 px-4 text-right font-bold text-sm',
                              tx.type === 'IMPORT' ? 'text-emerald-700' : 'text-amber-800',
                            )}
                          >
                            {tx.type === 'IMPORT' ? '+' : '-'}
                            {Number(tx.quantity).toLocaleString('vi-VN')}{' '}
                            {tx.inventoryItem?.unit?.name}
                          </td>
                          <td className="py-3.5 px-4 text-right text-xs text-muted-foreground">
                            {tx.unitPrice ? formatPrice(String(tx.unitPrice)) : '—'}
                          </td>
                          <td className="py-3.5 px-4 sm:px-6 text-xs text-muted-foreground">
                            {tx.note}
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
      )}

      {/* IMPORT MODAL */}
      {importItem && (
        <ImportDialog
          item={importItem}
          onClose={() => setImportItem(null)}
          onSuccess={() => {
            setImportItem(null)
            void queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
            void queryClient.invalidateQueries({ queryKey: ['inventory-reorder-alerts'] })
            void queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] })
          }}
        />
      )}

      {/* EXPORT MODAL */}
      {exportItem && (
        <ExportDialog
          item={exportItem}
          onClose={() => setExportItem(null)}
          onSuccess={() => {
            setExportItem(null)
            void queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
            void queryClient.invalidateQueries({ queryKey: ['inventory-reorder-alerts'] })
            void queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] })
          }}
        />
      )}

      {/* CREATE ITEM MODAL */}
      {createDialogOpen && (
        <CreateItemDialog
          onClose={() => setCreateDialogOpen(false)}
          categories={categoriesQuery.data ?? []}
          units={unitsQuery.data ?? []}
          onSuccess={() => {
            setCreateDialogOpen(false)
            void queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
            void queryClient.invalidateQueries({ queryKey: ['inventory-reorder-alerts'] })
          }}
        />
      )}

      {/* EDIT ITEM MODAL */}
      {editItem && (
        <EditItemDialog
          item={editItem}
          categories={categoriesQuery.data ?? []}
          units={unitsQuery.data ?? []}
          onClose={() => setEditItem(null)}
          onSuccess={() => {
            setEditItem(null)
            void queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
            void queryClient.invalidateQueries({ queryKey: ['inventory-reorder-alerts'] })
          }}
        />
      )}

      {/* DELETE CONFIRM DIALOG */}
      {deleteItem && (
        <Dialog open onClose={() => setDeleteItem(null)} maxWidth="sm">
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-bold text-destructive">
              Xóa nguyên vật liệu?
            </h3>
            <p className="text-sm text-muted-foreground">
              Bạn có chắc chắn muốn xóa nguyên vật liệu <strong>{deleteItem.name}</strong> không? Hành động này sẽ ngừng quản lý tồn kho mặt hàng này.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDeleteItem(null)}>
                Quay lại
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => deleteMutation.mutate(deleteItem.id)}
                isLoading={deleteMutation.isPending}
              >
                Xác nhận xóa
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}

// ============================================================================
// MODAL: IMPORT INVENTORY
// ============================================================================

function ImportDialog({
  item,
  onClose,
  onSuccess,
}: {
  item: InventoryItem | ReorderAlertRow
  onClose: () => void
  onSuccess: () => void
}) {
  const [quantity, setQuantity] = useState('10')
  const [unitPrice, setUnitPrice] = useState('50000')
  const [note, setNote] = useState('Nhập hàng định kỳ từ nhà cung cấp')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      importInventory(item.id, {
        quantity: quantity.trim(),
        unitPrice: unitPrice.trim(),
        note: note.trim(),
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (Number(quantity) <= 0) {
      setError('Số lượng nhập phải lớn hơn 0.')
      return
    }
    if (Number(unitPrice) < 0) {
      setError('Đơn giá không hợp lệ.')
      return
    }
    mutation.mutate()
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-emerald-700" />
            <h3 className="font-bold text-base text-foreground">Nhập kho nguyên liệu</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs space-y-1">
          <p className="font-semibold text-foreground">Mặt hàng: {item.name}</p>
          <p className="text-muted-foreground">Tồn kho hiện tại: {Number(item.stock).toLocaleString('vi-VN')}</p>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">
            Số lượng nhập <span className="text-destructive">*</span>
          </label>
          <Input
            type="number"
            step="any"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">
            Đơn giá nhập (VND) <span className="text-destructive">*</span>
          </label>
          <Input
            type="number"
            required
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
          {unitPrice && Number(unitPrice) > 0 && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Ước tính: {formatPrice(String(Number(quantity || 0) * Number(unitPrice)))}
            </p>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">
            Ghi chú / Nguồn gốc <span className="text-destructive">*</span>
          </label>
          <Input
            type="text"
            required
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" size="sm" isLoading={mutation.isPending} className="font-semibold">
            Xác nhận nhập kho
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

// ============================================================================
// MODAL: EXPORT INVENTORY
// ============================================================================

function ExportDialog({
  item,
  onClose,
  onSuccess,
}: {
  item: InventoryItem
  onClose: () => void
  onSuccess: () => void
}) {
  const [quantity, setQuantity] = useState('1')
  const [note, setNote] = useState('Xuất dùng pha chế quầy Barista')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      exportInventory(item.id, {
        quantity: quantity.trim(),
        note: note.trim(),
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (Number(quantity) <= 0) {
      setError('Số lượng xuất phải lớn hơn 0.')
      return
    }
    if (Number(quantity) > Number(item.stock)) {
      setError(`Số lượng xuất không thể lớn hơn tồn kho hiện tại (${item.stock}).`)
      return
    }
    mutation.mutate()
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <ArrowUpFromLine className="h-5 w-5 text-amber-700" />
            <h3 className="font-bold text-base text-foreground">Xuất kho / Báo hao hụt</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs space-y-1">
          <p className="font-semibold text-foreground">Mặt hàng: {item.name}</p>
          <p className="text-muted-foreground">Tồn khả dụng: {Number(item.stock).toLocaleString('vi-VN')} {item.unit?.name}</p>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">
            Số lượng xuất <span className="text-destructive">*</span>
          </label>
          <Input
            type="number"
            step="any"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">
            Lý do xuất / Ghi chú <span className="text-destructive">*</span>
          </label>
          <Input
            type="text"
            required
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" size="sm" variant="destructive" isLoading={mutation.isPending} className="font-semibold">
            Xác nhận xuất kho
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

// ============================================================================
// MODAL: CREATE INVENTORY ITEM
// ============================================================================

function CreateItemDialog({
  categories,
  units,
  onClose,
  onSuccess,
}: {
  categories: Array<{ id: string; name: string }>
  units: Array<{ id: string; name: string }>
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [unitId, setUnitId] = useState(units[0]?.id ?? '')
  const [stock, setStock] = useState('0')
  const [initialUnitCost, setInitialUnitCost] = useState('0')
  const [reorderPoint, setReorderPoint] = useState('10')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      createInventoryItem({
        name: name.trim(),
        categoryId,
        unitId,
        stock: Number(stock) || 0,
        initialUnitCost: Number(stock) > 0 ? Number(initialUnitCost) || 0 : undefined,
        reorderPoint: Number(reorderPoint) || 0,
      }),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Vui lòng nhập tên nguyên vật liệu.')
      return
    }
    mutation.mutate()
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-bold text-base text-foreground">Thêm nguyên vật liệu mới</h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">
            Tên nguyên liệu <span className="text-destructive">*</span>
          </label>
          <Input
            type="text"
            required
            placeholder="VD: Cà phê Robusta Đắk Lắk"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Nhóm danh mục
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-border bg-white"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Đơn vị tính
            </label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-border bg-white"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Số lượng ban đầu
            </label>
            <Input
              type="number"
              step="any"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Mức tối thiểu cảnh báo
            </label>
            <Input
              type="number"
              step="any"
              value={reorderPoint}
              onChange={(e) => setReorderPoint(e.target.value)}
            />
          </div>
        </div>

        {Number(stock) > 0 && (
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Giá vốn ban đầu (VND)
            </label>
            <Input
              type="number"
              value={initialUnitCost}
              onChange={(e) => setInitialUnitCost(e.target.value)}
            />
          </div>
        )}

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" size="sm" isLoading={mutation.isPending} className="font-semibold">
            Tạo nguyên liệu
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

// ============================================================================
// MODAL: EDIT INVENTORY ITEM
// ============================================================================

function EditItemDialog({
  item,
  categories,
  units,
  onClose,
  onSuccess,
}: {
  item: InventoryItem
  categories: Array<{ id: string; name: string }>
  units: Array<{ id: string; name: string }>
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState(item.name)
  const [categoryId, setCategoryId] = useState(item.categoryId)
  const [unitId, setUnitId] = useState(item.unitId)
  const [reorderPoint, setReorderPoint] = useState(String(item.reorderPoint ?? 10))
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      updateInventoryItem(item.id, {
        name: name.trim(),
        categoryId,
        unitId,
        reorderPoint: Number(reorderPoint) || 0,
      }),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    mutation.mutate()
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-bold text-base text-foreground">Chỉnh sửa nguyên vật liệu</h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">
            Tên nguyên liệu <span className="text-destructive">*</span>
          </label>
          <Input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Nhóm danh mục
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-border bg-white"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Đơn vị tính
            </label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-border bg-white"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">
            Mức tối thiểu cảnh báo
          </label>
          <Input
            type="number"
            step="any"
            value={reorderPoint}
            onChange={(e) => setReorderPoint(e.target.value)}
          />
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" size="sm" isLoading={mutation.isPending} className="font-semibold">
            Lưu thay đổi
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
