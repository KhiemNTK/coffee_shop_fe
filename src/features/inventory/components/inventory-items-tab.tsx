import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, Edit2, Search, Trash2 } from 'lucide-react'
import {
  type InventoryItem,
  type InventoryCategory,
  type Unit,
  type InventoryItemsResponse,
} from '../inventory.api'
import { formatPrice } from '../../menu/menu.api'
import { formatQuantity, quantityDifference } from '../quantity'
import { errorMessage } from '../../../shared/api/client'
import { AdminTable, Badge, Button, Input } from '../../../shared/ui'
import { useTranslation } from 'react-i18next'

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
  canAdjust: boolean
  canUpdate: boolean
  canDelete: boolean
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
  canAdjust,
  canUpdate,
  canDelete,
}: InventoryItemsTabProps) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <section aria-label="Bộ lọc tồn kho" className="admin-toolbar">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search
            size={16}
            aria-hidden="true"
            className="absolute left-3 top-3 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Tìm nguyên liệu"
            placeholder="Tìm tên nguyên liệu…"
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value)
              setPage(1)
            }}
            className="pl-9"
          />
        </div>
        <select
          aria-label="Lọc nhóm kho"
          value={selectedCategoryId}
          onChange={(event) => {
            setSelectedCategoryId(event.target.value)
            setPage(1)
          }}
          className="min-w-0 rounded-md border border-input bg-card px-3 text-sm"
        >
          <option value="">Tất cả danh mục kho</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Lọc đơn vị tính"
          value={selectedUnitId}
          onChange={(event) => {
            setSelectedUnitId(event.target.value)
            setPage(1)
          }}
          className="min-w-0 rounded-md border border-input bg-card px-3 text-sm"
        >
          <option value="">Tất cả đơn vị tính</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </select>
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(event) => {
              setLowStockOnly(event.target.checked)
              setPage(1)
            }}
            className="h-4 w-4 accent-primary"
          />
          {t('inventory.physicalLowFilter')}
        </label>
      </section>
      {isError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 border-l-4 border-destructive p-4 text-sm"
        >
          {errorMessage(error)}
          <Button variant="outline" onClick={onRefetch}>
            Thử lại
          </Button>
        </div>
      ) : isLoading ? (
        <p role="status" className="py-12 text-center text-sm text-muted-foreground">
          Đang tải danh sách tồn kho…
        </p>
      ) : (
        data && (
          <AdminTable label="Danh sách tồn kho">
            <thead>
              <tr>
                <th>Tên nguyên liệu</th>
                <th>Nhóm kho</th>
                <th>Đơn vị</th>
                <th className="text-right">{t('inventory.physicalStock')}</th>
                <th className="text-right">{t('inventory.reservedStock')}</th>
                <th className="text-right">{t('inventory.availableStock')}</th>
                <th className="text-right">Ngưỡng tối thiểu</th>
                <th className="text-right">Giá vốn BQ</th>
                <th>{t('inventory.physicalStatus')}</th>
                <th className="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {!data.list.length ? (
                <tr>
                  <td colSpan={10} className="text-center text-muted-foreground">
                    Không tìm thấy nguyên vật liệu nào.
                  </td>
                </tr>
              ) : (
                data.list.map((item) => {
                  const available = quantityDifference(item.stock, item.reservedStock)
                  const hasThreshold =
                    item.reorderPoint != null &&
                    quantityDifference(item.reorderPoint, '0') !== '0.0000'
                  const delta = hasThreshold
                    ? quantityDifference(item.stock, item.reorderPoint!)
                    : null
                  const isLow = delta !== null && (delta.startsWith('-') || delta === '0.0000')
                  return (
                    <tr key={item.id}>
                      <td className="min-w-48 max-w-64 font-semibold">{item.name}</td>
                      <td className="min-w-36 max-w-48">
                        <Badge variant="secondary">{item.category?.name ?? '—'}</Badge>
                      </td>
                      <td className="min-w-16 text-sm text-muted-foreground">
                        {item.unit?.name ?? '—'}
                      </td>
                      <td className="whitespace-nowrap text-right font-semibold tabular-nums">
                        {formatQuantity(item.stock)} {item.unit?.name}
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums">
                        {formatQuantity(item.reservedStock)} {item.unit?.name}
                      </td>
                      <td className="whitespace-nowrap text-right font-semibold tabular-nums">
                        {formatQuantity(available)} {item.unit?.name}
                        {available === '0.0000' && <span className="block text-xs text-destructive">{t('inventory.fullyCommitted')}</span>}
                      </td>
                      <td className="text-right text-muted-foreground">
                        {item.reorderPoint != null ? formatQuantity(item.reorderPoint) : '—'}
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums">
                        {item.averageUnitCost != null ? formatPrice(item.averageUnitCost) : '—'}
                      </td>
                      <td className="min-w-32">
                        <Badge variant={!hasThreshold ? 'outline' : isLow ? 'warning' : 'success'}>
                          {!hasThreshold
                            ? 'Chưa đặt ngưỡng'
                            : isLow
                              ? 'Sắp hết'
                              : 'Trên ngưỡng tối thiểu'}
                        </Badge>
                      </td>
                      <td>
                        <div className="admin-actions">
                          {canAdjust && (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => onImport(item)}
                                title="Nhập thêm hàng"
                              >
                                <ArrowDownToLine size={15} aria-hidden="true" />
                                Nhập
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => onExport(item)}
                                title="Xuất kho nguyên liệu"
                              >
                                <ArrowUpFromLine size={15} aria-hidden="true" />
                                Xuất
                              </Button>
                            </>
                          )}
                          {canUpdate && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10"
                              onClick={() => onEdit(item)}
                              title="Chỉnh sửa"
                              aria-label={`Chỉnh sửa ${item.name}`}
                            >
                              <Edit2 size={16} aria-hidden="true" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 text-destructive"
                              onClick={() => onDelete(item)}
                              title="Xóa"
                              aria-label={`Xóa ${item.name}`}
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </AdminTable>
        )
      )}
      {data && !isError && data.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            Trang {data.currentPage} / {data.totalPages} (Tổng {data.totalItems} mặt hàng)
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ArrowLeft size={15} aria-hidden="true" />
              Trước
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={page >= data.totalPages || isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              Sau
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
