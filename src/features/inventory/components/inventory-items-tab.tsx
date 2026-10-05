import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  Edit2,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import {
  type InventoryItem,
  type InventoryCategory,
  type Unit,
  type InventoryItemsResponse,
} from '../inventory.api'
import { formatPrice } from '../../menu/menu.api'
import { formatQuantity } from '../quantity'
import { errorMessage } from '../../../shared/api/client'
import { Badge, Button, Card, CardContent, Input, cn } from '../../../shared/ui'

interface InventoryItemsTabProps {
  keyword: string
  setKeyword: (val: string) => void
  selectedCategoryId: string
  setSelectedCategoryId: (val: string) => void
  selectedUnitId: string
  setSelectedUnitId: (val: string) => void
  lowStockOnly: boolean
  setLowStockOnly: (val: boolean) => void
  page: number
  setPage: React.Dispatch<React.SetStateAction<number>>
  categories: InventoryCategory[]
  units: Unit[]
  data?: InventoryItemsResponse
  isLoading: boolean
  isError: boolean
  error: unknown
  isFetching: boolean
  onRefetch: () => void
  onImport: (item: InventoryItem) => void
  onExport: (item: InventoryItem) => void
  onEdit: (item: InventoryItem) => void
  onDelete: (item: InventoryItem) => void
}

export function InventoryItemsTab({
  keyword,
  setKeyword,
  selectedCategoryId,
  setSelectedCategoryId,
  selectedUnitId,
  setSelectedUnitId,
  lowStockOnly,
  setLowStockOnly,
  page,
  setPage,
  categories,
  units,
  data,
  isLoading,
  isError,
  error,
  isFetching,
  onRefetch,
  onImport,
  onExport,
  onEdit,
  onDelete,
}: InventoryItemsTabProps) {
  return (
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
                {categories.map((cat) => (
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
                {units.map((u) => (
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
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <RefreshCw className="h-6 w-6 animate-spin text-brand-700" />
            <p className="text-sm">Đang tải danh sách tồn kho…</p>
          </div>
        )}

        {isError && (
          <div className="p-4 bg-destructive/10 text-destructive flex items-center justify-between m-4 rounded-xl">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage(error)}</span>
            </div>
            <Button variant="outline" size="sm" onClick={onRefetch}>
              Thử lại
            </Button>
          </div>
        )}

        {data && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-stone-50 border-b border-border text-xs uppercase text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Tên nguyên liệu</th>
                  <th className="py-3.5 px-4">Nhóm kho</th>
                  <th className="py-3.5 px-4">Đơn vị</th>
                  <th className="py-3.5 px-4 text-right">Tồn kho hiện tại</th>
                  <th className="py-3.5 px-4 text-right">Ngưỡng tối thiểu</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Giá vốn BQ</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.list.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      Không tìm thấy nguyên vật liệu nào.
                    </td>
                  </tr>
                ) : (
                  data.list.map((item) => {
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
                              isLow
                                ? 'text-amber-800 bg-amber-50 px-2 py-0.5 rounded'
                                : 'text-foreground',
                            )}
                          >
                            {formatQuantity(item.stock)} {item.unit?.name}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right text-xs text-muted-foreground">
                          {item.reorderPoint
                            ? formatQuantity(item.reorderPoint)
                            : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right text-xs font-semibold text-brand-800 whitespace-nowrap tabular-nums">
                          {item.averageUnitCost ? formatPrice(String(item.averageUnitCost)) : '—'}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onImport(item)}
                              className="h-7 text-xs text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 gap-1 border-emerald-200"
                              title="Nhập thêm hàng"
                            >
                              <ArrowDownToLine className="h-3.5 w-3.5" /> Nhập
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onExport(item)}
                              className="h-7 text-xs text-amber-700 hover:bg-amber-50 hover:text-amber-800 gap-1 border-amber-200"
                              title="Xuất kho / Hao hụt"
                            >
                              <ArrowUpFromLine className="h-3.5 w-3.5" /> Xuất
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onEdit(item)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              title="Chỉnh sửa"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onDelete(item)}
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
        {data && data.totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Trang {data.currentPage} / {data.totalPages} (Tổng {data.totalItems} mặt hàng)
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Trước
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages || isFetching}
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
  )
}
