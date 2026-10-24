import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import { CheckCircle2, RefreshCw, ExternalLink, Eye } from 'lucide-react'
import { z } from 'zod'
import {
  operationsApi,
  ManagementExceptionKindSchema,
  type ManagementExceptionsSummary,
  type ManagementExceptionItem,
  type ManagementExceptionKind,
} from './operations.api'
import type { Session } from '../auth/session'
import { closeIncident, resolveFeedback } from '../reconciliation/reconciliation.api'
import { reconcilePaymentAttempt } from '../invoices/invoices.api'
import { ApiError, errorMessage } from '@/shared/api/client'
import { useRetryAfter } from '@/shared/api/use-retry-after'
import { formatVnd } from '@/shared/lib/format'
import { formatStoreDateTime } from '@/shared/lib/store-time'
import {
  Button,
  Badge,
  Dialog,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  AdminTable,
  ApiErrorAlert,
} from '@/shared/ui'
import { Pagination } from '@/shared/ui/pagination'

const exceptionKinds: { id: ManagementExceptionKind; label: string }[] = [
  { id: 'PAYMENT', label: 'Đối soát Cổng TT' },
  { id: 'CASH_EXPENSE', label: 'Chi quỹ tiền mặt' },
  { id: 'CASH_HANDOVER', label: 'Bàn giao ca' },
  { id: 'FEEDBACK', label: 'Khiếu nại khách' },
  { id: 'KITCHEN_OVERDUE', label: 'Phiếu bếp trễ' },
  { id: 'ONLINE_PICKUP_LATE', label: 'Đơn quá giờ hẹn' },
  { id: 'OUTBOX_DEAD_LETTER', label: 'Event lỗi' },
]

function itemTitle(item: ManagementExceptionItem) {
  return (
    item.title ||
    item.eventName ||
    item.description ||
    item.comment ||
    (item.station
      ? item.station.code + '-' + item.sequence + ' · ' + item.station.name
      : 'Phiếu ' + item.id)
  )
}

