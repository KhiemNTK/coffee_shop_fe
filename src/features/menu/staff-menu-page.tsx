import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useOutletContext } from 'react-router-dom'
import {
  AlertTriangle,
  BookOpen,
  Boxes,
  CheckCircle2,
  ChefHat,
  Coffee,
  FolderTree,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sliders,
  Trash2,
  XCircle,
} from 'lucide-react'
import { type Session } from '../auth/session'
import { formatPrice } from './menu.api'
import {
  type AdminCategory,
  type AdminMenuItem,
  createCategory,
  createMenuItem,
  deleteCategory,
  deleteMenuItem,
  getAdminCategories,
  getAdminItems,
  getItemOptions,
  getItemRecipe,
  getItemStockStatus,
  getKitchenStationsList,
  replaceItemOptions,
  replaceItemRecipe,
  updateCategory,
  updateMenuItem,
  updateMenuItemAvailability,
} from './menu.admin.api'
import { getInventoryItems } from '../inventory/inventory.api'
import { errorMessage } from '../../shared/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card'
import { Button } from '../../shared/ui/button'
import { Input } from '../../shared/ui/input'
import { Badge } from '../../shared/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../shared/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../shared/ui/dialog'
import { cn } from '../../shared/ui/utils'

export default function StaffMenuPage() {
  const { employee, authorization } = useOutletContext<Session>()
  const queryClient = useQueryClient()
  const permissions = authorization.permissionKeys

  const canCreate = permissions.includes('/menu_create')
  const canUpdate = permissions.includes('/menu_update')
  const canDelete = permissions.includes('/menu_delete')

  // Navigation & Filter state
  const [activeTab, setActiveTab] = useState<'items' | 'categories' | 'stock'>('items')
  const [keyword, setKeyword] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [availabilityFilter, setAvailabilityFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [page, setPage] = useState(1)

  // Dialog states
  const [createItemOpen, setCreateItemOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AdminMenuItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<AdminMenuItem | null>(null)

  const [createCategoryOpen, setCreateCategoryOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<AdminCategory | null>(null)

  const [recipeItem, setRecipeItem] = useState<AdminMenuItem | null>(null)
  const [optionsItem, setOptionsItem] = useState<AdminMenuItem | null>(null)

  // Queries (lazy loaded according to active tab/modal for optimal performance and no unneeded roundtrips)
  const categoriesQuery = useQuery({
    queryKey: ['private', employee.id, 'admin-categories'],
    queryFn: ({ signal }) => getAdminCategories({ page: 1, itemPerPage: 100 }, signal),
    enabled: activeTab === 'categories' || createItemOpen || editingItem !== null,
  })

  const stationsQuery = useQuery({
    queryKey: ['private', employee.id, 'kitchen-stations'],
    queryFn: ({ signal }) => getKitchenStationsList(signal),
    enabled: createItemOpen || editingItem !== null,
  })

  const itemsQuery = useQuery({
    queryKey: [
      'private',
      employee.id,
      'admin-menu-items',
      page,
      keyword,
      categoryFilter,
      availabilityFilter,
    ],
    queryFn: ({ signal }) =>
      getAdminItems(
        {
          page,
          itemPerPage: 15,
          keyword,
          categoryId: categoryFilter || undefined,
          isAvailable:
            availabilityFilter === 'ACTIVE'
              ? true
              : availabilityFilter === 'INACTIVE'
                ? false
                : undefined,
        },
        signal,
      ),
  })

  const stockStatusQuery = useQuery({
    queryKey: ['private', employee.id, 'admin-menu-stock'],
    queryFn: ({ signal }) => getItemStockStatus({ page: 1, itemPerPage: 100 }, signal),
    enabled: activeTab === 'stock',
  })

  // Quick availability toggle
  const toggleMutation = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      updateMenuItemAvailability(id, isAvailable),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['private', employee.id, 'admin-menu-items'] })
      void queryClient.invalidateQueries({ queryKey: ['private', employee.id, 'admin-menu-stock'] })
    },
  })

  // Derived stock health counts
  const stockMetrics = useMemo(() => {
    const list = stockStatusQuery.data?.list ?? []
    const insufficientCount = list.filter((i) => i.stockStatus === 'INSUFFICIENT').length
    const lowCount = list.filter((i) => i.stockStatus === 'LOW').length
    const okCount = list.filter((i) => i.stockStatus === 'OK').length
    const untrackedCount = list.filter((i) => i.stockStatus === 'UNTRACKED').length
    return { insufficientCount, lowCount, okCount, untrackedCount }
  }, [stockStatusQuery.data])

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">QUẢN TRỊ THỰC ĐƠN</p>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
            <BookOpen className="h-7 w-7 text-primary" /> Quản lý Thực đơn & Công thức
          </h1>
          <p className="text-sm text-muted-foreground">
            Quản lý danh sách món, danh mục, định lượng nguyên liệu kho và cấu hình tùy chọn đồ uống.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void itemsQuery.refetch()
              void categoriesQuery.refetch()
              void stockStatusQuery.refetch()
            }}
            disabled={itemsQuery.isFetching}
            className="gap-1.5"
          >
            <RefreshCw className={cn('h-4 w-4', itemsQuery.isFetching && 'animate-spin')} />
            Làm mới
          </Button>

          {canCreate && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateCategoryOpen(true)}
                className="gap-1.5"
              >
                <FolderTree className="h-4 w-4" />
                Thêm danh mục
              </Button>
              <Button
                size="sm"
                onClick={() => setCreateItemOpen(true)}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Tạo món mới
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Tổng số món</span>
              <Coffee className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {itemsQuery.data?.totalItems ?? '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              {categoriesQuery.data?.totalItems ?? 0} danh mục đang có
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Nguyên liệu sẵn sàng</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-600">
              {stockMetrics.okCount}
            </p>
            <p className="text-xs text-muted-foreground">Đủ tồn kho phục vụ</p>
          </CardContent>
        </Card>

        <Card className={cn(stockMetrics.insufficientCount > 0 && 'border-destructive/40 bg-destructive/5')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-destructive">Hết nguyên liệu</span>
              <XCircle className="h-4 w-4 text-destructive" />
            </div>
            <p className="mt-2 text-2xl font-bold text-destructive">
              {stockMetrics.insufficientCount}
            </p>
            <p className="text-xs text-muted-foreground">Cần nhập kho ngay</p>
          </CardContent>
        </Card>

        <Card className={cn(stockMetrics.lowCount > 0 && 'border-amber-500/40 bg-amber-500/5')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-600">Sắp hết nguyên liệu</span>
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-amber-600">
              {stockMetrics.lowCount}
            </p>
            <p className="text-xs text-muted-foreground">Chạm mức đặt lại</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as typeof activeTab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="items" className="gap-2">
            <Coffee className="h-4 w-4" />
            Danh sách món
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-2">
            <FolderTree className="h-4 w-4" />
            Danh mục ({categoriesQuery.data?.totalItems ?? 0})
          </TabsTrigger>
          <TabsTrigger value="stock" className="gap-2">
            <Boxes className="h-4 w-4" />
            Cảnh báo nguyên liệu ({stockMetrics.insufficientCount + stockMetrics.lowCount})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: MENU ITEMS */}
        <TabsContent value="items" className="space-y-4">
          {/* Filters Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div className="relative sm:col-span-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Tìm kiếm theo tên món..."
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
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
                    value={categoryFilter}
                    onChange={(e) => {
                      setCategoryFilter(e.target.value)
                      setPage(1)
                    }}
                    aria-label="Lọc theo danh mục"
                  >
                    <option value="">Tất cả danh mục</option>
                    {categoriesQuery.data?.list.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <select
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
                    value={availabilityFilter}
                    onChange={(e) => {
                      setAvailabilityFilter(e.target.value as typeof availabilityFilter)
                      setPage(1)
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
              <p className="font-semibold text-destructive">{errorMessage(itemsQuery.error)}</p>
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
                  Danh sách món ({itemsQuery.data.totalItems})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-y border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Món</th>
                        <th className="px-4 py-3">Danh mục</th>
                        <th className="px-4 py-3">Quầy pha chế</th>
                        <th className="px-4 py-3 text-right">Đơn giá</th>
                        <th className="px-4 py-3 text-center">Trạng thái bán</th>
                        <th className="px-4 py-3 text-center">Tồn nguyên liệu</th>
                        <th className="px-4 py-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {itemsQuery.data.list.map((item) => {
                        const stockInfo = stockStatusQuery.data?.list.find((s) => s.id === item.id)
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

                            <td className="px-4 py-3.5 text-center">
                              {stockInfo ? (
                                stockInfo.stockStatus === 'OK' ? (
                                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-500/5 text-xs">
                                    Đủ nguyên liệu
                                  </Badge>
                                ) : stockInfo.stockStatus === 'LOW' ? (
                                  <Badge variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-500/10 text-xs">
                                    Sắp hết ({stockInfo.atRiskIngredients.length})
                                  </Badge>
                                ) : stockInfo.stockStatus === 'INSUFFICIENT' ? (
                                  <Badge variant="destructive" className="text-xs">
                                    Thiếu kho ({stockInfo.atRiskIngredients.length})
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs text-muted-foreground">
                                    Chưa lập công thức
                                  </Badge>
                                )
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>

                            <td className="px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setRecipeItem(item)}
                                  className="h-8 px-2 text-xs gap-1"
                                  title="Công thức nguyên liệu"
                                >
                                  <Boxes className="h-3.5 w-3.5 text-primary" />
                                  <span className="hidden sm:inline">Công thức</span>
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setOptionsItem(item)}
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
                                    onClick={() => setEditingItem(item)}
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
                                    onClick={() => setDeletingItem(item)}
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
                {itemsQuery.data.totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-border px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      Trang {itemsQuery.data.currentPage} / {itemsQuery.data.totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                      >
                        Trước
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPage((p) => Math.min(itemsQuery.data.totalPages, p + 1))
                        }
                        disabled={page >= itemsQuery.data.totalPages}
                      >
                        Sau
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB 2: CATEGORIES */}
        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-bold text-foreground">
                Danh mục món ăn & đồ uống
              </CardTitle>
              {canCreate && (
                <Button
                  size="sm"
                  onClick={() => setCreateCategoryOpen(true)}
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Thêm danh mục
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-y border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Tên danh mục</th>
                      <th className="px-4 py-3">Mô tả</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {categoriesQuery.data?.list.map((cat) => (
                      <tr key={cat.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3.5 font-bold text-foreground">{cat.name}</td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground">
                          {cat.description || '—'}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canUpdate && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingCategory(cat)}
                                className="h-8 w-8 p-0"
                                title="Sửa danh mục"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeletingCategory(cat)}
                                className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                title="Xóa danh mục"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!categoriesQuery.data?.list.length && (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Chưa có danh mục nào. Hãy tạo danh mục đầu tiên!
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: STOCK HEALTH & AT-RISK */}
        <TabsContent value="stock" className="space-y-4">
          <Card className="border-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <h2 className="text-sm font-bold text-foreground">Giám sát Nguyên liệu Theo Món</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Hệ thống tự động tính toán tồn kho của từng nguyên liệu trong công thức. Nếu nguyên liệu bị thiếu hoặc chạm ngưỡng cảnh báo, bạn có thể tạm ngưng món hoặc chuyển tới màn hình Kho để nhập hàng.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-bold text-foreground">
                Các món cần lưu ý nguyên liệu ({stockMetrics.insufficientCount + stockMetrics.lowCount})
              </CardTitle>
              <Link to="/staff/inventory">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Boxes className="h-4 w-4" />
                  Mở quản lý kho
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-y border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Món</th>
                      <th className="px-4 py-3">Tình trạng</th>
                      <th className="px-4 py-3">Nguyên liệu bị thiếu / chạm ngưỡng</th>
                      <th className="px-4 py-3 text-center">Trạng thái bán</th>
                      <th className="px-4 py-3 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stockStatusQuery.data?.list
                      .filter((item) => item.stockStatus === 'INSUFFICIENT' || item.stockStatus === 'LOW')
                      .map((item) => (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3.5 font-bold text-foreground">{item.name}</td>
                          <td className="px-4 py-3.5">
                            {item.stockStatus === 'INSUFFICIENT' ? (
                              <Badge variant="destructive">Hết nguyên liệu</Badge>
                            ) : (
                              <Badge variant="outline" className="border-amber-500/50 text-amber-600 bg-amber-500/10">
                                Sắp hết nguyên liệu
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap gap-1.5">
                              {item.atRiskIngredients.map((ing) => (
                                <span
                                  key={ing.id}
                                  className="inline-flex items-center rounded-md border border-border bg-card px-2 py-0.5 text-xs text-foreground font-medium"
                                >
                                  {ing.name}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <Badge variant={item.isAvailable ? 'success' : 'secondary'}>
                              {item.isAvailable ? 'Đang bật bán' : 'Đã ngưng bán'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {canUpdate && item.isAvailable && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  toggleMutation.mutate({ id: item.id, isAvailable: false })
                                }
                                disabled={toggleMutation.isPending}
                                className="text-xs text-destructive hover:bg-destructive/10"
                              >
                                Tắt bán ngay
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {stockMetrics.insufficientCount === 0 && stockMetrics.lowCount === 0 && (
                <div className="p-8 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
                  <p className="mt-2 font-semibold text-foreground">
                    Tất cả các món đều đủ nguyên liệu!
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Không có món nào bị cảnh báo thiếu kho tại thời điểm hiện tại.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG: TẠO MÓN MỚI */}
      {createItemOpen && (
        <CreateMenuItemModal
          categories={categoriesQuery.data?.list ?? []}
          stations={stationsQuery.data?.list ?? []}
          onClose={() => setCreateItemOpen(false)}
          onSuccess={() => {
            setCreateItemOpen(false)
            void queryClient.invalidateQueries({
              queryKey: ['private', employee.id, 'admin-menu-items'],
            })
            void queryClient.invalidateQueries({
              queryKey: ['private', employee.id, 'admin-menu-stock'],
            })
          }}
        />
      )}

      {/* DIALOG: SỬA MÓN */}
      {editingItem && (
        <EditMenuItemModal
          item={editingItem}
          categories={categoriesQuery.data?.list ?? []}
          stations={stationsQuery.data?.list ?? []}
          onClose={() => setEditingItem(null)}
          onSuccess={() => {
            setEditingItem(null)
            void queryClient.invalidateQueries({
              queryKey: ['private', employee.id, 'admin-menu-items'],
            })
            void queryClient.invalidateQueries({
              queryKey: ['private', employee.id, 'admin-menu-stock'],
            })
          }}
        />
      )}

      {/* DIALOG: XÓA MÓN */}
      {deletingItem && (
        <DeleteMenuItemModal
          item={deletingItem}
          onClose={() => setDeletingItem(null)}
          onSuccess={() => {
            setDeletingItem(null)
            void queryClient.invalidateQueries({
              queryKey: ['private', employee.id, 'admin-menu-items'],
            })
            void queryClient.invalidateQueries({
              queryKey: ['private', employee.id, 'admin-menu-stock'],
            })
          }}
        />
      )}

      {/* DIALOG: TẠO DANH MỤC */}
      {createCategoryOpen && (
        <CreateCategoryModal
          onClose={() => setCreateCategoryOpen(false)}
          onSuccess={() => {
            setCreateCategoryOpen(false)
            void queryClient.invalidateQueries({
              queryKey: ['private', employee.id, 'admin-categories'],
            })
          }}
        />
      )}

      {/* DIALOG: SỬA DANH MỤC */}
      {editingCategory && (
        <EditCategoryModal
          category={editingCategory}
          onClose={() => setEditingCategory(null)}
          onSuccess={() => {
            setEditingCategory(null)
            void queryClient.invalidateQueries({
              queryKey: ['private', employee.id, 'admin-categories'],
            })
          }}
        />
      )}

      {/* DIALOG: XÓA DANH MỤC */}
      {deletingCategory && (
        <DeleteCategoryModal
          category={deletingCategory}
          onClose={() => setDeletingCategory(null)}
          onSuccess={() => {
            setDeletingCategory(null)
            void queryClient.invalidateQueries({
              queryKey: ['private', employee.id, 'admin-categories'],
            })
          }}
        />
      )}

      {/* DIALOG: CÔNG THỨC NGUYÊN LIỆU (RECIPE) */}
      {recipeItem && (
        <RecipeModal
          item={recipeItem}
          employeeId={employee.id}
          onClose={() => setRecipeItem(null)}
          onSuccess={() => {
            setRecipeItem(null)
            void queryClient.invalidateQueries({
              queryKey: ['private', employee.id, 'admin-menu-stock'],
            })
          }}
        />
      )}

      {/* DIALOG: TÙY CHỌN MÓN (OPTIONS: SIZE, ĐÁ, ĐƯỜNG, TOPPING) */}
      {optionsItem && (
        <OptionsModal
          item={optionsItem}
          employeeId={employee.id}
          onClose={() => setOptionsItem(null)}
          onSuccess={() => {
            setOptionsItem(null)
          }}
        />
      )}
    </div>
  )
}

// -------------------------------------------------------------
// SUB-MODALS IMPLEMENTATION
// -------------------------------------------------------------

function CreateMenuItemModal({
  categories,
  stations,
  onClose,
  onSuccess,
}: {
  categories: AdminCategory[]
  stations: Array<{ id: string; name: string }>
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [kitchenStationId, setKitchenStationId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      createMenuItem({
        name: name.trim(),
        price: price.trim(),
        categoryId,
        kitchenStationId: kitchenStationId || null,
      }),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Vui lòng nhập tên món')
    if (!price.trim() || isNaN(Number(price))) return setError('Giá món không hợp lệ')
    if (!categoryId) return setError('Vui lòng chọn danh mục món')
    setError(null)
    mutation.mutate()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo món mới</DialogTitle>
          <DialogDescription>Thêm món ăn hoặc thức uống mới vào thực đơn.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Tên món *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Cà phê Muối Cốt dừa"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Đơn giá (VNĐ) *</label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="VD: 35000"
                min="0"
                step="1000"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Danh mục *</label>
              <select
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Quầy chế biến phụ trách</label>
            <select
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
              value={kitchenStationId}
              onChange={(e) => setKitchenStationId(e.target.value)}
            >
              <option value="">Không gán quầy cụ thể</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Đang tạo...' : 'Tạo món'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditMenuItemModal({
  item,
  categories,
  stations,
  onClose,
  onSuccess,
}: {
  item: AdminMenuItem
  categories: AdminCategory[]
  stations: Array<{ id: string; name: string }>
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState(item.name)
  const [price, setPrice] = useState(String(item.price))
  const [categoryId, setCategoryId] = useState(item.categoryId)
  const [kitchenStationId, setKitchenStationId] = useState<string>(item.kitchenStationId ?? '')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      updateMenuItem(item.id, {
        name: name.trim(),
        price: price.trim(),
        categoryId,
        kitchenStationId: kitchenStationId || null,
      }),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Vui lòng nhập tên món')
    if (!price.trim() || isNaN(Number(price))) return setError('Giá món không hợp lệ')
    setError(null)
    mutation.mutate()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cập nhật thông tin món</DialogTitle>
          <DialogDescription>Chỉnh sửa tên, giá và danh mục của món ăn.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Tên món *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Cà phê Muối"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Đơn giá (VNĐ) *</label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min="0"
                step="1000"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Danh mục *</label>
              <select
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Quầy chế biến phụ trách</label>
            <select
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
              value={kitchenStationId}
              onChange={(e) => setKitchenStationId(e.target.value)}
            >
              <option value="">Không gán quầy cụ thể</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteMenuItemModal({
  item,
  onClose,
  onSuccess,
}: {
  item: AdminMenuItem
  onClose: () => void
  onSuccess: () => void
}) {
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => deleteMenuItem(item.id),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive">Xác nhận xóa món</DialogTitle>
          <DialogDescription>
            Bạn có chắc chắn muốn xóa món <span className="font-bold text-foreground">"{item.name}"</span> khỏi thực đơn? Thao tác này sẽ ẩn món khỏi danh sách bán.
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Đang xóa...' : 'Xóa món'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateCategoryModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      createCategory({
        name: name.trim(),
        description: description.trim() || null,
      }),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Vui lòng nhập tên danh mục')
    setError(null)
    mutation.mutate()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm danh mục mới</DialogTitle>
          <DialogDescription>Tạo nhóm phân loại cho các món trong quán.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Tên danh mục *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Cà phê Truyền thống"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Mô tả (tùy chọn)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="VD: Các món cà phê pha phin nguyên chất..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Đang tạo...' : 'Tạo danh mục'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditCategoryModal({
  category,
  onClose,
  onSuccess,
}: {
  category: AdminCategory
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState(category.name)
  const [description, setDescription] = useState(category.description ?? '')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      updateCategory(category.id, {
        name: name.trim(),
        description: description.trim() || null,
      }),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Vui lòng nhập tên danh mục')
    setError(null)
    mutation.mutate()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chỉnh sửa danh mục</DialogTitle>
          <DialogDescription>Cập nhật tên hoặc mô tả phân loại món.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Tên danh mục *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Mô tả</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteCategoryModal({
  category,
  onClose,
  onSuccess,
}: {
  category: AdminCategory
  onClose: () => void
  onSuccess: () => void
}) {
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => deleteCategory(category.id),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive">Xóa danh mục</DialogTitle>
          <DialogDescription>
            Bạn có chắc chắn muốn xóa danh mục <span className="font-bold text-foreground">"{category.name}"</span>?
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Đang xóa...' : 'Xác nhận xóa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// -------------------------------------------------------------
// RECIPE BUILDER MODAL (QUẢN LÝ ĐỊNH LƯỢNG NGUYÊN LIỆU KHO)
// -------------------------------------------------------------

function RecipeModal({
  item,
  employeeId,
  onClose,
  onSuccess,
}: {
  item: AdminMenuItem
  employeeId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [ingredients, setIngredients] = useState<
    Array<{ inventoryItemId: string; name: string; unitName?: string; quantity: string }>
  >([])
  const [selectedInventoryId, setSelectedInventoryId] = useState('')
  const [addQty, setAddQty] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Query recipe from backend
  const recipeQuery = useQuery({
    queryKey: ['private', employeeId, 'menu-recipe', item.id],
    queryFn: async ({ signal }) => {
      const res = await getItemRecipe(item.id, signal)
      setIngredients(
        res.ingredients.map((ing) => ({
          inventoryItemId: ing.inventoryItemId,
          name: ing.inventoryItem.name,
          unitName: ing.inventoryItem.unit?.name,
          quantity: String(ing.quantity),
        })),
      )
      return res
    },
  })

  // Query inventory items to pick
  const inventoryQuery = useQuery({
    queryKey: ['private', employeeId, 'inventory-items-picker'],
    queryFn: ({ signal }) => getInventoryItems({ page: 1, itemPerPage: 100 }, signal),
  })

  const mutation = useMutation({
    mutationFn: () =>
      replaceItemRecipe(
        item.id,
        ingredients.map((i) => ({
          inventoryItemId: i.inventoryItemId,
          quantity: i.quantity,
        })),
      ),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  function handleAddIngredient() {
    if (!selectedInventoryId) return
    if (!addQty || Number(addQty) <= 0) {
      setError('Vui lòng nhập định lượng lớn hơn 0')
      return
    }

    if (ingredients.some((i) => i.inventoryItemId === selectedInventoryId)) {
      setError('Nguyên liệu này đã có trong công thức')
      return
    }

    const inv = inventoryQuery.data?.list.find((i) => i.id === selectedInventoryId)
    if (!inv) return

    setIngredients((prev) => [
      ...prev,
      {
        inventoryItemId: inv.id,
        name: inv.name,
        unitName: inv.unit?.name ?? '',
        quantity: addQty,
      },
    ])
    setSelectedInventoryId('')
    setAddQty('')
    setError(null)
  }

  function handleRemoveIngredient(id: string) {
    setIngredients((prev) => prev.filter((i) => i.inventoryItemId !== id))
  }

  function handleUpdateQuantity(id: string, qty: string) {
    setIngredients((prev) =>
      prev.map((i) => (i.inventoryItemId === id ? { ...i, quantity: qty } : i)),
    )
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" />
            Định lượng công thức: {item.name}
          </DialogTitle>
          <DialogDescription>
            Thiết lập lượng nguyên liệu kho tiêu hao cho mỗi phần đồ uống/món ăn phục vụ.
          </DialogDescription>
        </DialogHeader>

        {recipeQuery.isPending ? (
          <div className="py-8 text-center text-muted-foreground animate-pulse">
            Đang tải công thức...
          </div>
        ) : (
          <div className="space-y-4">
            {error && <p className="text-xs text-destructive">{error}</p>}

            {/* Bảng nguyên liệu hiện có */}
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs font-bold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5">Nguyên liệu kho</th>
                    <th className="px-4 py-2.5 text-center">Đơn vị</th>
                    <th className="px-4 py-2.5 text-right w-36">Định lượng / phần</th>
                    <th className="px-4 py-2.5 text-right w-16">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ingredients.map((ing) => (
                    <tr key={ing.inventoryItemId} className="hover:bg-muted/20">
                      <td className="px-4 py-2.5 font-semibold text-foreground">{ing.name}</td>
                      <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">
                        {ing.unitName || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Input
                          type="number"
                          step="0.001"
                          min="0.0001"
                          value={ing.quantity}
                          onChange={(e) =>
                            handleUpdateQuantity(ing.inventoryItemId, e.target.value)
                          }
                          className="h-8 text-right text-xs"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveIngredient(ing.inventoryItemId)}
                          className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!ingredients.length && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                        Món này chưa có công thức. Hãy thêm nguyên liệu phía dưới.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bộ chọn thêm nguyên liệu */}
            <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
              <p className="text-xs font-bold text-foreground">Thêm nguyên liệu vào công thức</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 items-center">
                <div className="sm:col-span-7">
                  <select
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-xs shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
                    value={selectedInventoryId}
                    onChange={(e) => setSelectedInventoryId(e.target.value)}
                    aria-label="Chọn nguyên liệu kho"
                  >
                    <option value="">-- Chọn nguyên liệu từ kho --</option>
                    {inventoryQuery.data?.list
                      .filter((i) => !ingredients.some((ing) => ing.inventoryItemId === i.id))
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.unit?.name ?? 'ĐV'}) - Tồn: {i.stock}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <Input
                    type="number"
                    step="0.001"
                    min="0.0001"
                    placeholder="Số lượng"
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddIngredient}
                    disabled={!selectedInventoryId || !addQty}
                    className="w-full h-8 text-xs gap-1"
                  >
                    <Plus className="h-3 w-3" /> Thêm
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || recipeQuery.isPending}
          >
            {mutation.isPending ? 'Đang lưu...' : 'Lưu công thức'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// -------------------------------------------------------------
// OPTIONS BUILDER MODAL (SIZE, ĐÁ, ĐƯỜNG, TOPPINGS)
// -------------------------------------------------------------

function OptionsModal({
  item,
  employeeId,
  onClose,
  onSuccess,
}: {
  item: AdminMenuItem
  employeeId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [groups, setGroups] = useState<
    Array<{
      name: string
      minSelected: number
      maxSelected: number
      options: Array<{ name: string; priceDelta: string }>
    }>
  >([])
  const [error, setError] = useState<string | null>(null)

  // Query options from backend
  const optionsQuery = useQuery({
    queryKey: ['private', employeeId, 'menu-options', item.id],
    queryFn: async ({ signal }) => {
      const res = await getItemOptions(item.id, signal)
      setGroups(
        res.optionGroups.map((g) => ({
          name: g.name,
          minSelected: g.minSelected,
          maxSelected: g.maxSelected,
          options: g.options.map((o) => ({
            name: o.name,
            priceDelta: String(o.priceDelta),
          })),
        })),
      )
      return res
    },
  })

  const mutation = useMutation({
    mutationFn: () =>
      replaceItemOptions(
        item.id,
        groups.map((g) => ({
          name: g.name.trim(),
          minSelected: g.minSelected,
          maxSelected: g.maxSelected,
          options: g.options.map((o) => ({
            name: o.name.trim(),
            priceDelta: o.priceDelta.trim() || '0',
            ingredients: [],
          })),
        })),
      ),
    onSuccess,
    onError: (err) => setError(errorMessage(err)),
  })

  function handleAddGroup() {
    if (groups.length >= 5) {
      setError('Tối đa 5 nhóm tùy chọn cho mỗi món')
      return
    }
    setGroups((prev) => [
      ...prev,
      {
        name: `Nhóm tùy chọn ${prev.length + 1}`,
        minSelected: 0,
        maxSelected: 1,
        options: [{ name: 'Lựa chọn 1', priceDelta: '0' }],
      },
    ])
  }

  function handleRemoveGroup(groupIndex: number) {
    setGroups((prev) => prev.filter((_, idx) => idx !== groupIndex))
  }

  function handleAddOption(groupIndex: number) {
    setGroups((prev) =>
      prev.map((g, idx) => {
        if (idx !== groupIndex) return g
        if (g.options.length >= 10) return g
        return {
          ...g,
          options: [...g.options, { name: `Lựa chọn ${g.options.length + 1}`, priceDelta: '0' }],
        }
      }),
    )
  }

  function handleRemoveOption(groupIndex: number, optionIndex: number) {
    setGroups((prev) =>
      prev.map((g, idx) => {
        if (idx !== groupIndex) return g
        if (g.options.length <= 1) return g // Phải có ít nhất 1 option
        return {
          ...g,
          options: g.options.filter((_, oIdx) => oIdx !== optionIndex),
        }
      }),
    )
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-primary" />
            Cấu hình tùy chọn: {item.name}
          </DialogTitle>
          <DialogDescription>
            Tạo các nhóm tùy chọn (Size, Đường, Đá, Topping) và đơn giá cộng thêm (price delta).
          </DialogDescription>
        </DialogHeader>

        {optionsQuery.isPending ? (
          <div className="py-8 text-center text-muted-foreground animate-pulse">
            Đang tải tùy chọn món...
          </div>
        ) : (
          <div className="space-y-4">
            {error && <p className="text-xs text-destructive">{error}</p>}

            {groups.map((group, gIdx) => (
              <div key={gIdx} className="rounded-lg border border-border bg-card p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Input
                    value={group.name}
                    onChange={(e) => {
                      const val = e.target.value
                      setGroups((prev) =>
                        prev.map((g, idx) => (idx === gIdx ? { ...g, name: val } : g)),
                      )
                    }}
                    placeholder="Tên nhóm (VD: Kích cỡ / Size, Mức đường)"
                    className="font-bold text-sm h-8 max-w-xs"
                  />

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Chọn tối thiểu:</span>
                    <Input
                      type="number"
                      min="0"
                      max="20"
                      value={group.minSelected}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        setGroups((prev) =>
                          prev.map((g, idx) => (idx === gIdx ? { ...g, minSelected: val } : g)),
                        )
                      }}
                      className="w-16 h-7 text-center text-xs"
                    />

                    <span>Tối đa:</span>
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      value={group.maxSelected}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        setGroups((prev) =>
                          prev.map((g, idx) => (idx === gIdx ? { ...g, maxSelected: val } : g)),
                        )
                      }}
                      className="w-16 h-7 text-center text-xs"
                    />

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveGroup(gIdx)}
                      className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Sub Options */}
                <div className="pl-3 border-l-2 border-primary/20 space-y-2">
                  {group.options.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2">
                      <Input
                        value={opt.name}
                        onChange={(e) => {
                          const val = e.target.value
                          setGroups((prev) =>
                            prev.map((g, idx) => {
                              if (idx !== gIdx) return g
                              return {
                                ...g,
                                options: g.options.map((o, oSub) =>
                                  oSub === oIdx ? { ...o, name: val } : o,
                                ),
                              }
                            }),
                          )
                        }}
                        placeholder="Tên lựa chọn (VD: Size L, 50% Đá)"
                        className="text-xs h-7 flex-1"
                      />

                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">+₫</span>
                        <Input
                          type="number"
                          step="1000"
                          value={opt.priceDelta}
                          onChange={(e) => {
                            const val = e.target.value
                            setGroups((prev) =>
                              prev.map((g, idx) => {
                                if (idx !== gIdx) return g
                                return {
                                  ...g,
                                  options: g.options.map((o, oSub) =>
                                    oSub === oIdx ? { ...o, priceDelta: val } : o,
                                  ),
                                }
                              }),
                            )
                          }}
                          className="w-24 text-right text-xs h-7"
                        />
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveOption(gIdx, oIdx)}
                        disabled={group.options.length <= 1}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}

                  {group.options.length < 10 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAddOption(gIdx)}
                      className="h-6 text-xs text-primary gap-1"
                    >
                      <Plus className="h-3 w-3" /> Thêm lựa chọn
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {groups.length < 5 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddGroup}
                className="w-full text-xs gap-1.5 border-dashed"
              >
                <Plus className="h-4 w-4" /> Thêm nhóm tùy chọn mới
              </Button>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || optionsQuery.isPending}
          >
            {mutation.isPending ? 'Đang lưu...' : 'Lưu tùy chọn'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
