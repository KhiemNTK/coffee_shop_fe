import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ProcurementTab } from './components/procurement-tab'
import {
  AlertTriangle,
  Boxes,
  History,
  Plus,
  RefreshCw,
} from 'lucide-react'
import {
  getInventoryItems,
  getReorderAlerts,
  getInventoryCategories,
  getInventoryUnits,
  getInventoryTransactions,
  deleteInventoryItem,
  type InventoryItem,
  type ReorderAlertRow,
} from './inventory.api'
import { Badge, Button, cn } from '../../shared/ui'
import { InventoryKpis } from './components/inventory-kpis'
import { InventoryItemsTab } from './components/inventory-items-tab'
import { InventoryAlertsTab } from './components/inventory-alerts-tab'
import { InventoryTransactionsTab } from './components/inventory-transactions-tab'
import {
  ImportDialog,
  ExportDialog,
  CreateItemDialog,
  EditItemDialog,
  DeleteInventoryItemDialog,
} from './components/inventory-modals'

export default function InventoryPage() {
  const queryClient = useQueryClient()

  // Tab: 'items' | 'alerts' | 'transactions'
  const [activeTab, setActiveTab] = useState<'items' | 'alerts' | 'transactions' | 'procurement'>('items')

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
    queryKey: [
      'inventory-items',
      { page, keyword, categoryId: selectedCategoryId, unitId: selectedUnitId, lowStockOnly },
    ],
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
      <InventoryKpis
        totalItems={itemsQuery.data?.totalItems ?? 0}
        alertCount={alertCount}
        categoriesCount={categoriesQuery.data?.length ?? 0}
      />

      {/* Tabs Control */}
      <div className="flex flex-wrap border-b border-border gap-2">
        <Button variant={activeTab === 'procurement' ? 'default' : 'outline'} onClick={() => setActiveTab('procurement')}>Mua hàng & Kiểm kê</Button>
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

      {activeTab === 'procurement' && <ProcurementTab />}

      {/* TAB 1: ITEMS INVENTORY */}
      {activeTab === 'items' && (
        <InventoryItemsTab
          keyword={keyword}
          setKeyword={setKeyword}
          selectedCategoryId={selectedCategoryId}
          setSelectedCategoryId={setSelectedCategoryId}
          selectedUnitId={selectedUnitId}
          setSelectedUnitId={setSelectedUnitId}
          lowStockOnly={lowStockOnly}
          setLowStockOnly={setLowStockOnly}
          page={page}
          setPage={setPage}
          categories={categoriesQuery.data ?? []}
          units={unitsQuery.data ?? []}
          data={itemsQuery.data}
          isLoading={itemsQuery.isLoading}
          isError={itemsQuery.isError}
          error={itemsQuery.error}
          isFetching={itemsQuery.isFetching}
          onRefetch={() => void itemsQuery.refetch()}
          onImport={(item) => setImportItem(item)}
          onExport={(item) => setExportItem(item)}
          onEdit={(item) => setEditItem(item)}
          onDelete={(item) => setDeleteItem(item)}
        />
      )}

      {/* TAB 2: REORDER ALERTS */}
      {activeTab === 'alerts' && (
        <InventoryAlertsTab
          data={alertsQuery.data}
          isLoading={alertsQuery.isLoading}
          onImport={(alert) => setImportItem(alert)}
        />
      )}

      {/* TAB 3: TRANSACTIONS HISTORY */}
      {activeTab === 'transactions' && (
        <InventoryTransactionsTab
          data={transactionsQuery.data}
          isLoading={transactionsQuery.isLoading}
        />
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
        <DeleteInventoryItemDialog
          item={deleteItem}
          isPending={deleteMutation.isPending}
          onClose={() => setDeleteItem(null)}
          onConfirm={(id) => deleteMutation.mutate(id)}
        />
      )}
    </div>
  )
}
