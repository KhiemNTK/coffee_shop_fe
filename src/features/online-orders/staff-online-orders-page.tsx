import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react'
import type { Session } from '../auth/session'
import {
  getPendingOnlineOrders,
  getFulfillmentOnlineOrders,
  acceptOnlineOrder,
  rejectOnlineOrder,
  cancelAcceptedOnlineOrder,
  markOnlineOrderNoShow,
  onlineOrderKeys,
  type FulfillmentOrder,
} from './online-orders.api'
import { kitchenKeys } from '../kitchen/kitchen.api'
import { errorMessage } from '../../shared/api/client'
import { Button, Tabs, TabsList, TabsTrigger } from '../../shared/ui'
import { Pagination } from '../../shared/ui/pagination'
import { StaffPendingOrdersTab } from './components/staff-pending-orders-tab'
import { PickupCollectionPanel } from './components/pickup-panels'
import { StaffFulfillmentOrdersTab } from './components/staff-fulfillment-orders-tab'
import { CollectOrderModal, OrderReviewDialog } from './components/staff-order-modals'

type ReviewAction =
  | { kind: 'accept' | 'no-show'; id: string }
  | { kind: 'reject' | 'cancel'; id: string; reason: string }
type ReviewTarget = { kind: 'reject' | 'cancel' | 'no-show'; id: string; name: string }

