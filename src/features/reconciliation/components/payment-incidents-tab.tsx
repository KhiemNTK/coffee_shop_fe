import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Filter,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react'
import type { Session } from '../../auth/session'
import { errorMessage } from '@/shared/api/client'
import { ApiErrorAlert, Badge, Button, Card, Dialog, Input } from '@/shared/ui'
import { Pagination } from '@/shared/ui/pagination'
import { formatDate, formatVnd } from '@/shared/lib/format'
import { useDebouncedSearch } from '@/shared/lib/use-debounced-search'
import { reconcilePaymentAttempt } from '../../invoices/invoices.api'
import {
  closeIncident,
  getIncidents,
  type Incident,
} from '../reconciliation.api'

const EMPTY_INCIDENTS: Incident[] = []

export function PaymentIncidentsTab() {
  const { t } = useTranslation()
  const { employee, access } = useOutletContext<Session>()
  const canManage = access.has('/payment-reconciliation_manage')
  const client = useQueryClient()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('OPEN')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const submitting = useRef(false)
  const keyword = useDebouncedSearch(search)
  const searchPending = keyword !== search.trim()
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState<'RESOLVE' | 'IGNORE' | null>(null)
  const [requiresRefresh, setRequiresRefresh] = useState(false)

  const query = useQuery({
    queryKey: ['private', employee.id, 'reconciliation', status, page, keyword],
    queryFn: ({ signal }) => getIncidents(page, status, signal, keyword),
    enabled: !searchPending,
  })

  const list = query.data?.list ?? EMPTY_INCIDENTS
  const selected = list.find(item => item.id === selectedId)

  const action = useMutation({
    retry: false,
    mutationFn: async (command: 'RESOLVE' | 'IGNORE' | 'RECONCILE') => {
      if (!canManage || !selected || selected.status !== 'OPEN') throw new Error('Sự cố không còn khả dụng để xử lý.')
      if (command === 'RECONCILE' && selected.paymentRefundId)
        throw new Error(t('operations.refundManualHint'))
      return command === 'RECONCILE'
        ? reconcilePaymentAttempt(selected.paymentAttemptId)
        : closeIncident(selected.id, command, note.trim())
    },
    onSuccess: async (_data, command) => {
      setConfirm(null)
      await query.refetch()
      if (command !== 'RECONCILE') setSelectedId(null)
    },
    onError: () => setRequiresRefresh(true),
    onSettled: () => {
      submitting.current = false
      void client.invalidateQueries({ queryKey: ['management-exceptions-list'] })
      void client.invalidateQueries({ queryKey: ['management-exceptions-summary'] })
    },
  })

  const writeBlocked = action.isPending || requiresRefresh || query.isFetching || !query.isSuccess || searchPending
  async function refresh() {
    const result = await query.refetch()
    if (result.isSuccess) {
      action.reset()
      setRequiresRefresh(false)
      setConfirm(null)
    }
  }
  function submit(command: 'RESOLVE' | 'IGNORE' | 'RECONCILE') {
    if (submitting.current || writeBlocked || !selected || !canManage) return
    if (command !== 'RECONCILE' && note.trim().length < 3) return
    submitting.current = true
    action.mutate(command)
  }

  return (
    <div className="space-y-5">
      <dl aria-label="Tổng hợp sự cố" className="flex items-baseline gap-3 border-y border-border py-3">
        <dt className="text-sm text-muted-foreground">Sự cố theo bộ lọc</dt>
        <dd className="text-xl font-bold tabular-nums">
          {query.isSuccess && !searchPending ? query.data.totalItems : '—'}
        </dd>
      </dl>

      {/* Search and Filters Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card p-3 rounded-xl border border-border/70 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter buttons matching mockup tabs */}
          <div className="inline-flex rounded-lg bg-muted/70 p-1 border border-border/60">
            <button
              type="button"
              disabled={action.isPending}
              aria-pressed={status === 'OPEN'}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                status === 'OPEN'
                  ? 'bg-background text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => {
                setStatus('OPEN')
                setPage(1)
              }}
            >
              Chưa xử lý
            </button>
            <button
              type="button"
              disabled={action.isPending}
              aria-pressed={status === 'RESOLVED'}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                status === 'RESOLVED'
                  ? 'bg-background text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => {
                setStatus('RESOLVED')
                setPage(1)
              }}
            >
              Đã xử lý
            </button>
            <button
              type="button"
              disabled={action.isPending}
              aria-pressed={status === 'IGNORED'}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                status === 'IGNORED'
                  ? 'bg-background text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => {
                setStatus('IGNORED')
                setPage(1)
              }}
            >
              Đã bỏ qua
            </button>
          </div>
        </div>

        {/* Search input & Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative min-w-[220px] flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              maxLength={120}
              aria-label="Tìm sự cố thanh toán"
              disabled={action.isPending}
              placeholder="Tìm mã GD, hóa đơn, loại sự cố..."
              className="pl-8 text-xs h-9 bg-background/80"
              onChange={e => { setSearch(e.target.value); setPage(1); setSelectedId(null) }}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            className="gap-1.5 text-xs h-9"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Làm mới</span>
          </Button>
        </div>
      </div>

      {/* Main Table / List */}
      {query.isError ? (
        <Card className="p-8 text-center border-dashed">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-3">
            <XCircle className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Không thể tải dữ liệu sự cố</h3>
          <p role="alert" className="text-xs text-destructive mt-1 max-w-md mx-auto">
            {errorMessage(query.error)}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            className="mt-4 text-xs"
          >
            Thử lại
          </Button>
        </Card>
      ) : query.isPending || searchPending ? (
        <Card className="p-12 text-center border border-border/80">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p role="status" className="mt-3 text-xs text-muted-foreground font-medium">
            Đang tải dữ liệu sự cố đối soát...
          </p>
        </Card>
      ) : list.length === 0 ? (
        <Card className="p-12 text-center border border-dashed border-border/80">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-3">
            <Filter className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Không có sự cố nào</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {search ? 'Không tìm thấy sự cố phù hợp với từ khóa.' : 'Hiện không có sự cố nào ở trạng thái này.'}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden border border-border/80 bg-card shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-muted/50 border-b border-border/70 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Giao dịch &amp; Hóa đơn</th>
                  <th className="py-3 px-4">Loại sự cố</th>
                  <th className="py-3 px-4 text-right">Số tiền</th>
                  <th className="py-3 px-4">Thời gian</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {list.map(item => {
                  const isPending = item.paymentAttempt.status === 'PENDING'
                  const isFailed = item.paymentAttempt.status === 'FAILED'
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/40 transition-colors group"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                              item.status === 'OPEN'
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {item.status === 'OPEN' ? (
                              <AlertTriangle className="h-4 w-4" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <span className="font-semibold text-foreground block">
                              {item.title}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5 text-muted-foreground font-mono text-[11px]">
                              <span>Ref: {item.paymentAttempt.merchantReference || '—'}</span>
                              <span>·</span>
                              <span>Invoice: {item.paymentAttempt.invoiceId.slice(-8)}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className="font-normal text-[11px] bg-muted/40"
                        >
                          {item.type}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-foreground font-mono">
                        {formatVnd(item.paymentAttempt.amount)}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {formatDate(item.detectedAt)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={
                            item.status === 'OPEN'
                              ? isPending
                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                                : 'border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300'
                              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                          }
                        >
                          {item.status === 'OPEN'
                            ? isPending
                              ? 'Chờ đối soát'
                              : isFailed
                                ? 'Thất bại'
                                : 'Chưa xử lý'
                            : item.status === 'RESOLVED'
                              ? 'Đã xử lý'
                              : 'Đã bỏ qua'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={action.isPending || query.isFetching}
                          onClick={() => {
                            setSelectedId(item.id)
                            setNote(item.resolutionNote || '')
                            setConfirm(null)
                            action.reset()
                          }}
                          className="gap-1.5 text-xs h-8 hover:bg-primary/5 hover:text-primary hover:border-primary/30"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Chi tiết
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {query.isSuccess && !searchPending && query.data.totalPages > 1 && (
        <div className="flex justify-end pt-2">
          <Pagination page={page} totalPages={query.data.totalPages} onPage={value => { if (!action.isPending) { setPage(value); setSelectedId(null) } }} />
        </div>
      )}

      {selectedId && !selected && (
        <Dialog open onClose={() => { if (!action.isPending) setSelectedId(null) }}>
          <div className="space-y-3 p-6">
            <h2 className="text-base font-semibold">Chi tiết sự cố</h2>
            <p role="status">Sự cố không còn trong kết quả hiện tại. Đóng cửa sổ và đọc lại danh sách.</p>
          </div>
        </Dialog>
      )}

      {/* Incident Detail Dialog */}
      {selected && (
        <Dialog
          open
          maxWidth="md"
          onClose={() => {
            if (!action.isPending) setSelectedId(null)
          }}
        >
          <div className="space-y-5 p-6">
            <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Chi tiết sự cố thanh toán
                </span>
                <h2 className="text-lg font-bold text-foreground mt-0.5">{selected.title}</h2>
              </div>
              <Badge
                variant="outline"
                className={
                  selected.status === 'OPEN'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                }
              >
                {selected.status}
              </Badge>
            </div>

            <div className="space-y-3 rounded-xl bg-muted/40 p-4 border border-border/60 text-xs [&>div]:gap-3 [&>div>span:last-child]:min-w-0 [&>div>span:last-child]:break-all [&>div>span:last-child]:text-right">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mã sự cố:</span>
                <span className="font-mono font-medium text-foreground">{selected.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Loại sự cố:</span>
                <span className="font-medium text-foreground">{selected.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mã giao dịch (Merchant Ref):</span>
                <span className="font-mono font-semibold text-foreground">
                  {selected.paymentAttempt.merchantReference || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hóa đơn:</span>
                <span className="font-mono font-medium text-foreground break-all">
                  {selected.paymentAttempt.invoiceId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Số tiền:</span>
                <span className="font-bold text-foreground">
                  {formatVnd(selected.paymentAttempt.amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trạng thái gần nhất:</span>
                <span className="font-semibold text-foreground">
                  {selected.paymentAttempt.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Thời gian phát hiện:</span>
                <span className="text-foreground">{formatDate(selected.detectedAt)}</span>
              </div>
              {selected.resolutionNote && (
                <div className="pt-2 border-t border-border/60">
                  <span className="block text-muted-foreground mb-1">Ghi chú giải quyết:</span>
                  <p className="rounded-lg bg-background p-2.5 font-medium text-foreground">
                    {selected.resolutionNote}
                  </p>
                </div>
              )}
            </div>

            {selected.paymentRefundId && (
              <div className="space-y-2 border-l-2 border-warning p-3 text-sm">
                <p>{t('operations.refundId')}: <code className="select-all break-all">{selected.paymentRefundId}</code></p>
                <p role="status">{t('operations.refundManualHint')}</p>
              </div>
            )}
            {action.isError && (
              <div className="space-y-2">
                <ApiErrorAlert error={action.error} />
                <p className="text-xs">Kết quả có thể đã được ghi nhận. Đọc lại trước khi thao tác tiếp.</p>
              </div>
            )}
            {requiresRefresh && !action.isError && <p role="status" className="text-sm">Đọc lại trạng thái trước khi thao tác tiếp với giao dịch chưa rõ kết quả.</p>}
            {(query.isError || query.isFetching) && <p role="status">Chi tiết chưa được xác minh mới nhất.</p>}
            <Button variant="outline" size="sm" disabled={action.isPending || query.isFetching} onClick={() => void refresh()}>
              <RefreshCw className="size-4" /> Đọc lại trạng thái
            </Button>
            {action.isSuccess && (
              <p role="status" className="text-xs font-semibold text-emerald-600">
                Đã kiểm tra lại giao dịch.
              </p>
            )}

            {canManage && selected.status === 'OPEN' && (
              <div className="space-y-4 pt-2 border-t border-border/70">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Hành động khắc phục</span>
                  {!selected.paymentRefundId && <Button
                    variant="outline"
                    size="sm"
                    disabled={writeBlocked}
                    onClick={() => submit('RECONCILE')}
                    className="gap-1.5 text-xs"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${action.isPending ? 'animate-spin' : ''}`} />
                    Đối soát lại
                  </Button>}
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-foreground">Lý do xử lý</span>
                  <Input
                    value={note}
                    maxLength={500}
                    disabled={writeBlocked}
                    placeholder="Nhập lý do đóng hoặc xác minh sự cố..."
                    onChange={e => {
                      setNote(e.target.value)
                      setConfirm(null)
                    }}
                    className="text-xs"
                  />
                </label>

                {confirm ? (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                    <p className="text-xs font-medium text-foreground">
                      Xác nhận {confirm === 'IGNORE' ? 'bỏ qua' : 'đóng'} sự cố?
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        disabled={writeBlocked}
                        onClick={() => submit(confirm)}
                        className="gap-1.5 bg-[#08634e] hover:bg-[#074b3d] text-white text-xs"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Xác nhận
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={writeBlocked}
                        onClick={() => setConfirm(null)}
                        className="text-xs"
                      >
                        Quay lại
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      disabled={writeBlocked || note.trim().length < 3}
                      onClick={() => setConfirm('RESOLVE')}
                      className="bg-[#08634e] hover:bg-[#074b3d] text-white text-xs font-semibold"
                    >
                      Đã xử lý
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={writeBlocked || note.trim().length < 3}
                      onClick={() => setConfirm('IGNORE')}
                      className="text-xs"
                    >
                      Bỏ qua có lý do
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </Dialog>
      )}
    </div>
  )
}
