import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { BookOpen, Boxes, Coffee, FolderTree, Plus, RefreshCw } from 'lucide-react'
import { type Session } from '../auth/session'
import { type AdminCategory, type AdminMenuItem, getAdminCategories, getAdminItems, getItemStockStatus, updateMenuItemAvailability } from './menu.admin.api'
import { errorMessage } from '../../shared/api/client'
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '../../shared/ui'
import { MenuItemsTab } from './components/menu-items-tab'
import { CategoriesTab } from './components/categories-tab'
import { StockAlertTab } from './components/stock-alert-tab'
import { CreateMenuItemModal, EditMenuItemModal, DeleteMenuItemModal } from './components/menu-item-modals'
import { CreateCategoryModal, EditCategoryModal, DeleteCategoryModal } from './components/category-modals'
import { RecipeModal } from './components/recipe-modal'
import { OptionsModal } from './components/options-modal'
import { type CatalogSelection } from './components/catalog-picker'

export default function StaffMenuPage() {
  const { employee, authorization } = useOutletContext<Session>()
  const queryClient = useQueryClient()
  const permissions = authorization.permissionKeys
  const canCreate = permissions.includes('/menu_create')
  const canUpdate = permissions.includes('/menu_update')
  const canDelete = permissions.includes('/menu_delete')
  const canReadStations = permissions.includes('/kitchen-stations_read')

  function refreshMenu() {
    void queryClient.invalidateQueries({ queryKey: ['public-menu'] })
    for (const root of ['admin-menu-items', 'admin-menu-stock']) {
      void queryClient.invalidateQueries({ queryKey: ['private', employee.id, root] })
    }
  }

  function refreshCategories() {
    refreshMenu()
    void queryClient.invalidateQueries({ queryKey: ['private', employee.id, 'admin-categories'] })
  }

  const [activeTab, setActiveTab] = useState<'items' | 'categories' | 'stock'>('items')
  const [keyword, setKeyword] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<CatalogSelection>(null)
  const [availabilityFilter, setAvailabilityFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [page, setPage] = useState(1)
  const [categoryKeyword, setCategoryKeyword] = useState('')
  const [categoryPage, setCategoryPage] = useState(1)
  const [stockKeyword, setStockKeyword] = useState('')
  const [stockPage, setStockPage] = useState(1)
  const [createItemOpen, setCreateItemOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AdminMenuItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<AdminMenuItem | null>(null)
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<AdminCategory | null>(null)
  const [recipeItem, setRecipeItem] = useState<AdminMenuItem | null>(null)
  const [optionsItem, setOptionsItem] = useState<AdminMenuItem | null>(null)

  const categoriesQuery = useQuery({
    queryKey: ['private', employee.id, 'admin-categories', 'list', categoryPage, categoryKeyword],
    queryFn: ({ signal }) => getAdminCategories({ page: categoryPage, itemPerPage: 15, keyword: categoryKeyword }, signal),
    enabled: activeTab === 'categories',
  })
  const itemsQuery = useQuery({
    queryKey: ['private', employee.id, 'admin-menu-items', page, keyword, categoryFilter?.id, availabilityFilter],
    queryFn: ({ signal }) => getAdminItems({ page, itemPerPage: 15, keyword, categoryId: categoryFilter?.id,
      isAvailable: availabilityFilter === 'ALL' ? undefined : availabilityFilter === 'ACTIVE' }, signal),
    enabled: activeTab === 'items',
  })
  const stockStatusQuery = useQuery({
    queryKey: ['private', employee.id, 'admin-menu-stock', stockPage, stockKeyword],
    queryFn: ({ signal }) => getItemStockStatus({ page: stockPage, itemPerPage: 15, keyword: stockKeyword }, signal),
    enabled: activeTab === 'stock',
  })
  const activeQuery = activeTab === 'items' ? itemsQuery : activeTab === 'categories' ? categoriesQuery : stockStatusQuery
  const toggleMutation = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) => updateMenuItemAvailability(id, isAvailable),
    onSettled: refreshMenu,
  })

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><BookOpen className="h-6 w-6 shrink-0" />Thực đơn & công thức</h1>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void activeQuery.refetch()} disabled={activeQuery.isFetching}>
          <RefreshCw className="mr-2 h-4 w-4" />Làm mới</Button>
        {canCreate && <>
          <Button variant="outline" size="sm" onClick={() => setCreateCategoryOpen(true)}><FolderTree className="mr-2 h-4 w-4" />Thêm danh mục</Button>
          <Button size="sm" onClick={() => setCreateItemOpen(true)}><Plus className="mr-2 h-4 w-4" />Tạo món mới</Button>
        </>}
      </div>
    </div>
    {toggleMutation.error && <p role="alert" className="text-sm text-destructive">{errorMessage(toggleMutation.error)}</p>}
    <Tabs value={activeTab} onValueChange={value => setActiveTab(value as typeof activeTab)}>
      <TabsList>
        <TabsTrigger value="items" className="gap-2"><Coffee className="h-4 w-4" />Danh sách món</TabsTrigger>
        <TabsTrigger value="categories" className="gap-2"><FolderTree className="h-4 w-4" />Danh mục</TabsTrigger>
        <TabsTrigger value="stock" className="gap-2"><Boxes className="h-4 w-4" />Nguyên liệu theo món</TabsTrigger>
      </TabsList>
      <TabsContent value="items"><MenuItemsTab itemsQuery={itemsQuery} employeeId={employee.id}
        keyword={keyword} onKeywordChange={setKeyword} categoryFilter={categoryFilter} onCategoryFilterChange={setCategoryFilter}
        availabilityFilter={availabilityFilter} onAvailabilityFilterChange={setAvailabilityFilter} page={page} onPageChange={setPage}
        canUpdate={canUpdate} canDelete={canDelete} toggleMutation={toggleMutation} onRecipeClick={setRecipeItem}
        onOptionsClick={setOptionsItem} onEditClick={setEditingItem} onDeleteClick={setDeletingItem} /></TabsContent>
      <TabsContent value="categories"><CategoriesTab categoriesQuery={categoriesQuery}
        keyword={categoryKeyword} onKeywordChange={setCategoryKeyword} page={categoryPage} onPageChange={setCategoryPage}
        canCreate={canCreate} canUpdate={canUpdate} canDelete={canDelete} onCreateClick={() => setCreateCategoryOpen(true)}
        onEditClick={setEditingCategory} onDeleteClick={setDeletingCategory} /></TabsContent>
      <TabsContent value="stock"><StockAlertTab stockStatusQuery={stockStatusQuery}
        keyword={stockKeyword} onKeywordChange={setStockKeyword} page={stockPage} onPageChange={setStockPage}
        canUpdate={canUpdate} toggleMutation={toggleMutation} /></TabsContent>
    </Tabs>
    {createItemOpen && <CreateMenuItemModal employeeId={employee.id} canReadStations={canReadStations}
      onClose={() => setCreateItemOpen(false)} onSuccess={() => setCreateItemOpen(false)} onSettled={refreshMenu} />}
    {editingItem && <EditMenuItemModal key={editingItem.id} item={editingItem} employeeId={employee.id} canReadStations={canReadStations}
      onClose={() => setEditingItem(null)} onSuccess={() => setEditingItem(null)} onSettled={refreshMenu} />}
    {deletingItem && <DeleteMenuItemModal item={deletingItem} onClose={() => setDeletingItem(null)}
      onSuccess={() => { setDeletingItem(null); refreshMenu() }} />}
    {createCategoryOpen && <CreateCategoryModal onClose={() => setCreateCategoryOpen(false)}
      onSuccess={() => { setCreateCategoryOpen(false); refreshCategories() }} />}
    {editingCategory && <EditCategoryModal key={editingCategory.id} category={editingCategory} onClose={() => setEditingCategory(null)}
      onSuccess={() => { setEditingCategory(null); refreshCategories() }} />}
    {deletingCategory && <DeleteCategoryModal category={deletingCategory} onClose={() => setDeletingCategory(null)}
      onSuccess={() => { setDeletingCategory(null); refreshCategories() }} />}
    {recipeItem && <RecipeModal key={recipeItem.id} item={recipeItem} employeeId={employee.id} editable={canUpdate}
      canReadInventory={permissions.includes('/inventory_read')} onClose={() => setRecipeItem(null)} onSuccess={() => {
        setRecipeItem(null); refreshMenu()
        void queryClient.invalidateQueries({ queryKey: ['private', employee.id, 'menu-recipe', recipeItem.id] })
      }} />}
    {optionsItem && <OptionsModal key={optionsItem.id} item={optionsItem} employeeId={employee.id} editable={canUpdate}
      canReadInventory={permissions.includes('/inventory_read')} onClose={() => setOptionsItem(null)} onSuccess={() => {
        setOptionsItem(null); refreshMenu()
        void queryClient.invalidateQueries({ queryKey: ['private', employee.id, 'menu-options', optionsItem.id] })
      }} />}
  </div>
}
