import { useCallback, useEffect, useRef, useState } from 'react'
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
  Receipt,
  RefreshCw,
  UtensilsCrossed,
} from 'lucide-react'
import { ApiError, errorMessage } from '../../shared/api/client'
import { pendingIntentKey, readPendingIntent, writePendingIntent, isPendingIntentExpired, type PendingIntent } from '../../shared/api/pending-intent'
import { decimalAmount, minorAmount } from '../../shared/lib/money'
import {
  getCategories,
  getMenu,
  formatPrice,
  type MenuItem,
} from '../menu/menu.api'
import { CheckoutModal } from './checkout-modal'
import { kitchenKeys } from '../kitchen/kitchen.api'
import {
  addOrderItems,
  cancelOrderItem,
  getDiningTables,
  getSessionDetail,
  transferTable,
  draftItemsSchema,
  orderItemBatchSchema,
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

export default function PosSessionRoute() {
  const { sessionId } = useParams()
  return <PosSessionPage key={sessionId} />
}

function PosSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { employee, authorization } = useOutletContext<Session>()
  const can = (key: string) => authorization.permissionKeys.includes(key)
  const draftKey = `coffee_pos_draft_${employee.id}_${sessionId}`
  const submissionKey = pendingIntentKey(employee.id, `orders.items:${sessionId}`)

  const [keyword, setKeyword] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [menuPage, setMenuPage] = useState(1)
  const [draftItems, setDraftItems] = useState<DraftItem[]>(() => {
    if (!sessionId) return []
    try {
      const stored = sessionStorage.getItem(draftKey)
      return stored ? draftItemsSchema.parse(JSON.parse(stored)) : []
    } catch {
      return []
    }
  })

  // Synchronize draft items with sessionStorage
  useEffect(() => {
    if (!sessionId) return
    try {
      if (draftItems.length > 0) {
        sessionStorage.setItem(draftKey, JSON.stringify(draftItems))
      } else {
        sessionStorage.removeItem(draftKey)
      }
    } catch {
      // Ignore sessionStorage issues
    }
  }, [draftItems, sessionId, draftKey])

  const [submittedItems, setSubmittedItems] = useState<PendingIntent<AddOrderItemPayload[]> | null>(
    () => readPendingIntent(submissionKey, orderItemBatchSchema),
  )
  const orderFlight = useRef(false)

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
    mutationFn: (intent: PendingIntent<AddOrderItemPayload[]>) => addOrderItems(sessionId!, intent.payload, intent.idempotencyKey),
    retry: false,
    onSuccess: () => {
      sessionStorage.removeItem(submissionKey)
      setDraftItems([])
      setSubmittedItems(null)
      try {
        if (sessionId) sessionStorage.removeItem(draftKey)
      } catch {
        // Ignore
      }
      setActionSuccess('Đã gửi món vào bếp thành công')
    },
    onSettled: () => {
      orderFlight.current = false
      void queryClient.invalidateQueries({
        queryKey: posKeys.session(employee.id, sessionId),
      })
      void queryClient.invalidateQueries({ queryKey: kitchenKeys.tickets(employee.id) })
    },
    onError: (err, intent) => {
      setActionError(errorMessage(err))
      if (!intent.uncertain && err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429) {
        sessionStorage.removeItem(submissionKey)
        setSubmittedItems(null)
      } else {
        const unresolved = { ...intent, uncertain: true }
        setSubmittedItems(unresolved)
        try { writePendingIntent(submissionKey, unresolved) }
        catch { setActionError('Không lưu được trạng thái chưa xác nhận. Không đóng tab; liên hệ quản lý để đối soát.') }
      }
    },
  })
  const orderWriteLocked = addItemsMutation.isPending || Boolean(submittedItems)

  const submitDraft = useCallback(() => {
    if (
      orderFlight.current ||
      !sessionId ||
      !authorization.permissionKeys.includes('/orders_items_create') ||
      (!submittedItems && draftItems.length === 0)
    )
      return
    if (submittedItems && isPendingIntentExpired(submittedItems)) {
      setActionError('Yêu cầu đã quá thời hạn phục hồi an toàn. Liên hệ quản lý để đối soát món đã gửi; không gửi lại batch này.')
      return
    }
    const payload = submittedItems?.payload ?? draftItems.map((item) => ({
      menuItemId: item.menuItem.id,
      quantity: item.quantity,
      note: item.note.trim() || undefined,
      optionIds: item.selectedOptionIds.length ? item.selectedOptionIds : undefined,
    }))
    const parsed = orderItemBatchSchema.safeParse(payload)
    if (!parsed.success) { setActionError(parsed.error.issues[0]?.message ?? 'Batch món chưa hợp lệ.'); return }
    const intent = submittedItems ?? { payload: parsed.data, createdAt: Date.now(), idempotencyKey: crypto.randomUUID() }
    try {
      writePendingIntent(submissionKey, intent)
    } catch {
      setActionError('Không lưu được yêu cầu phục hồi. Chưa gửi món; kiểm tra bộ nhớ trình duyệt.')
      return
    }
    orderFlight.current = true
    setSubmittedItems(intent)
    setActionError(null)
    setActionSuccess(null)
    addItemsMutation.mutate(intent)
  }, [
    sessionId,
    authorization.permissionKeys,
    submittedItems,
    draftItems,
    addItemsMutation,
    submissionKey,
  ])

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
      void queryClient.invalidateQueries({ queryKey: kitchenKeys.tickets(employee.id) })
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

  const submitDraftRef = useRef(submitDraft)
  useEffect(() => {
    submitDraftRef.current = submitDraft
  }, [submitDraft])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return

      // Escape: Close modals
      if (e.key === 'Escape') {
        if (configuringItem) {
          e.preventDefault()
          setConfiguringItem(null)
          return
        }
        if (showTransferModal) {
          e.preventDefault()
          setShowTransferModal(false)
          return
        }
      }

      // F2 or Ctrl+K: Open Checkout modal
      if (e.key === 'F2' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        const orderItems = sessionQuery.data?.orderItems ?? []
        const hasUnpaid = orderItems.some(
          (item) => !item.isPaid && !item.invoiceId && item.serveStatus !== 'CANCELLED',
        )
        const isSessionOpen =
          sessionQuery.data?.sessionStatus !== 'COMPLETED' &&
          sessionQuery.data?.sessionStatus !== 'CANCELLED'

        if (
          authorization.permissionKeys.includes('/invoices_create') &&
          isSessionOpen &&
          hasUnpaid &&
          !orderWriteLocked &&
          !showCheckoutModal
        ) {
          e.preventDefault()
          setShowCheckoutModal(true)
          return
        }
      }

      // Ctrl+Enter or Meta+Enter: Submit draft order to kitchen
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (
          draftItems.length > 0 &&
          !orderWriteLocked &&
          authorization.permissionKeys.includes('/orders_items_create')
        ) {
          e.preventDefault()
          submitDraftRef.current()
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    configuringItem,
    showTransferModal,
    showCheckoutModal,
    sessionQuery.data,
    authorization.permissionKeys,
    orderWriteLocked,
    draftItems.length,
  ])

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
    (sum, item) => sum + minorAmount(item.priceAtTime) * BigInt(item.quantity),
    0n,
  )
  const draftTotal = draftItems.reduce(
    (sum, item) => sum + minorAmount(item.calculatedPrice) * BigInt(item.quantity),
    0n,
  )
  const grandTotal = existingUnpaidTotal + draftTotal

  function handleSelectItem(item: MenuItem) {
    if (orderFlight.current || orderWriteLocked) return
    if (item.optionGroups.length === 0) {
      // Món không có options: thêm trực tiếp vào giỏ
      setDraftItems((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          menuItem: item,
          quantity: 1,
          note: '',
          selectedOptionIds: [],
          calculatedPrice: item.price,
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
    calculatedPrice: string,
  ) {
    if (orderFlight.current || orderWriteLocked) return
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
    if (orderFlight.current || orderWriteLocked) return
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
                disabled={orderWriteLocked || transferMutation.isPending}
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
                disabled={orderWriteLocked}
                onClick={() => setShowCheckoutModal(true)}
                className="flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <DollarSign className="h-4 w-4" /> Thanh toán (
                {formatPrice(decimalAmount(existingUnpaidTotal))})
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
      {submittedItems && !addItemsMutation.isPending && <div className="space-y-2">
        <p role="status" className="text-sm">{isPendingIntentExpired(submittedItems)
          ? 'Yêu cầu đã quá thời hạn phục hồi an toàn. Liên hệ quản lý để đối soát món đã gửi; không gửi lại batch này.'
          : 'Chưa xác nhận được lần gửi món. Kiểm tra lại cùng nội dung trước khi thêm món khác hoặc thanh toán.'}</p>
        {draftItems.length === 0 && can('/orders_items_create') && <Button variant="outline" disabled={isPendingIntentExpired(submittedItems)} onClick={submitDraft}>Kiểm tra lại cùng batch</Button>}
      </div>}

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
          <div className="flex flex-wrap items-center gap-2">
            {can('/invoices_read') && (
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/staff/invoices')}
                className="shrink-0 cursor-pointer"
              >
                <Receipt className="h-4 w-4 mr-1.5" /> Xem danh sách hóa đơn
              </Button>
            )}
            <Button
              type="button"
              onClick={() => navigate('/staff/pos')}
              className="shrink-0 cursor-pointer"
            >
              Quay lại sơ đồ bàn
            </Button>
          </div>
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
          disabled={!can('/orders_items_create') || isCompleted || isCancelled || orderWriteLocked}
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
              canCancel={can('/orders_items_cancel') && !orderWriteLocked}
              onCancelItem={(itemId, reason) =>
                cancelItemMutation.mutate({ itemId, reason })
              }
              isCancelling={cancelItemMutation.isPending}
            />

            {/* Giỏ hàng tạm (Draft items) */}
            <PosDraftItemsList
              draftItems={draftItems}
              onUpdateQuantity={updateDraftQuantity}
              onClearDraft={() => { if (!orderFlight.current && !orderWriteLocked) setDraftItems([]) }}
              onSubmitOrder={submitDraft}
              isSubmitting={addItemsMutation.isPending}
              isLocked={Boolean(submittedItems)}
            />

            {/* Tổng tiền & thanh toán */}
            <div className="mt-5 border-t border-border pt-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">
                  Tổng tiền tạm tính:
                </span>
                <span className="text-xl font-bold tracking-tight text-primary">
                  {formatPrice(decimalAmount(grandTotal))}
                </span>
              </div>

              {can('/invoices_create') &&
                !isCompleted &&
                !isCancelled &&
                existingUnpaidTotal > 0 && (
                  <Button
                    type="button"
                    size="lg"
                    disabled={orderWriteLocked}
                    onClick={() => setShowCheckoutModal(true)}
                    className="w-full min-h-[44px] flex items-center justify-center gap-2 font-bold shadow-sm cursor-pointer"
                  >
                    <DollarSign className="h-5 w-5" />
                    <span>Thanh toán hóa đơn</span>
                    <kbd className="hidden sm:inline-block ml-1 rounded bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-mono font-medium tracking-tight">
                      F2
                    </kbd>
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
          totalAmount={decimalAmount(existingUnpaidTotal)}
          onClose={() => setShowCheckoutModal(false)}
          onCompleted={() => {
            try {
              if (sessionId) sessionStorage.removeItem(draftKey)
            } catch {
              // Ignore
            }
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
