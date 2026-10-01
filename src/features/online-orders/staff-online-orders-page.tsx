import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import {
  AlertCircle,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  Package,
  Phone,
  RefreshCw,
  User,
  UserX,
} from 'lucide-react'
import { type Session } from '../auth/session'
import { formatPrice } from '../menu/menu.api'
import {
  getPendingOnlineOrders,
  getFulfillmentOnlineOrders,
  acceptOnlineOrder,
  rejectOnlineOrder,
  collectOnlineOrder,
  cancelAcceptedOnlineOrder,
  markOnlineOrderNoShow,
  type PendingOrder,
  type FulfillmentOrder,
} from './online-orders.api'
import { errorMessage } from '../../shared/api/client'
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  Textarea,
  Tabs,
  TabsList,
  TabsTrigger,
} from '../../shared/ui'

export default function StaffOnlineOrdersPage() {
  const { authorization } = useOutletContext<Session>()
  const queryClient = useQueryClient()

  const canReview = authorization.permissionKeys.includes(
    '/online-orders_review',
  )
  const canCollect =
    authorization.permissionKeys.includes('/invoices_create') &&
    authorization.permissionKeys.includes('/orders_items_handoff')

  const [activeTab, setActiveTab] = useState<'pending' | 'fulfillment'>('pending')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  // Dialog states
  const [rejectingOrder, setRejectingOrder] = useState<PendingOrder | null>(null)
  const [collectingOrder, setCollectingOrder] = useState<FulfillmentOrder | null>(null)
  const [cancellingOrder, setCancellingOrder] = useState<FulfillmentOrder | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  // Queries
  const pendingQuery = useQuery({
    queryKey: ['online-orders', 'pending', page],
    queryFn: ({ signal }) => getPendingOnlineOrders({ page, itemPerPage: 20 }, signal),
    refetchInterval: 10_000,
  })

  const fulfillmentQuery = useQuery({
    queryKey: ['online-orders', 'fulfillment', { page, overdueOnly }],
    queryFn: ({ signal }) =>
      getFulfillmentOnlineOrders({ page, itemPerPage: 20, overdueOnly }, signal),
    refetchInterval: 10_000,
  })

  // Mutations
  const acceptMutation = useMutation({
    mutationFn: (id: string) => acceptOnlineOrder(id),
    onSuccess: () => {
      setActionError(null)
      setSuccessNotice('Đã tiếp nhận đơn hàng và chuyển sang bếp/pha chế.')
      void queryClient.invalidateQueries({ queryKey: ['online-orders'] })
      setTimeout(() => setSuccessNotice(null), 3500)
    },
    onError: (err) => {
      setActionError(errorMessage(err))
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectOnlineOrder(id, reason),
    onSuccess: () => {
      setRejectingOrder(null)
      setActionError(null)
      setSuccessNotice('Đã từ chối đơn hàng.')
      void queryClient.invalidateQueries({ queryKey: ['online-orders'] })
      setTimeout(() => setSuccessNotice(null), 3500)
    },
    onError: (err) => {
      setActionError(errorMessage(err))
    },
  })

  const cancelAcceptedMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      cancelAcceptedOnlineOrder(id, reason),
    onSuccess: () => {
      setCancellingOrder(null)
      setActionError(null)
      setSuccessNotice('Đã hủy đơn hàng mang đi.')
      void queryClient.invalidateQueries({ queryKey: ['online-orders'] })
      setTimeout(() => setSuccessNotice(null), 3500)
    },
    onError: (err) => {
      setActionError(errorMessage(err))
    },
  })

  const noShowMutation = useMutation({
    mutationFn: (id: string) => markOnlineOrderNoShow(id),
    onSuccess: () => {
      setActionError(null)
      setSuccessNotice('Đã ghi nhận khách vắng mặt (No-show).')
      void queryClient.invalidateQueries({ queryKey: ['online-orders'] })
      setTimeout(() => setSuccessNotice(null), 3500)
    },
    onError: (err) => {
      setActionError(errorMessage(err))
    },
  })

  const pendingCount = pendingQuery.data?.totalItems ?? 0
  const fulfillmentCount = fulfillmentQuery.data?.totalItems ?? 0

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#68776f]">
            QUẢN LÝ ĐƠN HÀNG
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-[#1a2723] mt-1">
            Đơn mang đi (Online)
          </h1>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void pendingQuery.refetch()
            void fulfillmentQuery.refetch()
          }}
          disabled={pendingQuery.isFetching || fulfillmentQuery.isFetching}
        >
          <RefreshCw
            size={14}
            className={
              pendingQuery.isFetching || fulfillmentQuery.isFetching
                ? 'animate-spin'
                : ''
            }
          />
          Làm mới
        </Button>
      </div>

      {/* Global Alerts */}
      {successNotice && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
        >
          <CheckCircle2 size={18} />
          <span>{successNotice}</span>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          <AlertCircle size={18} />
          <span>{actionError}</span>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val as 'pending' | 'fulfillment')
          setPage(1)
        }}
      >
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="pending" className="gap-2">
            <span>Chờ duyệt</span>
            {pendingCount > 0 && (
              <Badge variant="warning">{pendingCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="fulfillment" className="gap-2">
            <span>Đang chế biến & Chờ nhận</span>
            {fulfillmentCount > 0 && (
              <Badge variant="secondary">{fulfillmentCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ========================================================================= */}
      {/* TAB 1: PENDING ORDERS */}
      {/* ========================================================================= */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {pendingQuery.isLoading && (
            <div className="py-12 text-center text-sm text-[#68776f]">
              Đang tải danh sách đơn chờ duyệt…
            </div>
          )}

          {pendingQuery.isError && (
            <div className="flex items-center gap-3 text-sm text-red-700 bg-red-50 p-4 rounded-lg">
              <AlertCircle size={16} />
              <span>{errorMessage(pendingQuery.error)}</span>
              <Button
                variant="link"
                onClick={() => void pendingQuery.refetch()}
                className="text-red-700 font-semibold"
              >
                Thử lại
              </Button>
            </div>
          )}

          {pendingQuery.data && pendingQuery.data.list.length === 0 && (
            <Card className="border-dashed p-12 text-center text-[#68776f]">
              <Package size={36} className="mx-auto mb-3 text-[#9ba8a0]" />
              <p className="text-base font-semibold text-[#1a2723]">
                Không có đơn hàng nào đang chờ duyệt
              </p>
              <p className="text-sm mt-1 text-[#68776f]">
                Đơn hàng online mới sẽ hiển thị tại đây theo thời gian thực.
              </p>
            </Card>
          )}

          {pendingQuery.data && pendingQuery.data.list.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {pendingQuery.data.list.map((order) => {
                const expiresAt = new Date(order.expiresAt)
                const isUrgent = expiresAt.getTime() - nowMs < 5 * 60_000
                return (
                  <Card
                    key={order.id}
                    className="flex flex-col justify-between shadow-xs hover:shadow-sm transition-shadow"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <User size={15} className="text-[#174f3f]" />
                            <CardTitle>{order.pickupName}</CardTitle>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-[#68776f] mt-1">
                            <Phone size={13} />
                            <span>{order.phoneNumber}</span>
                          </div>
                        </div>

                        <Badge variant={isUrgent ? 'destructive' : 'warning'}>
                          <Clock size={11} />
                          Hạn: {expiresAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Badge>
                      </div>

                      {/* Pickup Time info */}
                      <div className="mt-3 rounded-md bg-[#f2f6f3] px-3 py-1.5 text-xs text-[#202d29]">
                        <span className="font-semibold">Thời gian nhận: </span>
                        {order.pickupAt
                          ? new Date(order.pickupAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                            })
                          : '⚡ Lấy sớm nhất có thể'}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3 flex-1">
                      <div className="border-t border-[#f0f4f1] pt-3 space-y-2 text-xs">
                        {order.items.map((it, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-baseline"
                          >
                            <div>
                              <span>
                                <strong>{it.quantity}x</strong> {it.quotedName}
                              </span>
                              {it.note && (
                                <p className="text-[11px] text-[#68776f] mt-0.5">
                                  ({it.note})
                                </p>
                              )}
                            </div>
                            <span className="font-semibold text-[#174f3f]">
                              {formatPrice(String(Number(it.quotedUnitPrice) * it.quantity))}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between items-baseline border-t border-dashed border-[#dce5df] pt-2">
                        <span className="text-xs text-[#68776f]">Tổng tiền:</span>
                        <strong className="text-base text-[#174f3f]">
                          {formatPrice(order.quotedSubtotal)}
                        </strong>
                      </div>
                    </CardContent>

                    <CardFooter className="grid grid-cols-2 gap-2 pt-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRejectingOrder(order)}
                        disabled={!canReview || acceptMutation.isPending}
                        className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                      >
                        Từ chối
                      </Button>

                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => acceptMutation.mutate(order.id)}
                        disabled={!canReview || acceptMutation.isPending}
                        isLoading={acceptMutation.isPending}
                      >
                        <Check size={14} />
                        Duyệt đơn
                      </Button>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: FULFILLMENT ORDERS */}
      {/* ========================================================================= */}
      {activeTab === 'fulfillment' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-lg border border-[#dce5df] text-xs font-medium">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={(e) => setOverdueOnly(e.target.checked)}
                className="rounded border-[#bccdc3] text-[#174f3f] focus:ring-[#174f3f]"
              />
              <span>Chỉ hiển thị đơn trễ hẹn (Overdue)</span>
            </label>

            <span className="text-[#68776f]">
              Tổng: {fulfillmentCount} đơn đang xử lý
            </span>
          </div>

          {fulfillmentQuery.isLoading && (
            <div className="py-12 text-center text-sm text-[#68776f]">
              Đang tải danh sách đơn chế biến & bàn giao…
            </div>
          )}

          {fulfillmentQuery.isError && (
            <div className="flex items-center gap-3 text-sm text-red-700 bg-red-50 p-4 rounded-lg">
              <AlertCircle size={16} />
              <span>{errorMessage(fulfillmentQuery.error)}</span>
              <Button
                variant="link"
                onClick={() => void fulfillmentQuery.refetch()}
                className="text-red-700 font-semibold"
              >
                Thử lại
              </Button>
            </div>
          )}

          {fulfillmentQuery.data && fulfillmentQuery.data.list.length === 0 && (
            <Card className="border-dashed p-12 text-center text-[#68776f]">
              <Package size={36} className="mx-auto mb-3 text-[#9ba8a0]" />
              <p className="text-base font-semibold text-[#1a2723]">
                Không có đơn hàng nào đang chờ bàn giao
              </p>
              <p className="text-sm mt-1 text-[#68776f]">
                Sau khi duyệt đơn ở tab "Chờ duyệt", đơn hàng sẽ hiển thị tại đây.
              </p>
            </Card>
          )}

          {fulfillmentQuery.data && fulfillmentQuery.data.list.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {fulfillmentQuery.data.list.map((order) => {
                const isReady = order.fulfillmentStatus === 'READY'
                return (
                  <Card
                    key={order.id}
                    className={`flex flex-col justify-between transition-all ${
                      isReady ? 'ring-2 ring-emerald-600 bg-emerald-50/20' : ''
                    }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle>{order.pickupName}</CardTitle>
                            <code className="text-xs bg-[#f2f6f3] px-1.5 py-0.5 rounded text-[#174f3f] font-bold">
                              #{order.id.slice(0, 8).toUpperCase()}
                            </code>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-[#68776f] mt-1">
                            <Phone size={13} />
                            <span>{order.phoneNumber}</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          {isReady ? (
                            <Badge variant="success">✓ Sẵn sàng lấy</Badge>
                          ) : (
                            <Badge variant="secondary">Đang chế biến</Badge>
                          )}

                          {order.isOverdue && (
                            <Badge variant="destructive">Trễ hẹn</Badge>
                          )}
                        </div>
                      </div>

                      {/* Pickup Timing */}
                      <div className="mt-3 rounded-md bg-[#f8faf9] px-3 py-1.5 text-xs text-[#202d29]">
                        <span className="font-semibold">Giờ hẹn: </span>
                        {order.pickupAt
                          ? new Date(order.pickupAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                            })
                          : '⚡ Sớm nhất'}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3 flex-1">
                      <div className="border-t border-[#f0f4f1] pt-3 space-y-2 text-xs">
                        {order.orderItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex justify-between items-center"
                          >
                            <span>
                              <strong>{item.quantity}x</strong> {item.menuItem.name}
                            </span>
                            <Badge
                              variant={
                                item.serveStatus === 'READY'
                                  ? 'success'
                                  : item.serveStatus === 'COOKING'
                                    ? 'warning'
                                    : 'secondary'
                              }
                            >
                              {item.serveStatus === 'READY'
                                ? 'Đã xong'
                                : item.serveStatus === 'COOKING'
                                  ? 'Đang làm'
                                  : 'Chờ làm'}
                            </Badge>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between items-baseline border-t border-dashed border-[#dce5df] pt-2">
                        <span className="text-xs text-[#68776f]">Thu tiền mặt:</span>
                        <strong className="text-base text-[#174f3f]">
                          {formatPrice(order.quotedSubtotal)}
                        </strong>
                      </div>
                    </CardContent>

                    <CardFooter className="flex-col gap-2 pt-0">
                      <Button
                        variant={isReady ? 'success' : 'secondary'}
                        size="default"
                        onClick={() => setCollectingOrder(order)}
                        disabled={!canCollect || !isReady}
                        className="w-full"
                      >
                        <DollarSign size={16} />
                        Khách nhận & Thu tiền
                      </Button>

                      <div className="flex w-full justify-end gap-3 text-xs">
                        {order.isNoShowEligible && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => noShowMutation.mutate(order.id)}
                            disabled={noShowMutation.isPending}
                            className="h-auto p-0 text-amber-700 hover:text-amber-800"
                          >
                            <UserX size={13} />
                            Báo vắng mặt (No-show)
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCancellingOrder(order)}
                          className="h-auto p-0 text-red-600 hover:text-red-700"
                        >
                          <Ban size={13} />
                          Hủy đơn
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: REJECT ORDER DIALOG */}
      {/* ========================================================================= */}
      {rejectingOrder && (
        <RejectOrderDialog
          order={rejectingOrder}
          onClose={() => setRejectingOrder(null)}
          onConfirm={(reason) =>
            rejectMutation.mutate({ id: rejectingOrder.id, reason })
          }
          isPending={rejectMutation.isPending}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: COLLECT ORDER & CASH PAYMENT MODAL */}
      {/* ========================================================================= */}
      {collectingOrder && (
        <CollectOrderModal
          order={collectingOrder}
          onClose={() => setCollectingOrder(null)}
          onSuccess={() => {
            setCollectingOrder(null)
            setSuccessNotice('Thu tiền & giao món thành công!')
            void queryClient.invalidateQueries({ queryKey: ['online-orders'] })
            setTimeout(() => setSuccessNotice(null), 3500)
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CANCEL ACCEPTED ORDER DIALOG */}
      {/* ========================================================================= */}
      {cancellingOrder && (
        <CancelAcceptedDialog
          order={cancellingOrder}
          onClose={() => setCancellingOrder(null)}
          onConfirm={(reason) =>
            cancelAcceptedMutation.mutate({ id: cancellingOrder.id, reason })
          }
          isPending={cancelAcceptedMutation.isPending}
        />
      )}
    </div>
  )
}

// ============================================================================
// REJECT DIALOG COMPONENT
// ============================================================================

function RejectOrderDialog({
  order,
  onClose,
  onConfirm,
  isPending,
}: {
  order: PendingOrder
  onClose: () => void
  onConfirm: (reason: string) => void
  isPending: boolean
}) {
  const [reason, setReason] = useState('')
  const quickReasons = [
    'Quán đang quá tải giờ cao điểm',
    'Hết nguyên liệu pha chế',
    'Quán sắp đóng cửa',
    'Không liên hệ được khách hàng',
  ]

  return (
    <Dialog open={true} onClose={onClose}>
      <DialogHeader>
        <DialogTitle className="text-red-700">
          Từ chối đơn của {order.pickupName}
        </DialogTitle>
        <DialogDescription>
          Vui lòng chọn hoặc nhập lý do từ chối để thông báo cho khách hàng:
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 my-4">
        <div className="flex flex-wrap gap-1.5">
          {quickReasons.map((r) => (
            <Button
              key={r}
              type="button"
              variant={reason === r ? 'default' : 'outline'}
              size="sm"
              onClick={() => setReason(r)}
              className="text-xs h-7"
            >
              {r}
            </Button>
          ))}
        </div>

        <Textarea
          rows={3}
          required
          placeholder="Nhập lý do cụ thể (tối thiểu 2 ký tự)..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Quay lại
        </Button>
        <Button
          variant="destructive"
          disabled={reason.trim().length < 2 || isPending}
          isLoading={isPending}
          onClick={() => onConfirm(reason.trim())}
        >
          Xác nhận từ chối
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

// ============================================================================
// COLLECT ORDER MODAL (CUSTOMER TOKEN VERIFICATION + CASH TENDERED)
// ============================================================================

function CollectOrderModal({
  order,
  onClose,
  onSuccess,
}: {
  order: FulfillmentOrder
  onClose: () => void
  onSuccess: () => void
}) {
  const [accessToken, setAccessToken] = useState('')
  const [amountTendered, setAmountTendered] = useState(() =>
    String(Math.ceil(Number(order.quotedSubtotal))),
  )
  const [modalError, setModalError] = useState<string | null>(null)
  const [idempotencyKey] = useState(() => crypto.randomUUID())

  const totalNumber = Number(order.quotedSubtotal)
  const tenderedNumber = Number(amountTendered) || 0
  const changeAmount = Math.max(0, tenderedNumber - totalNumber)

  const collectMutation = useMutation({
    mutationFn: () =>
      collectOnlineOrder(order.id, {
        accessToken: accessToken.trim().toLowerCase(),
        amountTendered: Number(amountTendered).toFixed(2),
        idempotencyKey,
      }),
    onSuccess: () => {
      onSuccess()
    },
    onError: (err) => {
      setModalError(errorMessage(err))
    },
  })

  function handleCollectSubmit(e: React.FormEvent) {
    e.preventDefault()
    setModalError(null)

    const cleanToken = accessToken.trim().toLowerCase()
    if (!/^[0-9a-f]{64}$/.test(cleanToken)) {
      setModalError(
        'Mã xác thực khách hàng (Access Token) phải là chuỗi 64 ký tự hex.',
      )
      return
    }

    if (tenderedNumber < totalNumber) {
      setModalError('Tiền khách đưa không được nhỏ hơn tổng tiền đơn hàng.')
      return
    }

    collectMutation.mutate()
  }

  return (
    <Dialog open={true} onClose={onClose} className="max-w-md">
      <DialogHeader>
        <DialogTitle>Bàn giao món & Thu tiền mặt</DialogTitle>
        <DialogDescription>
          Khách hàng: {order.pickupName} ({order.phoneNumber})
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleCollectSubmit} className="space-y-4 my-2">
        <div>
          <label className="block text-xs font-semibold text-[#202d29] mb-1">
            Mã xác thực khách hàng (Access Token 64 hex) <span className="text-red-600">*</span>
          </label>
          <Input
            type="text"
            required
            placeholder="Dán hoặc nhập mã 64 ký tự từ màn hình khách..."
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            className="font-mono text-xs"
          />
          <span className="text-[11px] text-[#68776f] mt-1 block">
            Khách hàng bấm nút sao chép mã nhận hàng trên điện thoại để cung cấp.
          </span>
        </div>

        <div className="rounded-lg border border-[#dce5df] bg-[#f8faf9] p-3.5 space-y-3 text-sm">
          <div className="flex justify-between items-baseline">
            <span className="text-[#68776f]">Cần thanh toán:</span>
            <strong className="text-lg text-[#174f3f]">
              {formatPrice(order.quotedSubtotal)}
            </strong>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#202d29] mb-1">
              Tiền khách đưa (VNĐ)
            </label>
            <Input
              type="number"
              step="1000"
              min={totalNumber}
              required
              value={amountTendered}
              onChange={(e) => setAmountTendered(e.target.value)}
              className="text-base font-bold"
            />
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {[totalNumber, 50000, 100000, 200000, 500000]
              .filter((amt) => amt >= totalNumber)
              .map((amt) => (
                <Button
                  key={amt}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAmountTendered(String(amt))}
                  className="h-7 text-xs"
                >
                  {formatPrice(String(amt))}
                </Button>
              ))}
          </div>

          <div className="flex justify-between items-baseline border-t border-dashed border-[#cbd7cf] pt-2">
            <span className="text-xs text-[#4b6155]">Tiền thối lại:</span>
            <strong
              className={`text-base ${
                changeAmount > 0 ? 'text-amber-700' : 'text-[#174f3f]'
              }`}
            >
              {formatPrice(String(changeAmount))}
            </strong>
          </div>
        </div>

        {modalError && (
          <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded border border-red-200">
            {modalError}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose}>
            Hủy
          </Button>
          <Button
            variant="success"
            type="submit"
            disabled={collectMutation.isPending}
            isLoading={collectMutation.isPending}
          >
            <Check size={16} />
            Xác nhận thu tiền & Giao
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

// ============================================================================
// CANCEL ACCEPTED DIALOG COMPONENT
// ============================================================================

function CancelAcceptedDialog({
  order,
  onClose,
  onConfirm,
  isPending,
}: {
  order: FulfillmentOrder
  onClose: () => void
  onConfirm: (reason: string) => void
  isPending: boolean
}) {
  const [reason, setReason] = useState('')

  return (
    <Dialog open={true} onClose={onClose}>
      <DialogHeader>
        <DialogTitle className="text-red-700">
          Hủy đơn hàng #{order.id.slice(0, 8)}?
        </DialogTitle>
        <DialogDescription>
          Nhập lý do hủy đơn (VD: Khách gọi điện báo hủy, sự cố pha chế...):
        </DialogDescription>
      </DialogHeader>

      <div className="my-3">
        <Textarea
          rows={3}
          required
          placeholder="Nhập lý do..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Quay lại
        </Button>
        <Button
          variant="destructive"
          disabled={reason.trim().length < 2 || isPending}
          isLoading={isPending}
          onClick={() => onConfirm(reason.trim())}
        >
          Xác nhận hủy
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