export default function StaffOnlineOrdersPage() {
  const { employee, authorization } = useOutletContext<Session>()
  const client = useQueryClient()
  const permissions = authorization.permissionKeys
  const canRead = permissions.includes('/online-orders_read')
  const canReview = permissions.includes('/online-orders_review')
  const canCollect =
    permissions.includes('/invoices_create') && permissions.includes('/orders_items_handoff')
  const [activeTab, setActiveTab] = useState<'pending' | 'fulfillment'>('pending')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [target, setTarget] = useState<ReviewTarget | null>(null)
  const [collecting, setCollecting] = useState<FulfillmentOrder | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reviewRequired, setReviewRequired] = useState(false)
  const flight = useRef(false)

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  const pending = useQuery({
    queryKey: [...onlineOrderKeys.all(employee.id), 'pending', page],
    queryFn: ({ signal }) => getPendingOnlineOrders({ page, itemPerPage: 20 }, signal),
    enabled: canRead && activeTab === 'pending',
    refetchInterval: 10_000,
  })
  const fulfillment = useQuery({
    queryKey: [...onlineOrderKeys.all(employee.id), 'fulfillment', page, overdueOnly],
    queryFn: ({ signal }) =>
      getFulfillmentOnlineOrders({ page, itemPerPage: 20, overdueOnly }, signal),
    enabled: canRead && activeTab === 'fulfillment',
    refetchInterval: 10_000,
  })
  const current = activeTab === 'pending' ? pending : fulfillment
  function invalidate() {
    for (const key of [
      onlineOrderKeys.all(employee.id),
      kitchenKeys.all(employee.id),
      ['private', employee.id, 'orders'],
      ['private', employee.id, 'invoices'],
      ['private', employee.id, 'cashier-shift'],
      ['private', employee.id, 'inventory-waste'],
      ['private', 'funds'],
    ])
      void client.invalidateQueries({ queryKey: key })
  }
  const mutation = useMutation({
    retry: false,
    mutationFn: async (action: ReviewAction) => {
      switch (action.kind) {
        case 'accept':
          await acceptOnlineOrder(action.id)
          break
        case 'reject':
          await rejectOnlineOrder(action.id, action.reason)
          break
        case 'cancel':
          await cancelAcceptedOnlineOrder(action.id, action.reason)
          break
        case 'no-show':
          await markOnlineOrderNoShow(action.id)
          break
      }
    },
    onSuccess: (_, action) => {
      setTarget(null)
      setActionError(null)
      setNotice(
        {
          accept: 'Đã tiếp nhận đơn và chuyển sang bếp.',
          reject: 'Đã từ chối đơn.',
          cancel: 'Đã hủy đơn mang đi.',
          'no-show': 'Đã ghi nhận khách vắng mặt.',
        }[action.kind],
      )
    },
    onError: (error) => {
      setReviewRequired(true)
      setActionError(errorMessage(error))
    },
    onSettled: () => {
      flight.current = false
      invalidate()
    },
  })
  const blocked = mutation.isPending || reviewRequired || current.isFetching || !current.isSuccess
  function submit(action: ReviewAction) {
    if (!canReview || flight.current || blocked) return
    flight.current = true
    setActionError(null)
    setNotice(null)
    mutation.mutate(action)
  }
  async function refresh() {
    if (flight.current) return
    const result = await current.refetch()
    if (result.isSuccess) {
      setReviewRequired(false)
      setActionError(null)
      setTarget(null)
    }
  }
  return (
    <div className="space-y-5">
      {permissions.includes('/orders_items_handoff') && <PickupCollectionPanel />}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Đơn mang đi (Online)</h1>
        <Button
          variant="outline"
          size="sm"
          disabled={current.isFetching || mutation.isPending}
          onClick={() => void refresh()}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Làm mới
        </Button>
      </header>
      {notice && (
        <p role="status" className="flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 size={18} aria-hidden="true" />
          {notice}
        </p>
      )}
      {actionError && !target && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
          <AlertCircle size={18} aria-hidden="true" />
          <p>{actionError}</p>
          {reviewRequired && (
            <Button
              variant="outline"
              size="sm"
              disabled={current.isFetching}
              onClick={() => void refresh()}
            >
              <RefreshCw size={16} aria-hidden="true" />
              Đối chiếu danh sách
            </Button>
          )}
        </div>
      )}
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value as typeof activeTab)
          setPage(1)
        }}
      >
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="pending">Chờ duyệt</TabsTrigger>
          <TabsTrigger value="fulfillment">Đang chế biến & Chờ nhận</TabsTrigger>
        </TabsList>
      </Tabs>
      {activeTab === 'pending' ? (
        <>
          {pending.isSuccess && (
            <p className="text-sm text-muted-foreground">
              Tổng: {pending.data.totalItems} đơn chờ duyệt
            </p>
          )}
          <StaffPendingOrdersTab
            orders={pending.data?.list ?? []}
            isLoading={pending.isPending}
            isError={pending.isError}
            error={pending.error}
            onRefetch={() => void refresh()}
            nowMs={nowMs}
            canReview={canReview}
            isBlocked={blocked}
            isAcceptPending={mutation.isPending}
            onAccept={(id) => submit({ kind: 'accept', id })}
            onReject={(order) => {
              if (!blocked) setTarget({ kind: 'reject', id: order.id, name: order.pickupName })
            }}
          />
        </>
      ) : (
        <StaffFulfillmentOrdersTab
          orders={fulfillment.data?.list ?? []}
          totalItems={fulfillment.data?.totalItems}
          isLoading={fulfillment.isPending}
          isError={fulfillment.isError}
          error={fulfillment.error}
          onRefetch={() => void refresh()}
          overdueOnly={overdueOnly}
          setOverdueOnly={(value) => {
            setOverdueOnly(value)
            setPage(1)
          }}
          canReview={canReview}
          canCollect={canCollect && !blocked}
          onCollect={setCollecting}
          isNoShowPending={blocked}
          onNoShow={(id) => {
            const order = fulfillment.data?.list.find((value) => value.id === id)
            if (order && !blocked) setTarget({ kind: 'no-show', id, name: order.pickupName })
          }}
          onCancel={(order) => {
            if (!blocked) setTarget({ kind: 'cancel', id: order.id, name: order.pickupName })
          }}
        />
      )}
      {current.isSuccess && (
        <>
          {(current.data.totalPages > 1 || page > 1) && (
            <Pagination
              page={page}
              totalPages={current.data.totalPages}
              disabled={current.isFetching || mutation.isPending}
              onPage={setPage}
            />
          )}
          {page > Math.max(1, current.data.totalPages) && (
            <Button variant="outline" onClick={() => setPage(1)}>
              Về trang đầu
            </Button>
          )}
        </>
      )}
      {canReview && target && (
        <OrderReviewDialog
          key={target.kind + target.id}
          kind={target.kind}
          name={target.name}
          isPending={mutation.isPending}
          blocked={blocked}
          error={actionError}
          onReview={() => void refresh()}
          onClose={() => {
            if (!flight.current) setTarget(null)
          }}
          onConfirm={(reason) =>
            submit(
              target.kind === 'no-show'
                ? { kind: 'no-show', id: target.id }
                : { kind: target.kind, id: target.id, reason },
            )
          }
        />
      )}
      {canCollect && collecting && (
        <CollectOrderModal
          key={collecting.id}
          order={collecting}
          onClose={() => setCollecting(null)}
          onSettled={invalidate}
          onSuccess={() => {
            setCollecting(null)
            setNotice('Thu tiền và giao món thành công.')
            invalidate()
          }}
        />
      )}
    </div>
  )
}
