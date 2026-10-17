import { useState } from 'react'
import { Pagination } from '../../shared/ui/pagination'
import { useOutletContext } from 'react-router-dom'
import type { Session } from '../auth/session'
import { InventoryBulkTab, InventoryWasteTab } from './components/inventory-operations'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ProcurementTab } from './components/procurement-tab'
import { InventoryTaxonomy } from './components/inventory-taxonomy'
import { AlertTriangle, Boxes, History, Plus, RefreshCw } from 'lucide-react'
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
import { Badge, Button, OperationsHeader, cn } from '../../shared/ui'
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
  const { employee, authorization } = useOutletContext<Session>()

  const canCreate = authorization.permissionKeys.includes('/inventory_create')
  const canUpdate = authorization.permissionKeys.includes('/inventory_update')
  const canDelete = authorization.permissionKeys.includes('/inventory_delete')
  const canAdjust = authorization.permissionKeys.includes('/inventory_stock_adjust')

  // Tab: 'items' | 'alerts' | 'transactions'
  const [activeTab, setActiveTab] = useState<
    'items' | 'alerts' | 'transactions' | 'procurement' | 'waste' | 'bulk' | 'taxonomy'
  >('items')

  // Search & Filter state
  const [keyword, setKeyword] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [transactionPage, setTransactionPage] = useState(1)
  const [transactionType, setTransactionType] = useState<'IMPORT' | 'EXPORT' | ''>('')

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
      {
        page,
        keyword,
        categoryId: selectedCategoryId,
        unitId: selectedUnitId,
        lowStockOnly,
      },
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
    queryKey: ['inventory-transactions', employee.id, transactionPage, transactionType],
    queryFn: ({ signal }) =>
      getInventoryTransactions(
        { page: transactionPage, itemPerPage: 20, type: transactionType },
        signal,
      ),
    enabled: activeTab === 'transactions',
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInventoryItem(id),
    onSuccess: () => {
      setDeleteItem(null)
      void queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      void queryClient.invalidateQueries({
        queryKey: ['inventory-reorder-alerts'],
      })
    },
  })

  const alertCount = alertsQuery.isSuccess ? alertsQuery.data.totalItems : undefined

  return (
    <div className="admin-page space-y-5">
      <OperationsHeader
        title="Quản lý Kho & Nguyên vật liệu"
        meta="Tồn kho · Định mức · Nhập xuất nguyên liệu"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              className="min-h-10"
              onClick={() => {
                void itemsQuery.refetch()
                void alertsQuery.refetch()
                if (activeTab === 'transactions') void transactionsQuery.refetch()
              }}
              disabled={itemsQuery.isFetching}
            >
              <RefreshCw size={16} aria-hidden="true" />
              Làm mới
            </Button>
            {canCreate && (
              <Button type="button" className="min-h-10" onClick={() => setCreateDialogOpen(true)}>
                <Plus size={16} aria-hidden="true" />
                Thêm nguyên liệu
              </Button>
            )}
          </>
        }
      />
      {/* Overview Stats Cards */}
      <InventoryKpis
        totalItems={itemsQuery.isSuccess ? itemsQuery.data.totalItems : undefined}
        alertCount={alertCount}
        categoriesCount={categoriesQuery.isSuccess ? categoriesQuery.data.length : undefined}
      />
      {(categoriesQuery.isError || unitsQuery.isError) && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">
          Không tải được nhóm nguyên liệu hoặc đơn vị.
          <Button
            variant="outline"
            onClick={() => {
              void categoriesQuery.refetch()
              void unitsQuery.refetch()
            }}
          >
            Tải lại bộ lọc
          </Button>
        </div>
      )}

      {/* Tabs Control */}
      <div className="admin-tabs">
        <Button
          variant={activeTab === 'waste' ? 'default' : 'outline'}
          aria-pressed={activeTab === 'waste'}
          onClick={() => setActiveTab('waste')}
        >
          Hao hụt
        </Button>
        {authorization.permissionKeys.includes('/inventory_stock_adjust') && (
          <Button
            variant={activeTab === 'bulk' ? 'default' : 'outline'}
            aria-pressed={activeTab === 'bulk'}
            onClick={() => setActiveTab('bulk')}
          >
            Nhập / Xuất nhiều nguyên liệu
          </Button>
        )}
        <Button
          variant={activeTab === 'procurement' ? 'default' : 'outline'}
          aria-pressed={activeTab === 'procurement'}
          onClick={() => setActiveTab('procurement')}
        >
          Mua hàng & Kiểm kê
        </Button>
        <button
          type="button"
          aria-pressed={activeTab === 'items'}
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
          aria-pressed={activeTab === 'alerts'}
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
          {alertCount !== undefined && alertCount > 0 && (
            <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
              {alertCount}
            </Badge>
          )}
        </button>

        <button
          type="button"
          aria-pressed={activeTab === 'transactions'}
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

      <Button
        variant="outline"
        onClick={() => setActiveTab(activeTab === 'taxonomy' ? 'items' : 'taxonomy')}
      >
        Nhóm nguyên liệu & đơn vị
      </Button>
      {activeTab === 'taxonomy' && <InventoryTaxonomy />}
      {activeTab === 'procurement' && <ProcurementTab />}
      {activeTab === 'waste' && <InventoryWasteTab />}
      {activeTab === 'bulk' && <InventoryBulkTab />}

      {/* TAB 1: ITEMS INVENTORY */}
      {activeTab === 'items' && (
        <InventoryItemsTab
          canAdjust={canAdjust}
          canUpdate={canUpdate}
          canDelete={canDelete}
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
      {activeTab === 'alerts' &&
        (alertsQuery.isError ? (
          <div role="alert" className="space-y-3 border-l-4 border-destructive p-4">
            <p>Không tải được cảnh báo tồn kho.</p>
            <Button variant="outline" onClick={() => void alertsQuery.refetch()}>
              Thử lại
            </Button>
          </div>
        ) : (
          <InventoryAlertsTab
            canAdjust={canAdjust}
            data={alertsQuery.data}
            isLoading={alertsQuery.isLoading}
            onImport={(alert) => setImportItem(alert)}
          />
        ))}

      {/* TAB 3: TRANSACTIONS HISTORY */}
      {activeTab === 'transactions' && (
        <section aria-label="Lịch sử xuất nhập" className="space-y-3">
          <label className="block text-sm">
            Loại biến động
            <select
              className="ml-3 rounded-md border border-border p-2"
              value={transactionType}
              onChange={(event) => {
                setTransactionType(event.target.value as 'IMPORT' | 'EXPORT' | '')
                setTransactionPage(1)
              }}
            >
              <option value="">Tất cả</option>
              <option value="IMPORT">Nhập kho</option>
              <option value="EXPORT">Xuất kho</option>
            </select>
          </label>
          <InventoryTransactionsTab
            data={transactionsQuery.data}
            isLoading={transactionsQuery.isLoading}
            error={transactionsQuery.error}
            onRetry={() => void transactionsQuery.refetch()}
            isFetching={transactionsQuery.isFetching}
          />
          {!transactionsQuery.isError && transactionsQuery.data && (
            <>
              <p className="text-sm text-muted-foreground">
                {transactionsQuery.data.totalItems} giao dịch
              </p>
              <Pagination
                page={transactionPage}
                totalPages={transactionsQuery.data.totalPages}
                onPage={setTransactionPage}
                disabled={transactionsQuery.isFetching}
              />
            </>
          )}
        </section>
      )}

      {/* IMPORT MODAL */}
      {canAdjust && importItem && (
        <ImportDialog
          item={importItem}
          onClose={() => setImportItem(null)}
          onSuccess={() => {
            setImportItem(null)
            void queryClient.invalidateQueries({
              queryKey: ['inventory-items'],
            })
            void queryClient.invalidateQueries({
              queryKey: ['inventory-reorder-alerts'],
            })
            void queryClient.invalidateQueries({
              queryKey: ['inventory-transactions'],
            })
          }}
        />
      )}

      {/* EXPORT MODAL */}
      {canAdjust && exportItem && (
        <ExportDialog
          item={exportItem}
          onClose={() => setExportItem(null)}
          onSuccess={() => {
            setExportItem(null)
            void queryClient.invalidateQueries({
              queryKey: ['inventory-items'],
            })
            void queryClient.invalidateQueries({
              queryKey: ['inventory-reorder-alerts'],
            })
            void queryClient.invalidateQueries({
              queryKey: ['inventory-transactions'],
            })
          }}
        />
      )}

      {/* CREATE ITEM MODAL */}
      {canCreate && createDialogOpen && (
        <CreateItemDialog
          onClose={() => setCreateDialogOpen(false)}
          categories={categoriesQuery.data ?? []}
          units={unitsQuery.data ?? []}
          onSuccess={() => {
            setCreateDialogOpen(false)
            void queryClient.invalidateQueries({
              queryKey: ['inventory-items'],
            })
            void queryClient.invalidateQueries({
              queryKey: ['inventory-reorder-alerts'],
            })
          }}
        />
      )}

      {/* EDIT ITEM MODAL */}
      {canUpdate && editItem && (
        <EditItemDialog
          item={editItem}
          categories={categoriesQuery.data ?? []}
          units={unitsQuery.data ?? []}
          onClose={() => setEditItem(null)}
          onSuccess={() => {
            setEditItem(null)
            void queryClient.invalidateQueries({
              queryKey: ['inventory-items'],
            })
            void queryClient.invalidateQueries({
              queryKey: ['inventory-reorder-alerts'],
            })
          }}
        />
      )}

      {/* DELETE CONFIRM DIALOG */}
      {canDelete && deleteItem && (
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
