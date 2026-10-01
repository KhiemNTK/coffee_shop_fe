import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Coffee,
  DollarSign,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
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
import { Card, CardContent } from '../../shared/ui/card'
import { Button } from '../../shared/ui/button'
import { buttonVariants } from '../../shared/ui/button-variants'
import { Badge } from '../../shared/ui/badge'
import { Input } from '../../shared/ui/input'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../shared/ui/dialog'
import { cn } from '../../shared/ui/utils'

type DraftItem = {
  id: string
  menuItem: MenuItem
  quantity: number
  note: string
  selectedOptionIds: string[]
  calculatedPrice: number
}

export default function PosSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [keyword, setKeyword] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [draftItems, setDraftItems] = useState<DraftItem[]>([])

  // Modal chọn tùy chọn món (options / size / topping)
  const [configuringItem, setConfiguringItem] = useState<MenuItem | null>(null)
  const [configuredOptions, setConfiguredOptions] = useState<Record<string, string[]>>({})
  const [configuredNote, setConfiguredNote] = useState('')

  // Modal chuyển bàn
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [targetTableId, setTargetTableId] = useState('')

  // Modal thanh toán
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)

  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  const sessionQuery = useQuery({
    queryKey: ['pos', 'session', sessionId],
    queryFn: ({ signal }) => getSessionDetail(sessionId!, signal),
    enabled: Boolean(sessionId),
    refetchInterval: 5_000,
  })

  const categoriesQuery = useQuery({
    queryKey: ['public-menu', 'categories'],
    queryFn: ({ signal }) => getCategories(signal),
  })

  const menuQuery = useQuery({
    queryKey: ['public-menu', 'items', { keyword, categoryId: selectedCategoryId, page: 1 }],
    queryFn: ({ signal }) =>
      getMenu({ keyword, categoryId: selectedCategoryId, page: 1 }, signal),
  })

  const tablesQuery = useQuery({
    queryKey: ['private', 'dining-tables'],
    queryFn: ({ signal }) => getDiningTables(signal),
    enabled: showTransferModal,
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
        optionIds: item.selectedOptionIds.length > 0 ? item.selectedOptionIds : undefined,
      }))
      return addOrderItems(sessionId!, payload)
    },
    onSuccess: () => {
      setDraftItems([])
      setActionSuccess('Đã gửi món vào bếp thành công')
      void queryClient.invalidateQueries({ queryKey: ['pos', 'session', sessionId] })
    },
    onError: (err) => {
      setActionError(errorMessage(err))
    },
  })

  const cancelItemMutation = useMutation({
    mutationFn: async ({ itemId, reason }: { itemId: string; reason: string }) => {
      setActionError(null)
      setActionSuccess(null)
      return cancelOrderItem(itemId, reason)
    },
    onSuccess: () => {
      setActionSuccess('Đã hủy món thành công')
      void queryClient.invalidateQueries({ queryKey: ['pos', 'session', sessionId] })
    },
    onError: (err) => {
      setActionError(errorMessage(err))
    },
  })

  const transferMutation = useMutation({
    mutationFn: async () => {
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
      void queryClient.invalidateQueries({ queryKey: ['pos', 'session', sessionId] })
      void queryClient.invalidateQueries({ queryKey: ['private', 'dining-tables'] })
    },
    onError: (err) => {
      setActionError(errorMessage(err))
    },
  })

  if (!sessionId) {
    return (
      <main className="mx-auto my-12 max-w-md rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
        <p className="font-semibold text-destructive">Không tìm thấy mã phiên phục vụ.</p>
        <Link to="/staff/pos" className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}>
          Về sơ đồ bàn
        </Link>
      </main>
    )
  }

  if (sessionQuery.isPending) {
    return (
      <main className="flex min-h-[300px] items-center justify-center p-8 text-muted-foreground" role="status">
        <p className="animate-pulse">Đang tải chi tiết đơn hàng…</p>
      </main>
    )
  }

  if (sessionQuery.isError) {
    return (
      <main className="mx-auto my-12 max-w-md rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
        <p className="font-semibold text-destructive" role="alert">{errorMessage(sessionQuery.error)}</p>
        <div className="mt-4 flex justify-center gap-3">
          <Button
            onClick={() => void sessionQuery.refetch()}
            disabled={sessionQuery.isFetching}
          >
            Thử lại
          </Button>
          <Link to="/staff/pos" className={buttonVariants({ variant: 'outline' })}>
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
    (item) => !item.isPaid && item.serveStatus !== 'CANCELLED',
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

  function openOptionConfig(item: MenuItem) {
    if (item.optionGroups.length === 0) {
      // Món không có options: thêm trực tiếp
      addDraftDirect(item, [])
      return
    }
    setConfiguringItem(item)
    setConfiguredOptions({})
    setConfiguredNote('')
  }

  function addDraftDirect(item: MenuItem, selectedOptionIds: string[]) {
    let price = Number(item.price) || 0
    for (const group of item.optionGroups) {
      for (const opt of group.options) {
        if (selectedOptionIds.includes(opt.id)) {
          price += Number(opt.priceDelta) || 0
        }
      }
    }
    setDraftItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        menuItem: item,
        quantity: 1,
        note: '',
        selectedOptionIds,
        calculatedPrice: price,
      },
    ])
  }

  function confirmConfiguredItem() {
    if (!configuringItem) return
    const allSelectedIds = Object.values(configuredOptions).flat()
    let price = Number(configuringItem.price) || 0
    for (const group of configuringItem.optionGroups) {
      for (const opt of group.options) {
        if (allSelectedIds.includes(opt.id)) {
          price += Number(opt.priceDelta) || 0
        }
      }
    }
    setDraftItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        menuItem: configuringItem,
        quantity: 1,
        note: configuredNote,
        selectedOptionIds: allSelectedIds,
        calculatedPrice: price,
      },
    ])
    setConfiguringItem(null)
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
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Sơ đồ bàn
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {session.table ? `Bàn: ${session.table.name}` : `Đơn mang đi #${session.id.slice(0, 8)}`}
            </h1>
            <span className="text-xs text-muted-foreground">
              Nhân viên: {session.employee.fullName} • {session.guestCount ? `${session.guestCount} khách` : 'Mang đi'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {session.table && !isCompleted && !isCancelled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowTransferModal(true)}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className="h-4 w-4" /> Chuyển bàn
            </Button>
          )}

          {!isCompleted && !isCancelled && existingUnpaidTotal > 0 && (
            <Button
              type="button"
              size="default"
              onClick={() => setShowCheckoutModal(true)}
              className="flex items-center gap-1.5 shadow-sm"
            >
              <DollarSign className="h-4 w-4" /> Thanh toán ({formatPrice(String(existingUnpaidTotal))})
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
            className="shrink-0"
          >
            Quay lại sơ đồ bàn
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Cột trái: Danh mục & Thực đơn gọi món */}
        <Card className="lg:col-span-7 p-5">
          <CardContent className="p-0">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
              <Coffee className="h-5 w-5 text-primary" /> Chọn món
            </h2>

            {/* Ô tìm kiếm & lọc danh mục */}
            <div className="mb-4 flex flex-col gap-2.5 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Tìm món nhanh…"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="pl-9"
                />
              </div>

              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="h-9 rounded-md border border-input bg-card px-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="">Tất cả danh mục</option>
                {categoriesQuery.data?.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Lưới món ăn */}
            {menuQuery.isPending ? (
              <p className="py-8 text-center text-sm text-muted-foreground animate-pulse" role="status">
                Đang tải món…
              </p>
            ) : menuQuery.data?.list.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Không tìm thấy món phù hợp.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {menuQuery.data?.list.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openOptionConfig(item)}
                    disabled={isCompleted || isCancelled}
                    className="group flex min-h-[85px] flex-col justify-between rounded-xl border border-border bg-card p-3 text-left transition-all hover:border-primary hover:shadow-xs focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 select-none"
                  >
                    <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                      {item.name}
                    </span>
                    <span className="mt-2 text-xs font-bold text-primary">
                      {formatPrice(item.price)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cột phải: Đơn hàng (Món đã đặt + Giỏ hàng tạm) */}
        <Card className="lg:col-span-5 p-5">
          <CardContent className="p-0">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
              <UtensilsCrossed className="h-5 w-5 text-primary" /> Món trong đơn
            </h2>

            {/* Danh sách món đã gửi trước đó */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Món đã order ({session.orderItems.length})
              </span>

              {session.orderItems.length === 0 ? (
                <p className="py-3 text-xs text-muted-foreground italic">
                  Chưa có món nào được gửi.
                </p>
              ) : (
                <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {session.orderItems.map((item) => {
                    const isCancelable =
                      !item.isPaid &&
                      item.serveStatus !== 'SERVED' &&
                      item.serveStatus !== 'CANCELLED'

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'flex items-center justify-between gap-3 rounded-lg border p-2.5 transition-colors',
                          item.serveStatus === 'CANCELLED'
                            ? 'border-destructive/20 bg-destructive/5 opacity-70'
                            : 'border-border bg-muted/20',
                        )}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'text-sm font-semibold text-foreground',
                                item.serveStatus === 'CANCELLED' && 'line-through text-muted-foreground',
                              )}
                            >
                              {item.quantity}x {item.menuItem.name}
                            </span>
                            <Badge
                              variant={
                                item.serveStatus === 'SERVED'
                                  ? 'success'
                                  : item.serveStatus === 'CANCELLED'
                                    ? 'destructive'
                                    : 'warning'
                              }
                              className="text-[10px]"
                            >
                              {item.serveStatus}
                            </Badge>
                          </div>
                          {item.note && (
                            <small className="block text-xs text-muted-foreground">
                              {item.note}
                            </small>
                          )}
                          <span className="block text-xs font-bold text-primary">
                            {formatPrice(String(Number(item.priceAtTime) * item.quantity))}
                          </span>
                        </div>

                        {isCancelable && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Hủy món"
                            onClick={() => {
                              const reason = prompt('Nhập lý do hủy món:') || 'Khách đổi ý'
                              cancelItemMutation.mutate({ itemId: item.id, reason })
                            }}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Giỏ hàng tạm (Draft items) */}
            {draftItems.length > 0 && (
              <div className="mt-5 border-t-2 border-dashed border-primary/20 pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    Món mới chọn ({draftItems.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setDraftItems([])}
                    className="text-xs font-semibold text-destructive hover:underline"
                  >
                    Xóa tất cả
                  </button>
                </div>

                <div className="space-y-2 mb-3 max-h-[220px] overflow-y-auto pr-1">
                  {draftItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-2.5"
                    >
                      <div>
                        <strong className="text-sm font-semibold text-foreground">
                          {item.menuItem.name}
                        </strong>
                        {item.note && (
                          <small className="block text-xs text-muted-foreground">
                            {item.note}
                          </small>
                        )}
                        <div className="mt-0.5 text-xs font-bold text-primary">
                          {formatPrice(String(item.calculatedPrice * item.quantity))}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateDraftQuantity(item.id, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-muted"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center text-xs font-bold text-foreground">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateDraftQuantity(item.id, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-muted"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  onClick={() => addItemsMutation.mutate()}
                  isLoading={addItemsMutation.isPending}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  {addItemsMutation.isPending ? 'Đang gửi món…' : 'Gửi order vào bếp'}
                </Button>
              </div>
            )}

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

              {!isCompleted && !isCancelled && existingUnpaidTotal > 0 && (
                <Button
                  type="button"
                  size="lg"
                  onClick={() => setShowCheckoutModal(true)}
                  className="w-full flex items-center justify-center gap-2 font-bold shadow-sm"
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
      <Dialog
        open={Boolean(configuringItem)}
        onClose={() => setConfiguringItem(null)}
        maxWidth="sm"
      >
        {configuringItem && (
          <div>
            <DialogHeader>
              <DialogTitle>{configuringItem.name}</DialogTitle>
              <DialogDescription>
                Giá cơ bản: <strong className="text-primary font-bold">{formatPrice(configuringItem.price)}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-4 max-h-[380px] overflow-y-auto pr-1">
              {configuringItem.optionGroups.map((group) => (
                <div key={group.id} className="space-y-2">
                  <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {group.name}
                  </span>
                  <div className="space-y-1.5">
                    {group.options.map((opt) => {
                      const isSelected = configuredOptions[group.id]?.includes(opt.id)
                      return (
                        <label
                          key={opt.id}
                          className={cn(
                            'flex cursor-pointer items-center justify-between rounded-lg border p-2.5 text-xs transition-colors',
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary'
                              : 'border-border bg-card text-foreground hover:bg-muted',
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const checked = e.target.checked
                                setConfiguredOptions((prev) => {
                                  const current = prev[group.id] || []
                                  if (checked) {
                                    return {
                                      ...prev,
                                      [group.id]: group.maxSelected === 1 ? [opt.id] : [...current, opt.id],
                                    }
                                  } else {
                                    return {
                                      ...prev,
                                      [group.id]: current.filter((id) => id !== opt.id),
                                    }
                                  }
                                })
                              }}
                              className="rounded border-border text-primary focus:ring-primary"
                            />
                            {opt.name}
                          </span>
                          <span className="font-bold text-primary">
                            +{formatPrice(opt.priceDelta)}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}

              <div className="space-y-1.5 pt-2">
                <label
                  htmlFor="configuredNote"
                  className="block text-xs font-bold text-muted-foreground uppercase tracking-wider"
                >
                  Ghi chú thêm (ít đá, không đường,...)
                </label>
                <Input
                  id="configuredNote"
                  type="text"
                  maxLength={255}
                  placeholder="VD: Không đá, 50% đường"
                  value={configuredNote}
                  onChange={(e) => setConfiguredNote(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="mt-6 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfiguringItem(null)}
                className="flex-1"
              >
                Hủy
              </Button>
              <Button
                type="button"
                onClick={confirmConfiguredItem}
                className="flex-2"
              >
                Thêm vào đơn
              </Button>
            </DialogFooter>
          </div>
        )}
      </Dialog>

      {/* Modal chuyển bàn */}
      <Dialog
        open={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        maxWidth="sm"
      >
        <DialogHeader>
          <DialogTitle>Chuyển bàn phục vụ</DialogTitle>
          <DialogDescription>
            Bàn hiện tại: <strong className="text-foreground">{session.table?.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-2">
          <label htmlFor="transferSelect" className="block text-sm font-semibold text-foreground">
            Chọn bàn trống muốn chuyển sang:
          </label>
          <select
            id="transferSelect"
            value={targetTableId}
            onChange={(e) => setTargetTableId(e.target.value)}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <option value="">-- Chọn bàn trống --</option>
            {tablesQuery.data
              ?.filter((t) => t.status === 'EMPTY' && t.id !== session.table?.id)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </div>

        <DialogFooter className="mt-6 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowTransferModal(false)}
            className="flex-1"
          >
            Hủy
          </Button>
          <Button
            type="button"
            onClick={() => transferMutation.mutate()}
            isLoading={transferMutation.isPending}
            disabled={transferMutation.isPending || !targetTableId}
            className="flex-2"
          >
            Xác nhận chuyển
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Modal thanh toán tiền mặt */}
      {showCheckoutModal && (
        <CheckoutModal
          sessionId={session.id}
          totalAmount={String(existingUnpaidTotal)}
          onClose={() => setShowCheckoutModal(false)}
          onCompleted={() => {
            void queryClient.invalidateQueries({ queryKey: ['pos', 'session', sessionId] })
            void queryClient.invalidateQueries({ queryKey: ['private', 'dining-tables'] })
          }}
        />
      )}
    </div>
  )
}