export function ManagementExceptionsTab({ summary }: { summary?: ManagementExceptionsSummary }) {
  const { employee, access } = useOutletContext<Session>()
  const can = access.has
  const client = useQueryClient()
  const flight = useRef(false)
  const [queuedMessage, setQueuedMessage] = useState('')
  const [params, setParams] = useSearchParams()
  const kind = ManagementExceptionKindSchema.safeParse(params.get('kind')).data ?? 'PAYMENT'
  const page =
    z.coerce
      .number()
      .int()
      .min(1)
      .max(100_000)
      .safeParse(params.get('page') ?? 1).data ?? 1
  const selectedId = params.get('exception')
  const query = useQuery({
    queryKey: ['management-exceptions-list', employee.id, kind, page],
    queryFn: ({ signal }) =>
      operationsApi.getManagementExceptions({ kind, page, itemPerPage: 20 }, signal),
    refetchInterval: selectedId && kind === 'OUTBOX_DEAD_LETTER' ? false : 30_000,
    refetchOnWindowFocus: !selectedId || kind !== 'OUTBOX_DEAD_LETTER',
  })
  const selected = query.data?.list.find((item) => item.id === selectedId)
  function update(changes: Record<string, string | null>, replace = false) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        for (const [key, value] of Object.entries(changes)) {
          if (value === null) next.delete(key)
          else next.set(key, value)
        }
        return next
      },
      { replace }
    )
  }
  const action = useMutation({
    retry: false,
    mutationFn: async ({
      command,
      note = '',
      customerReply,
      outbox,
    }: {
      command: 'RESOLVE' | 'IGNORE' | 'RECONCILE' | 'RETRY_EVENT'
      note?: string
      customerReply?: string
      outbox?: { id: string; expectedAvailableAt: string }
    }) => {
      if (command === 'RETRY_EVENT') {
        if (!outbox || !can('/outbox-events_retry'))
          throw new Error('Bạn không có quyền phục hồi event này.')
        return operationsApi.retryOutboxEvent(outbox.id, {
          reason: note.trim(),
          expectedAvailableAt: outbox.expectedAvailableAt,
        })
      }
      if (!selected || query.isError || query.isFetching)
        throw new Error('Cần tải lại ngoại lệ trước khi xử lý.')
      if (command === 'RECONCILE') {
        if (
          kind !== 'PAYMENT' ||
          !can('/payment-reconciliation_manage') ||
          !selected.paymentAttemptId
        )
          throw new Error('Không thể đối soát ngoại lệ này.')
        return reconcilePaymentAttempt(selected.paymentAttemptId)
      }
      if (note.trim().length < 3) throw new Error('Cần ghi chú xử lý.')
      if (kind === 'FEEDBACK' && can('/feedback_resolve'))
        return resolveFeedback(selected.id, note.trim(), customerReply)
      if (kind === 'PAYMENT' && can('/payment-reconciliation_manage'))
        return closeIncident(selected.id, command === 'IGNORE' ? 'IGNORE' : 'RESOLVE', note.trim())
      throw new Error('Bạn không có quyền xử lý ngoại lệ này.')
    },
    onSuccess: (_data, { command }) => {
      if (command === 'RETRY_EVENT')
        setQueuedMessage('Đã đưa event lại vào hàng đợi. Đang chờ worker xử lý.')
      if (command !== 'RECONCILE') update({ exception: null }, true)
    },
    onSettled: (_data, error, variables) => {
      flight.current = false
      if (variables.command === 'RETRY_EVENT' && error) return
      void client.invalidateQueries({
        queryKey: ['management-exceptions-list'],
      })
      void client.invalidateQueries({
        queryKey: ['management-exceptions-summary'],
      })
      void client.invalidateQueries({
        queryKey: ['private', employee.id, 'reconciliation'],
      })
    },
  })
  const retryWait = useRetryAfter(action.error ?? query.error)
  const blocked =
    retryWait > 0 || action.isPending || action.isError || query.isFetching || query.isError
  const close = () => {
    if (!action.isPending) {
      update({ exception: null }, true)
      action.reset()
    }
  }
  return (
    <section className="space-y-4" aria-label="Hàng đợi ngoại lệ">
      {queuedMessage && <p role="status">{queuedMessage}</p>}
      <Tabs
        value={kind}
        onValueChange={(value) => {
          if (!action.isPending) {
            update({ kind: value, page: null, exception: null })
            action.reset()
          }
        }}
      >
        <TabsList aria-label="Loại ngoại lệ" className="admin-tabs gap-1">
          {exceptionKinds.map((entry) => (
            <TabsTrigger
              key={entry.id}
              value={entry.id}
              disabled={action.isPending}
              className="min-h-11 gap-2"
            >
              {entry.label}
              <Badge variant={kind === entry.id ? 'outline' : 'secondary'}>
                {summary ? summary.counts[entry.id] : '—'}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={kind} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {query.isSuccess
                ? query.data.totalItems +
                  ' việc · ' +
                  formatStoreDateTime(new Date(query.dataUpdatedAt).toISOString())
                : 'Chưa có dữ liệu xác nhận'}
            </p>
            <Button
              variant="outline"
              size="icon"
              aria-label="Làm mới danh sách"
              title="Làm mới danh sách"
              disabled={query.isFetching || action.isPending}
              onClick={() => {
                action.reset()
                void query.refetch()
              }}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          {query.isError ? (
            <div role="alert" className="space-y-2 border-l-4 border-destructive p-4">
              <p>{errorMessage(query.error)}</p>
              <Button variant="outline" onClick={() => void query.refetch()}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Thử lại
              </Button>
            </div>
          ) : query.isPending ? (
            <p role="status">Đang tải danh sách ngoại lệ quản trị...</p>
          ) : query.data.list.length === 0 && query.data.totalItems > 0 ? (
            <p className="py-6 text-sm">Không có ngoại lệ trên trang này.</p>
          ) : query.data.list.length === 0 ? (
            <div className="flex items-center gap-2 py-8">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              Không có ngoại lệ tồn đọng
            </div>
          ) : (
            <AdminTable label="Hàng đợi ngoại lệ quản trị">
              <thead>
                <tr>
                  <th>Vấn đề / Sự cố</th>
                  <th>Danh mục</th>
                  <th>Trạng thái</th>
                  <th>Thông tin liên quan</th>
                  <th>Mốc thời gian</th>
                  <th className="text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {query.data.list.map((item) => {
                  const date =
                    item.occurredAt ||
                    item.dueAt ||
                    item.pickupAt ||
                    item.createdAt ||
                    item.detectedAt
                  return (
                    <tr key={item.id} className="align-top">
                      <td className="max-w-80">
                        <p className="break-words font-semibold">{itemTitle(item)}</p>
                        {item.description && item.description !== itemTitle(item) && (
                          <p
                            className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground"
                            title={item.description}
                          >
                            {item.description}
                          </p>
                        )}
                        {item.amount !== undefined && <p>{formatVnd(item.amount)}</p>}
                      </td>
                      <td>
                        <Badge variant="secondary">
                          {exceptionKinds.find((entry) => entry.id === kind)?.label}
                        </Badge>
                      </td>
                      <td>
                        <Badge
                          variant={item.status === 'PENDING' ? 'warning' : 'outline'}
                          title={item.status}
                        >
                          {item.status === 'PENDING'
                            ? 'Chờ xử lý'
                            : item.status || (item.rating ? item.rating + ' sao' : '—')}
                        </Badge>
                      </td>
                      <td className="max-w-56 text-xs text-muted-foreground">
                        <span className="break-all font-mono" title={item.id}>
                          #{item.id.slice(-8).toUpperCase()}
                        </span>
                        {item.paymentAttemptId && (
                          <p className="mt-1 break-all" title={item.paymentAttemptId}>
                            Payment: {item.paymentAttemptId.slice(-8)}
                          </p>
                        )}
                      </td>
                      <td className="text-xs text-muted-foreground">
                        {date ? formatStoreDateTime(date) : '—'}
                      </td>
                      <td className="text-right">
                        <Button
                          variant="outline"
                          disabled={action.isPending}
                          onClick={() => {
                            update({ exception: item.id })
                            action.reset()
                          }}
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          Chi tiết
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </AdminTable>
          )}
          {query.isSuccess && (
            <Pagination
              page={page}
              totalPages={query.data.totalPages}
              onPage={(value) => {
                update({ page: String(value), exception: null })
                action.reset()
              }}
              disabled={query.isFetching || action.isPending}
            />
          )}
          {query.isSuccess && page > Math.max(1, query.data.totalPages) && (
            <Button
              variant="outline"
              disabled={action.isPending || query.isFetching}
              onClick={() => update({ page: null, exception: null })}
            >
              Về trang đầu
            </Button>
          )}
          {selectedId && query.isSuccess && !selected && (
            <p role="status">
              Ngoại lệ không còn trong trang hiện tại.
              <Button variant="ghost" onClick={close}>
                Đóng chi tiết
              </Button>
            </p>
          )}
          {selected && (
            <Dialog open onClose={close} label="Chi tiết ngoại lệ">
              <div className="space-y-4 p-5">
                <h2 className="pr-8 text-lg font-semibold">Chi tiết ngoại lệ</h2>
                <p className="break-words">{itemTitle(selected)}</p>
                {selected.description && selected.description !== itemTitle(selected) && (
                  <pre className="whitespace-pre-wrap break-words border-l-2 border-border p-3 text-xs">
                    {selected.description}
                  </pre>
                )}
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 text-sm">
                  <dt>Mã phiếu</dt>
                  <dd className="break-all">{selected.id}</dd>
                  {selected.amount !== undefined && (
                    <>
                      <dt>Số tiền</dt>
                      <dd>{formatVnd(selected.amount)}</dd>
                    </>
                  )}
                  {selected.varianceAmount !== undefined && (
                    <>
                      <dt>Chênh lệch</dt>
                      <dd>{formatVnd(selected.varianceAmount)}</dd>
                    </>
                  )}
                  {selected.shiftId && (
                    <>
                      <dt>Ca</dt>
                      <dd className="break-all">{selected.shiftId}</dd>
                    </>
                  )}
                  {selected.paymentAttemptId && (
                    <>
                      <dt>Payment attempt</dt>
                      <dd className="break-all">{selected.paymentAttemptId}</dd>
                    </>
                  )}
                  {selected.invoiceId && (
                    <>
                      <dt>Hóa đơn</dt>
                      <dd className="break-all">{selected.invoiceId}</dd>
                    </>
                  )}
                  {selected.eventName && (
                    <>
                      <dt>Đối tượng</dt>
                      <dd className="break-all">
                        {selected.aggregateType} · {selected.aggregateId}
                      </dd>
                      <dt>Số lần lỗi</dt>
                      <dd>{selected.attempts}</dd>
                      <dt>Phát sinh</dt>
                      <dd>
                        {selected.occurredAt ? formatStoreDateTime(selected.occurredAt) : '—'}
                      </dd>
                    </>
                  )}
                </dl>
                {(action.isError || query.isError) && (
                  <div className="space-y-2">
                    <ApiErrorAlert error={action.error ?? query.error} />
                    <Button
                      variant="outline"
                      disabled={retryWait > 0 || query.isFetching || action.isPending}
                      onClick={async () => {
                        const result = await query.refetch()
                        if (result.isSuccess) action.reset()
                      }}
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      Kiểm tra lại ngoại lệ
                    </Button>
                  </div>
                )}
                {action.isSuccess && action.variables.command === 'RECONCILE' && (
                  <p role="status">Đã kiểm tra lại trạng thái thanh toán.</p>
                )}
                {kind === 'OUTBOX_DEAD_LETTER' &&
                  selected.availableAt &&
                  can('/outbox-events_retry') && (
                    <OutboxRetryForm
                      key={selected.id + selected.availableAt}
                      pending={action.isPending}
                      blocked={retryWait > 0 || query.isFetching || query.isError}
                      error={action.error}
                      onSubmit={(note) => {
                        if (retryWait || flight.current) return
                        flight.current = true
                        setQueuedMessage('')
                        action.mutate({
                          command: 'RETRY_EVENT',
                          note,
                          outbox: {
                            id: selected.id,
                            expectedAvailableAt: selected.availableAt!,
                          },
                        })
                      }}
                    />
                  )}
                {kind === 'PAYMENT' &&
                  selected.paymentAttemptId &&
                  can('/payment-reconciliation_manage') && (
                    <Button
                      variant="outline"
                      disabled={blocked}
                      onClick={() => action.mutate({ command: 'RECONCILE' })}
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      Đối soát lại payment
                    </Button>
                  )}
                {((kind === 'PAYMENT' && can('/payment-reconciliation_manage')) ||
                  (kind === 'FEEDBACK' && can('/feedback_resolve'))) && (
                  <ResolutionForm
                    key={kind + selected.id}
                    allowIgnore={kind === 'PAYMENT'}
                    isFeedback={kind === 'FEEDBACK'}
                    blocked={blocked}
                    pending={action.isPending}
                    onSubmit={(command, note, customerReply) =>
                      action.mutate({ command, note, customerReply })
                    }
                  />
                )}
                {((kind === 'CASH_EXPENSE' && can('/cashier-shifts_expenses-review')) ||
                  (kind === 'CASH_HANDOVER' && can('/cash-handovers_read'))) && (
                  <Link
                    className="inline-flex items-center gap-2 underline"
                    to={'/staff/shifts?tab=' + (kind === 'CASH_EXPENSE' ? 'expenses' : 'handovers')}
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    Mở nghiệp vụ ca và quỹ
                  </Link>
                )}
                {kind === 'PAYMENT' && can('/payment-reconciliation_read') && (
                  <Link className="block underline" to="/staff/reconciliation?tab=payments">
                    Mở danh sách đối soát
                  </Link>
                )}
                {kind === 'FEEDBACK' && can('/reports_read') && (
                  <Link className="block underline" to="/staff/reconciliation?tab=feedback">
                    Mở phản hồi khách
                  </Link>
                )}
                {kind === 'KITCHEN_OVERDUE' && can('/kitchen-tickets_read') && (
                  <Link
                    className="block underline"
                    to={'/staff/kitchen?stationId=' + selected.stationId}
                  >
                    Mở trạm bếp
                  </Link>
                )}
                {kind === 'ONLINE_PICKUP_LATE' && can('/online-orders_read') && (
                  <Link
                    className="block underline"
                    to="/staff/online-orders?tab=fulfillment&overdueOnly=true"
                  >
                    Mở đơn quá giờ hẹn
                  </Link>
                )}
                {selected.orderSessionId && can('/orders_sessions_read') && (
                  <Link
                    className="block underline"
                    to={'/staff/pos/sessions/' + selected.orderSessionId}
                  >
                    Mở đơn hàng
                  </Link>
                )}
              </div>
            </Dialog>
          )}
        </TabsContent>
      </Tabs>
    </section>
  )
}

function ResolutionForm({
  allowIgnore,
  isFeedback,
  blocked,
  pending,
  onSubmit,
}: {
  allowIgnore: boolean
  isFeedback: boolean
  blocked: boolean
  pending: boolean
  onSubmit: (command: 'RESOLVE' | 'IGNORE', note: string, customerReply?: string) => void
}) {
  const { t } = useTranslation()
  const [note, setNote] = useState('')
  const [customerReply, setCustomerReply] = useState('')
  const [confirm, setConfirm] = useState<'RESOLVE' | 'IGNORE' | null>(null)
  return (
    <div className="space-y-3">
      <label className="block text-sm">
        Ghi chú xử lý
        <Input
          value={note}
          maxLength={500}
          disabled={pending}
          onChange={(event) => {
            setNote(event.target.value)
            setConfirm(null)
          }}
        />
      </label>
      {isFeedback && (
        <label className="block text-sm">
          {t('feedback.customerReply')}
          <Input
            value={customerReply}
            maxLength={500}
            disabled={pending}
            onChange={(event) => {
              setCustomerReply(event.target.value)
              setConfirm(null)
            }}
          />
        </label>
      )}
      {confirm ? (
        <div className="space-y-2 border-t pt-3">
          <p>Xác nhận {confirm === 'IGNORE' ? 'bỏ qua' : 'đóng'} ngoại lệ này?</p>
          <Button
            disabled={blocked || note.trim().length < 3}
            onClick={() => onSubmit(confirm, note, customerReply)}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Xác nhận
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => setConfirm(null)}>
            Quay lại
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={note.trim().length < 3 || blocked}
            onClick={() => setConfirm('RESOLVE')}
          >
            Đánh dấu đã xử lý
          </Button>
          {allowIgnore && (
            <Button
              variant="outline"
              disabled={note.trim().length < 3 || blocked}
              onClick={() => setConfirm('IGNORE')}
            >
              Bỏ qua có lý do
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function OutboxRetryForm({
  pending,
  blocked,
  error,
  onSubmit,
}: {
  pending: boolean
  blocked: boolean
  error: Error | null
  onSubmit: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const rejected =
    error instanceof ApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 408 &&
    error.status !== 429
  const uncertain = error !== null && !rejected
  return (
    <form
      className="space-y-3 border-t pt-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (pending || blocked || rejected || reason.trim().length < 3) return
        if (!confirmed) {
          setConfirmed(true)
          return
        }
        onSubmit(reason.trim())
      }}
    >
      <label className="block space-y-1 text-sm">
        <span>Lý do phục hồi</span>
        <Input
          required
          minLength={3}
          maxLength={500}
          value={reason}
          disabled={pending || uncertain}
          onChange={(event) => {
            setReason(event.target.value)
            setConfirmed(false)
          }}
        />
      </label>
      {confirmed && (
        <p className="text-sm">Xác nhận đã xử lý nguyên nhân lỗi và đưa event lại vào hàng đợi?</p>
      )}
      {uncertain && (
        <p role="status" className="text-sm">
          Chưa xác nhận được kết quả. Gửi lại cùng lệnh hoặc kiểm tra lại ngoại lệ.
        </p>
      )}
      <Button type="submit" disabled={pending || blocked || rejected || reason.trim().length < 3}>
        <RefreshCw className={pending ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden="true" />
        {pending
          ? 'Đang gửi…'
          : uncertain
            ? 'Gửi lại lệnh chưa xác nhận'
            : confirmed
              ? 'Xác nhận phục hồi'
              : 'Đưa lại vào hàng đợi'}
      </Button>
    </form>
  )
}
