import { formatPrice } from '@/shared/lib/format'
import { Boxes, ChefHat, Coffee, Pencil, Search, Sliders, Trash2 } from 'lucide-react'
import { type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'
import { type AdminMenuItem, type AdminMenuItemsResponse } from '../menu.admin.api'
import { CatalogPicker, type CatalogSelection } from './catalog-picker'
import { Pagination } from '../../../shared/ui/pagination'
import { errorMessage } from '../../../shared/api/client'
import { AdminTable } from '../../../shared/ui'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { Badge } from '../../../shared/ui/badge'

interface MenuItemsTabProps {
  itemsQuery: UseQueryResult<AdminMenuItemsResponse, Error>
  employeeId: string
  keyword: string
  onKeywordChange: (val: string) => void
  categoryFilter: CatalogSelection
  onCategoryFilterChange: (val: CatalogSelection) => void
  availabilityFilter: 'ALL' | 'ACTIVE' | 'INACTIVE'
  onAvailabilityFilterChange: (val: 'ALL' | 'ACTIVE' | 'INACTIVE') => void
  page: number
  onPageChange: (val: number | ((p: number) => number)) => void
  canUpdate: boolean
  canDelete: boolean
  toggleMutation: UseMutationResult<unknown, Error, { id: string; isAvailable: boolean }>
  onRecipeClick: (item: AdminMenuItem) => void
  onOptionsClick: (item: AdminMenuItem) => void
  onEditClick: (item: AdminMenuItem) => void
  onDeleteClick: (item: AdminMenuItem) => void
}

export function MenuItemsTab({
  itemsQuery,
  employeeId,
  keyword,
  onKeywordChange,
  categoryFilter,
  onCategoryFilterChange,
  availabilityFilter,
  onAvailabilityFilterChange,
  page,
  onPageChange,
  canUpdate,
  canDelete,
  toggleMutation,
  onRecipeClick,
  onOptionsClick,
  onEditClick,
  onDeleteClick,
}: MenuItemsTabProps) {
  return (
    <div className="space-y-4">
      <section aria-label="Bộ lọc thực đơn" className="admin-toolbar !items-end">
        <div className="relative min-w-0 flex-1 basis-64">
          <Search
            size={16}
            aria-hidden="true"
            className="absolute left-3 top-3 text-muted-foreground"
          />
          <Input
            placeholder="Tìm kiếm theo tên món..."
            aria-label="Tìm tên món"
            maxLength={120}
            value={keyword}
            onChange={(event) => {
              onKeywordChange(event.target.value)
              onPageChange(1)
            }}
            className="pl-9"
          />
        </div>
        <div className="admin-catalog-filter min-w-0 flex-1 basis-64">
          <CatalogPicker
            employeeId={employeeId}
            resource="category"
            label="Lọc theo danh mục"
            selected={categoryFilter}
            emptyLabel="Tất cả danh mục"
            onChange={(value) => {
              onCategoryFilterChange(value)
              onPageChange(1)
            }}
          />
        </div>
        <label className="min-w-0 space-y-2 text-sm font-medium">
          Trạng thái bán
          <select
            className="block w-full rounded-md border border-input bg-card px-3 text-sm"
            value={availabilityFilter}
            onChange={(event) => {
              onAvailabilityFilterChange(event.target.value as typeof availabilityFilter)
              onPageChange(1)
            }}
            aria-label="Lọc theo trạng thái bán"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang bán</option>
            <option value="INACTIVE">Ngừng bán</option>
          </select>
        </label>
      </section>
      {itemsQuery.isError ? (
        <div role="alert" className="border-l-4 border-destructive p-5 text-sm">
          <p>{errorMessage(itemsQuery.error)}</p>
          <Button variant="outline" onClick={() => void itemsQuery.refetch()} className="mt-3">
            Thử lại
          </Button>
        </div>
      ) : itemsQuery.isPending ? (
        <p role="status" className="py-12 text-center text-sm text-muted-foreground">
          Đang tải danh mục món...
        </p>
      ) : (
        <>
          <h2 className="text-base font-bold">Món theo bộ lọc ({itemsQuery.data.totalItems})</h2>
          <AdminTable label="Danh sách món">
            <thead>
              <tr>
                <th>Món</th>
                <th>Danh mục</th>
                <th>Quầy pha chế</th>
                <th className="text-right">Đơn giá</th>
                <th>Trạng thái bán</th>
                <th>Công thức</th>
                <th>Tùy chọn</th>
                <th className="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {itemsQuery.data.list.map((item) => (
                <tr key={item.id}>
                  <td className="min-w-56 max-w-72">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
                        <Coffee size={18} aria-hidden="true" />
                        {item.imageUrl && (
                          <img
                            key={item.imageUrl}
                            src={item.imageUrl}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 h-full w-full object-cover"
                            onError={(event) => {
                              event.currentTarget.hidden = true
                            }}
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <strong className="block break-words">{item.name}</strong>
                        {item.description && (
                          <p
                            className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground"
                            title={item.description}
                          >
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="min-w-28 max-w-48">
                    {item.category?.name ? (
                      <Badge variant="secondary" className="max-w-full break-words">
                        {item.category.name}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="min-w-36 max-w-48 text-xs text-muted-foreground">
                    {item.kitchenStation ? (
                      <span className="inline-flex items-center gap-1">
                        <ChefHat size={14} aria-hidden="true" className="shrink-0" />
                        {item.kitchenStation.name}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="whitespace-nowrap text-right font-semibold tabular-nums">
                    {formatPrice(item.price)}
                  </td>
                  <td className="min-w-28">
                    {canUpdate ? (
                      <button
                        type="button"
                        aria-pressed={item.isAvailable}
                        onClick={() =>
                          toggleMutation.mutate({ id: item.id, isAvailable: !item.isAvailable })
                        }
                        disabled={toggleMutation.isPending}
                        className="rounded-md px-1"
                        title="Bấm để chuyển trạng thái bán món này"
                      >
                        <Badge
                          variant={item.isAvailable ? 'success' : 'secondary'}
                          className="whitespace-nowrap"
                        >
                          {item.isAvailable ? 'Đang bán' : 'Ngừng bán'}
                        </Badge>
                      </button>
                    ) : (
                      <Badge
                        variant={item.isAvailable ? 'success' : 'secondary'}
                        className="whitespace-nowrap"
                      >
                        {item.isAvailable ? 'Đang bán' : 'Ngừng bán'}
                      </Badge>
                    )}
                  </td>
                  <td>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRecipeClick(item)}
                      title="Công thức nguyên liệu"
                    >
                      <Boxes size={15} aria-hidden="true" />
                      Công thức
                    </Button>
                  </td>
                  <td>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOptionsClick(item)}
                      title="Tùy chọn món (Size, Topping...)"
                    >
                      <Sliders size={15} aria-hidden="true" />
                      Tùy chọn
                    </Button>
                  </td>
                  <td>
                    <div className="admin-actions">
                      {canUpdate && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10"
                          onClick={() => onEditClick(item)}
                          title="Sửa thông tin món"
                          aria-label={`Sửa thông tin món ${item.name}`}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 text-destructive"
                          onClick={() => onDeleteClick(item)}
                          title="Xóa món"
                          aria-label={`Xóa món ${item.name}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!itemsQuery.data.list.length && (
                <tr>
                  <td colSpan={8} className="text-center text-muted-foreground">
                    Không tìm thấy món nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              )}
            </tbody>
          </AdminTable>
          {(itemsQuery.data.totalPages > 1 || page > 1) && (
            <Pagination
              page={page}
              totalPages={itemsQuery.data.totalPages}
              disabled={itemsQuery.isFetching}
              onPage={onPageChange}
            />
          )}
          {page > Math.max(1, itemsQuery.data.totalPages) && (
            <Button variant="outline" onClick={() => onPageChange(1)}>
              Về trang đầu
            </Button>
          )}
        </>
      )}
    </div>
  )
}
