import { useState } from 'react'
import {
  useParams,
  useNavigate,
  useOutletContext,
  Link,
} from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  DollarSign,
  RefreshCw,
  UtensilsCrossed,
} from 'lucide-react'
import { errorMessage } from '../../shared/api/client'
import {
  getCategories,
  getMenu,
  formatPrice,
  type MenuItem,
} from '../menu/menu.api'
import { CheckoutModal } from './checkout-modal'
import {
  addOrderItems,
  cancelOrderItem,
  getDiningTables,
  getSessionDetail,
  transferTable,
  type AddOrderItemPayload,
} from './pos.api'
import { getPosRecommendations } from '../recommendations/recommendations.api'
import { Card, CardContent } from '../../shared/ui/card'
import { Button } from '../../shared/ui/button'
import { buttonVariants } from '../../shared/ui/button-variants'
import { cn } from '../../shared/ui/utils'
import type { DraftItem } from './pos.types'
import { PosMenuCatalog } from './components/pos-menu-catalog'
import { PosOrderItemsList } from './components/pos-order-items-list'
import { PosDraftItemsList } from './components/pos-draft-items-list'
import { PosItemOptionsDialog } from './components/pos-item-options-dialog'
import { PosTransferDialog } from './components/pos-transfer-dialog'
import { PosSessionActions } from './components/pos-session-actions'
import { posKeys } from './pos.keys'
import type { Session } from '../auth/session'
import { Pagination } from '../../shared/ui/pagination'
import { CancelSessionAction } from './components/cancel-session-action'

