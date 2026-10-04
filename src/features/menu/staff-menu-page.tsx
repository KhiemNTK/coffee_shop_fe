import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import {
  AlertTriangle,
  BookOpen,
  Boxes,
  CheckCircle2,
  Coffee,
  FolderTree,
  Plus,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { type Session } from '../auth/session'
import {
  type AdminCategory,
  type AdminMenuItem,
  getAdminCategories,
  getAdminItems,
  getItemStockStatus,
  getKitchenStationsList,
  updateMenuItemAvailability,
} from './menu.admin.api'
import { Card, CardContent } from '../../shared/ui/card'
import { Button } from '../../shared/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../shared/ui/tabs'
import { cn } from '../../shared/ui/utils'
import { MenuItemsTab } from './components/menu-items-tab'
import { CategoriesTab } from './components/categories-tab'
import { StockAlertTab } from './components/stock-alert-tab'
import { CreateMenuItemModal, EditMenuItemModal, DeleteMenuItemModal } from './components/menu-item-modals'
import { CreateCategoryModal, EditCategoryModal, DeleteCategoryModal } from './components/category-modals'
import { RecipeModal } from './components/recipe-modal'
import { OptionsModal } from './components/options-modal'

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

        <TabsContent value="items">
          <MenuItemsTab
            itemsQuery={itemsQuery}
            categoriesList={categoriesQuery.data?.list ?? []}
            stockStatusList={stockStatusQuery.data?.list ?? []}
            keyword={keyword}
            onKeywordChange={setKeyword}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            availabilityFilter={availabilityFilter}
            onAvailabilityFilterChange={setAvailabilityFilter}
            page={page}
            onPageChange={setPage}
            canUpdate={canUpdate}
            canDelete={canDelete}
            toggleMutation={toggleMutation}
            onRecipeClick={setRecipeItem}
            onOptionsClick={setOptionsItem}
            onEditClick={setEditingItem}
            onDeleteClick={setDeletingItem}
          />
        </TabsContent>

        <TabsContent value="categories">
          <CategoriesTab
            categoriesQuery={categoriesQuery}
            canCreate={canCreate}
            canUpdate={canUpdate}
            canDelete={canDelete}
            onCreateClick={() => setCreateCategoryOpen(true)}
            onEditClick={setEditingCategory}
            onDeleteClick={setDeletingCategory}
          />
        </TabsContent>

        <TabsContent value="stock">
          <StockAlertTab
            stockStatusQuery={stockStatusQuery}
            stockMetrics={stockMetrics}
            canUpdate={canUpdate}
            toggleMutation={toggleMutation}
          />
        </TabsContent>
      </Tabs>

      {/* SUB-MODALS */}
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
