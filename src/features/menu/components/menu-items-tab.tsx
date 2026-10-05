import { Boxes, ChefHat, Pencil, Search, Sliders, Trash2 } from 'lucide-react'
import { type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'
import { type AdminMenuItem, type AdminMenuItemsResponse } from '../menu.admin.api'
import { CatalogPicker, type CatalogSelection } from './catalog-picker'
import { Pagination } from '../../../shared/ui/pagination'
import { formatPrice } from '../menu.api'
import { errorMessage } from '../../../shared/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui/card'
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
      {/* Filters Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-4">
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm theo tên món..."
                aria-label="Tìm tên món"
                maxLength={120}
                value={keyword}
                onChange={(e) => {
                  onKeywordChange(e.target.value)
                  onPageChange(1)
                }}
                className="pl-9"
              />
            </div>

            <div>
              <CatalogPicker employeeId={employeeId} resource="category" label="Lọc theo danh mục"
                selected={categoryFilter} emptyLabel="Tất cả danh mục"
                onChange={value => { onCategoryFilterChange(value); onPageChange(1) }} />
            </div>

            <div>
              <select
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
                value={availabilityFilter}
                onChange={(e) => {
                  onAvailabilityFilterChange(e.target.value as typeof availabilityFilter)
                  onPageChange(1)
                }}
                aria-label="Lọc theo trạng thái bán"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang bán</option>
                <option value="INACTIVE">Ngừng bán</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      {itemsQuery.isError ? (
        <Card className="border-destructive/20 bg-destructive/5 p-6 text-center">
          <p role="alert" className="font-semibold text-destructive">{errorMessage(itemsQuery.error)}</p>
          <Button
            variant="outline"
            onClick={() => void itemsQuery.refetch()}
            className="mt-4"
          >
            Thử lại
          </Button>
        </Card>
      ) : itemsQuery.isPending ? (
        <Card className="p-12 text-center text-muted-foreground animate-pulse">
          Đang tải danh mục món...
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-bold text-foreground">
              Món theo bộ lọc ({itemsQuery.data.totalItems})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full max-w-full overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-y border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Món</th>
                    <th className="px-4 py-3">Danh mục</th>
                    <th className="px-4 py-3">Quầy pha chế</th>
                    <th className="px-4 py-3 text-right">Đơn giá</th>
                    <th className="px-4 py-3 text-center">Trạng thái bán</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {itemsQuery.data.list.map((item) => {
                    return (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3.5 font-semibold text-foreground">
                          {item.name}
                        </td>

                        <td className="px-4 py-3.5">
                          {item.category?.name ? (
                            <Badge variant="outline" className="text-xs">
                              {item.category.name}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-xs text-muted-foreground">
                          {item.kitchenStation ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-medium text-foreground">
                              <ChefHat className="h-3 w-3 text-primary" />
                              {item.kitchenStation.name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-right font-bold text-primary">
                          {formatPrice(item.price)}
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          {canUpdate ? (
                            <button
                              type="button"
                              onClick={() =>
                                toggleMutation.mutate({
                                  id: item.id,
                                  isAvailable: !item.isAvailable,
                                })
                              }
                              disabled={toggleMutation.isPending}
                              className="inline-flex cursor-pointer transition-opacity hover:opacity-80 focus:outline-none"
                              title="Bấm để chuyển trạng thái bán món này"
                            >
                              <Badge variant={item.isAvailable ? 'success' : 'secondary'}>
                                {item.isAvailable ? 'Đang bán' : 'Ngừng bán'}
                              </Badge>
                            </button>
                          ) : (
                            <Badge variant={item.isAvailable ? 'success' : 'secondary'}>
                              {item.isAvailable ? 'Đang bán' : 'Ngừng bán'}
                            </Badge>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onRecipeClick(item)}
                              className="h-8 px-2 text-xs gap-1"
                              title="Công thức nguyên liệu"
                            >
                              <Boxes className="h-3.5 w-3.5 text-primary" />
                              <span className="hidden sm:inline">Công thức</span>
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onOptionsClick(item)}
                              className="h-8 px-2 text-xs gap-1"
                              title="Tùy chọn món (Size, Topping...)"
                            >
                              <Sliders className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="hidden sm:inline">Tùy chọn</span>
                            </Button>

                            {canUpdate && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onEditClick(item)}
                                className="h-8 w-8 p-0"
                                title="Sửa thông tin món"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onDeleteClick(item)}
                                className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                title="Xóa món"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {!itemsQuery.data.list.length && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Không tìm thấy món nào phù hợp với bộ lọc hiện tại.
              </p>
            )}

            {/* Pagination */}
            {(itemsQuery.data.totalPages > 1 || page > 1) && <Pagination page={page} totalPages={itemsQuery.data.totalPages}
              disabled={itemsQuery.isFetching} onPage={onPageChange} />}
            {page > Math.max(1, itemsQuery.data.totalPages) && <Button variant="outline" onClick={() => onPageChange(1)}>Về trang đầu</Button>}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