export default function PosSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { employee, authorization } = useOutletContext<Session>()
  const can = (key: string) => authorization.permissionKeys.includes(key)

  const [keyword, setKeyword] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [menuPage, setMenuPage] = useState(1)
  const [draftItems, setDraftItems] = useState<DraftItem[]>([])

  // Modal chọn tùy chọn món (options / size / topping)
  const [configuringItem, setConfiguringItem] = useState<MenuItem | null>(null)

  // Modal chuyển bàn
  const [showTransferModal, setShowTransferModal] = useState(false)

  // Modal thanh toán
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)

  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  const sessionQuery = useQuery({
    queryKey: posKeys.session(employee.id, sessionId),
    queryFn: ({ signal }) => getSessionDetail(sessionId!, signal),
    enabled: Boolean(sessionId),
    refetchInterval: 5_000,
  })

  const categoriesQuery = useQuery({
    queryKey: ['public-menu', 'categories'],
    queryFn: ({ signal }) => getCategories(signal),
  })

  const menuQuery = useQuery({
    queryKey: [
      'public-menu',
      'items',
      { keyword, categoryId: selectedCategoryId, page: menuPage },
    ],
    queryFn: ({ signal }) =>
      getMenu(
        { keyword, categoryId: selectedCategoryId, page: menuPage },
        signal,
      ),
  })

  const tablesQuery = useQuery({
    queryKey: posKeys.tables(employee.id),
    queryFn: ({ signal }) => getDiningTables(signal),
    enabled: showTransferModal,
  })

  const recommendationsQuery = useQuery({
    queryKey: [
      'private',
      employee.id,
      'recommendations',
      'pos',
      sessionId,
      [
        ...new Set(
          sessionQuery.data?.orderItems
            .filter((item) => item.serveStatus !== 'CANCELLED')
            .map((item) => item.menuItem.id),
        ),
      ].sort(),
    ],
    queryFn: ({ signal }) => getPosRecommendations(sessionId!, signal),
    enabled:
      Boolean(sessionId) && (sessionQuery.data?.orderItems.length ?? 0) > 0,
    staleTime: 60_000,
  })

  const addItemsMutation = useMutation({
    mutationFn: async () => {
      setActionError(null)
      setActionSuccess(null)
      if (draftItems.length === 0) return
      const payload: AddOrderItemPayload[] = draftItems.map((item) => ({
        menuItemId: item.menuItem.id,
        quantity: item.quantity,
        note: item.note.trim() || undefined,
        optionIds:
          item.selectedOptionIds.length > 0
            ? item.selectedOptionIds
            : undefined,
      }))
      return addOrderItems(sessionId!, payload)
    },
    onSuccess: () => {
      setDraftItems([])
      setActionSuccess('Đã gửi món vào bếp thành công')
      void queryClient.invalidateQueries({
        queryKey: posKeys.session(employee.id, sessionId),
      })
    },
    onError: (err) => {
      setActionError(errorMessage(err))
    },
  })

  const cancelItemMutation = useMutation({
    mutationFn: async ({
      itemId,
      reason,
    }: {
      itemId: string
      reason: string
    }) => {
      setActionError(null)
      setActionSuccess(null)
      return cancelOrderItem(itemId, reason)
    },
    onSuccess: () => {
      setActionSuccess('Đã hủy món thành công')
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['private', employee.id, 'inventory-waste'] })
      void queryClient.invalidateQueries({
        queryKey: posKeys.session(employee.id, sessionId),
      })
      void queryClient.invalidateQueries({ queryKey: ['kitchen', 'tickets'] })
    },
    onError: (err) => {
      setActionError(errorMessage(err))
    },
  })

  const transferMutation = useMutation({
    mutationFn: async (targetTableId: string) => {
      setActionError(null)
      setActionSuccess(null)
      const currentTableId = sessionQuery.data?.table?.id
      if (!currentTableId || !targetTableId) {
        throw new Error('Vui lòng chọn bàn đích hợp lệ')
      }
      return transferTable(currentTableId, targetTableId)
    },
    onSuccess: () => {
      setShowTransferModal(false)
      setActionSuccess('Đã chuyển bàn thành công')
      void queryClient.invalidateQueries({
        queryKey: posKeys.session(employee.id, sessionId),
      })
      void queryClient.invalidateQueries({
        queryKey: posKeys.tables(employee.id),
      })
      void queryClient.invalidateQueries({
        queryKey: posKeys.sessions(employee.id),
      })
    },
    onError: (err) => {
      setActionError(errorMessage(err))
    },
  })

  if (!sessionId) {
    return (
      <main className="mx-auto my-12 max-w-md rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
        <p className="font-semibold text-destructive">
          Không tìm thấy mã phiên phục vụ.
        </p>
        <Link
          to="/staff/pos"
          className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}
        >
          Về sơ đồ bàn
        </Link>
      </main>
    )
  }

  if (sessionQuery.isPending) {
    return (
      <main
        className="flex min-h-[300px] items-center justify-center p-8 text-muted-foreground"
        role="status"
      >
        <p className="animate-pulse">Đang tải chi tiết đơn hàng…</p>
      </main>
    )
  }

  if (sessionQuery.isError) {
    return (
      <main className="mx-auto my-12 max-w-md rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
        <p className="font-semibold text-destructive" role="alert">
          {errorMessage(sessionQuery.error)}
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Button
            onClick={() => void sessionQuery.refetch()}
            disabled={sessionQuery.isFetching}
          >
            Thử lại
          </Button>
          <Link
            to="/staff/pos"
            className={buttonVariants({ variant: 'outline' })}
          >
            Về sơ đồ bàn
          </Link>
        </div>
      </main>
    )
  }

  const session = sessionQuery.data
  const isCompleted = session.sessionStatus === 'COMPLETED'
  const isCancelled = session.sessionStatus === 'CANCELLED'

  // Tính tổng tiền các món chưa thanh toán
  const unpaidItems = session.orderItems.filter(
    (item) =>
      !item.isPaid && !item.invoiceId && item.serveStatus !== 'CANCELLED',
  )
  const existingUnpaidTotal = unpaidItems.reduce(
    (sum, item) => sum + Number(item.priceAtTime) * item.quantity,
    0,
  )
  const draftTotal = draftItems.reduce(
    (sum, item) => sum + item.calculatedPrice * item.quantity,
    0,
  )
  const grandTotal = existingUnpaidTotal + draftTotal

  function handleSelectItem(item: MenuItem) {
    if (item.optionGroups.length === 0) {
      // Món không có options: thêm trực tiếp vào giỏ
      const basePrice = Number(item.price) || 0
      setDraftItems((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          menuItem: item,
          quantity: 1,
          note: '',
          selectedOptionIds: [],
          calculatedPrice: basePrice,
        },
      ])
      return
    }
    setConfiguringItem(item)
  }

  function handleConfirmOptions(
    item: MenuItem,
    selectedOptionIds: string[],
    note: string,
    calculatedPrice: number,
  ) {
    setDraftItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        menuItem: item,
        quantity: 1,
        note,
        selectedOptionIds,
        calculatedPrice,
      },
    ])
  }

  function updateDraftQuantity(draftId: string, delta: number) {
    setDraftItems((prev) =>
      prev
        .map((item) =>
          item.id === draftId
            ? { ...item, quantity: item.quantity + delta }
            : item,
        )
        .filter((item) => item.quantity > 0),
    )
  }

  return (
    <div className="space-y-6">
      {/* Header phiên bàn */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate('/staff/pos')}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Sơ đồ bàn
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {session.table
                ? `Bàn: ${session.table.name}`
                : `Đơn mang đi #${session.id.slice(0, 8)}`}
            </h1>
            <span className="text-xs text-muted-foreground">
              Nhân viên: {session.employee.fullName} •{' '}
              {session.guestCount ? `${session.guestCount} khách` : 'Mang đi'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {session.orderItems.some((item) => !item.isPaid && item.invoiceId) &&
            can('/invoices_read') && (
              <Link
                to="/staff/invoices"
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                Hóa đơn đang chờ
              </Link>
            )}
          <PosSessionActions
            session={session}
            disabled={
              draftItems.length > 0 ||
              addItemsMutation.isPending ||
              transferMutation.isPending
            }
          />
          <CancelSessionAction
            session={session}
            disabled={
              draftItems.length > 0 ||
              addItemsMutation.isPending ||
              transferMutation.isPending
            }
          />
          {session.table &&
            can('/orders_tables_transfer') &&
            !isCompleted &&
            !isCancelled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowTransferModal(true)}
                className="flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" /> Chuyển bàn
              </Button>
            )}

          {can('/invoices_create') &&
            !isCompleted &&
            !isCancelled &&
            existingUnpaidTotal > 0 && (
              <Button
                type="button"
                size="default"
                onClick={() => setShowCheckoutModal(true)}
                className="flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <DollarSign className="h-4 w-4" /> Thanh toán (
                {formatPrice(String(existingUnpaidTotal))})
              </Button>
            )}
        </div>
      </div>

      {actionError && (
        <div
          className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div
          className="flex items-center gap-2 rounded-md border-l-4 border-emerald-600 bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {isCompleted && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-xl border border-emerald-500/40 bg-emerald-50/50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <strong className="text-base font-bold text-emerald-800">
              Đơn hàng này đã hoàn tất thanh toán.
            </strong>
            <p className="mt-0.5 text-xs text-emerald-700">
              Bàn đã được chốt và đưa về trạng thái trống.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => navigate('/staff/pos')}
            className="shrink-0 cursor-pointer"
          >
            Quay lại sơ đồ bàn
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Cột trái: Danh mục & Thực đơn gọi món */}
        <PosMenuCatalog
          keyword={keyword}
          onKeywordChange={(value) => {
            setKeyword(value)
            setMenuPage(1)
          }}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={(value) => {
            setSelectedCategoryId(value)
            setMenuPage(1)
          }}
          categories={categoriesQuery.data}
          menuItems={menuQuery.data?.list}
          recommendations={recommendationsQuery.data}
          isLoadingMenu={menuQuery.isPending}
          onSelectItem={handleSelectItem}
          disabled={!can('/orders_items_create') || isCompleted || isCancelled}
          pagination={
            menuQuery.data && (
              <Pagination
                page={menuPage}
                totalPages={menuQuery.data.totalPages}
                onPage={setMenuPage}
                disabled={menuQuery.isFetching}
              />
            )
          }
          error={menuQuery.error && errorMessage(menuQuery.error)}
          onRetry={() => void menuQuery.refetch()}
        />

        {/* Cột phải: Đơn hàng (Món đã đặt + Giỏ hàng tạm + Tổng tiền) */}
        <Card className="lg:col-span-5 p-5">
          <CardContent className="p-0">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
              <UtensilsCrossed className="h-5 w-5 text-primary" /> Món trong đơn
            </h2>

            {/* Danh sách món đã gửi trước đó */}
            <PosOrderItemsList
              orderItems={session.orderItems}
              canCancel={can('/orders_items_cancel')}
              onCancelItem={(itemId, reason) =>
                cancelItemMutation.mutate({ itemId, reason })
              }
              isCancelling={cancelItemMutation.isPending}
            />

            {/* Giỏ hàng tạm (Draft items) */}
            <PosDraftItemsList
              draftItems={draftItems}
              onUpdateQuantity={updateDraftQuantity}
              onClearDraft={() => setDraftItems([])}
              onSubmitOrder={() => addItemsMutation.mutate()}
              isSubmitting={addItemsMutation.isPending}
            />

            {/* Tổng tiền & thanh toán */}
            <div className="mt-5 border-t border-border pt-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">
                  Tổng tiền tạm tính:
                </span>
                <span className="text-xl font-bold tracking-tight text-primary">
                  {formatPrice(String(grandTotal))}
                </span>
              </div>

              {can('/invoices_create') &&
                !isCompleted &&
                !isCancelled &&
                existingUnpaidTotal > 0 && (
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => setShowCheckoutModal(true)}
                    className="w-full flex items-center justify-center gap-2 font-bold shadow-sm cursor-pointer"
                  >
                    <DollarSign className="h-5 w-5" />
                    Thanh toán hóa đơn
                  </Button>
                )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal tùy chọn món (Options modal) */}
      <PosItemOptionsDialog
        item={configuringItem}
        onClose={() => setConfiguringItem(null)}
        onConfirm={handleConfirmOptions}
      />

      {/* Modal chuyển bàn */}
      <PosTransferDialog
        open={showTransferModal}
        currentTableName={session.table?.name}
        currentTableId={session.table?.id}
        tables={tablesQuery.data}
        onClose={() => setShowTransferModal(false)}
        onConfirm={(targetId) => transferMutation.mutate(targetId)}
        isPending={transferMutation.isPending}
      />

      {/* Modal thanh toán tiền mặt */}
      {showCheckoutModal && (
        <CheckoutModal
          sessionId={session.id}
          items={unpaidItems}
          totalAmount={String(existingUnpaidTotal)}
          onClose={() => setShowCheckoutModal(false)}
          onCompleted={() => {
            void queryClient.invalidateQueries({
              queryKey: posKeys.session(employee.id, sessionId),
            })
            void queryClient.invalidateQueries({
              queryKey: posKeys.tables(employee.id),
            })
            void queryClient.invalidateQueries({
              queryKey: posKeys.sessions(employee.id),
            })
          }}
        />
      )}
    </div>
  )
}
