import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import {
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react'
import { type Session } from '../auth/session'
import {
  getPendingOnlineOrders,
  getFulfillmentOnlineOrders,
  acceptOnlineOrder,
  rejectOnlineOrder,
  cancelAcceptedOnlineOrder,
  markOnlineOrderNoShow,
  type PendingOrder,
  type FulfillmentOrder,
} from './online-orders.api'
import { errorMessage } from '../../shared/api/client'
import {
  Badge,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
} from '../../shared/ui'
import { StaffPendingOrdersTab } from './components/staff-pending-orders-tab'
import { StaffFulfillmentOrdersTab } from './components/staff-fulfillment-orders-tab'
import {
  RejectOrderDialog,
  CollectOrderModal,
  CancelAcceptedDialog,
} from './components/staff-order-modals'

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

      {/* TAB 1: PENDING ORDERS */}
      {activeTab === 'pending' && (
        <StaffPendingOrdersTab
          orders={pendingQuery.data?.list ?? []}
          isLoading={pendingQuery.isLoading}
          isError={pendingQuery.isError}
          error={pendingQuery.error}
          onRefetch={() => void pendingQuery.refetch()}
          nowMs={nowMs}
          canReview={canReview}
          isAcceptPending={acceptMutation.isPending}
          onAccept={(id) => acceptMutation.mutate(id)}
          onReject={(order) => setRejectingOrder(order)}
        />
      )}

      {/* TAB 2: FULFILLMENT ORDERS */}
      {activeTab === 'fulfillment' && (
        <StaffFulfillmentOrdersTab
          orders={fulfillmentQuery.data?.list ?? []}
          totalItems={fulfillmentCount}
          isLoading={fulfillmentQuery.isLoading}
          isError={fulfillmentQuery.isError}
          error={fulfillmentQuery.error}
          onRefetch={() => void fulfillmentQuery.refetch()}
          overdueOnly={overdueOnly}
          setOverdueOnly={setOverdueOnly}
          canCollect={canCollect}
          onCollect={(order) => setCollectingOrder(order)}
          onNoShow={(id) => noShowMutation.mutate(id)}
          isNoShowPending={noShowMutation.isPending}
          onCancel={(order) => setCancellingOrder(order)}
        />
      )}

      {/* MODAL 1: REJECT ORDER DIALOG */}
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

      {/* MODAL 2: COLLECT ORDER & CASH PAYMENT MODAL */}
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

      {/* MODAL 3: CANCEL ACCEPTED ORDER DIALOG */}
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
