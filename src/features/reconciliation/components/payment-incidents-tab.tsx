import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Filter,
  Layers,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import type { Session } from '../../auth/session'
import { errorMessage } from '@/shared/api/client'
import { Badge, Button, Card, CardContent, Dialog, Input } from '@/shared/ui'
import { Pagination } from '@/shared/ui/pagination'
import { formatDate, formatVnd } from '@/shared/lib/format'
import { reconcilePaymentAttempt } from '../../invoices/invoices.api'
import {
  closeIncident,
  getIncidents,
  type Incident,
} from '../reconciliation.api'

const EMPTY_INCIDENTS: Incident[] = []

export function PaymentIncidentsTab() {
  const { employee, access } = useOutletContext<Session>()
  const canManage = access.has('/payment-reconciliation_manage')
  const client = useQueryClient()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('OPEN')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Incident | null>(null)
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState<'RESOLVE' | 'IGNORE' | null>(null)

  const query = useQuery({
    queryKey: ['private', employee.id, 'reconciliation', status, page],
    queryFn: ({ signal }) => getIncidents(page, status, signal),
  })

  const action = useMutation({
    mutationFn: async (command: 'RESOLVE' | 'IGNORE' | 'RECONCILE') => {
      if (!selected) throw new Error('Chưa chọn sự cố.')
      return command === 'RECONCILE'
        ? reconcilePaymentAttempt(selected.paymentAttemptId)
        : closeIncident(selected.id, command, note.trim())
    },
    onSuccess: (_data, command) => {
      setConfirm(null)
      if (command !== 'RECONCILE') setSelected(null)
      void query.refetch()
      void client.invalidateQueries({ queryKey: ['management-exceptions-list'] })
      void client.invalidateQueries({ queryKey: ['management-exceptions-summary'] })
    },
  })

  // Calculate real metrics from active list and metadata
  const list = query.data?.list ?? EMPTY_INCIDENTS
  const kpiData = useMemo(() => {
    const totalCount = query.data?.totalItems ?? list.length
    const openCount = list.filter(item => item.status === 'OPEN').length
    const resolvedCount = list.filter(item => item.status === 'RESOLVED').length
    const pendingReview = list.filter(item => item.paymentAttempt.status === 'PENDING').length
    const closedCount = list.filter(item => item.status === 'RESOLVED' || item.status === 'IGNORED').length
    return {
      total: totalCount,
      open: status === 'OPEN' ? totalCount : openCount,
      inProgress: pendingReview,
      needsReconciliation: openCount,
      closed: status === 'RESOLVED' ? resolvedCount : closedCount,
    }
  }, [query.data, list, status])

  // Filter items client-side by search keyword
  const filteredList = useMemo(() => {
    if (!search.trim()) return list
    const kw = search.trim().toLowerCase()
    return list.filter(
      item =>
        item.title.toLowerCase().includes(kw) ||
        item.paymentAttempt.merchantReference.toLowerCase().includes(kw) ||
        item.paymentAttempt.invoiceId.toLowerCase().includes(kw) ||
        item.type.toLowerCase().includes(kw)
    )
  }, [list, search])

  return (
    <div className="space-y-5">
      {/* 5 Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* KPI 1: Tổng sự cố */}
        <Card className="border border-border/80 bg-card shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Tổng sự cố</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {query.isPending ? '—' : kpiData.total}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Tất cả giao dịch ghi nhận</p>
          </CardContent>
        </Card>

        {/* KPI 2: Chưa xử lý */}
        <Card className="border border-border/80 bg-card shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Chưa xử lý</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                {query.isPending ? '—' : kpiData.open}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Cần ưu tiên xử lý ngay</p>
          </CardContent>
        </Card>

        {/* KPI 3: Đang chờ kết quả */}
        <Card className="border border-border/80 bg-card shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Đang chờ kết quả</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {query.isPending ? '—' : kpiData.inProgress}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Chờ phản hồi cổng thanh toán</p>
          </CardContent>
        </Card>

        {/* KPI 4: Cần đối soát */}
        <Card className="border border-border/80 bg-card shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Cần đối soát</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <ShieldAlert className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {query.isPending ? '—' : kpiData.needsReconciliation}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Chênh lệch tiền / trạng thái</p>
          </CardContent>
        </Card>

        {/* KPI 5: Đã xử lý */}
        <Card className="border border-border/80 bg-card shadow-xs col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Đã xử lý</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {query.isPending ? '—' : kpiData.closed}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Đã xác minh hoặc đóng</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card p-3 rounded-xl border border-border/70 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter buttons matching mockup tabs */}
          <div className="inline-flex rounded-lg bg-muted/70 p-1 border border-border/60">
            <button
              type="button"
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
              Chưa xử lý ({kpiData.open})
            </button>
            <button
              type="button"
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
              placeholder="Tìm mã GD, hóa đơn, loại sự cố..."
              className="pl-8 text-xs h-9 bg-background/80"
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
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
            onClick={() => void query.refetch()}
            className="mt-4 text-xs"
          >
            Thử lại
          </Button>
        </Card>
      ) : query.isPending ? (
        <Card className="p-12 text-center border border-border/80">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p role="status" className="mt-3 text-xs text-muted-foreground font-medium">
            Đang tải dữ liệu sự cố đối soát...
          </p>
        </Card>
      ) : filteredList.length === 0 ? (
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
                {filteredList.map(item => {
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
                          onClick={() => {
                            setSelected(item)
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
      {query.data && query.data.totalPages > 1 && (
        <div className="flex justify-end pt-2">
          <Pagination page={page} totalPages={query.data.totalPages} onPage={setPage} />
        </div>
      )}

      {/* Incident Detail Dialog */}
      {selected && (
        <Dialog
          open
          maxWidth="md"
          onClose={() => {
            if (!action.isPending) setSelected(null)
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

            <div className="space-y-3 rounded-xl bg-muted/40 p-4 border border-border/60 text-xs">
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

            {action.isError && (
              <p role="alert" className="text-xs font-semibold text-destructive">
                {errorMessage(action.error)}
              </p>
            )}
            {action.isSuccess && (
              <p role="status" className="text-xs font-semibold text-emerald-600">
                Đã kiểm tra lại payment. Làm mới danh sách để xem kết quả.
              </p>
            )}

            {canManage && selected.status === 'OPEN' && (
              <div className="space-y-4 pt-2 border-t border-border/70">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Hành động khắc phục</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={action.isPending}
                    onClick={() => action.mutate('RECONCILE')}
                    className="gap-1.5 text-xs"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${action.isPending ? 'animate-spin' : ''}`} />
                    Đối soát lại
                  </Button>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-foreground">Lý do xử lý</span>
                  <Input
                    value={note}
                    maxLength={500}
                    disabled={action.isPending}
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
                        disabled={action.isPending}
                        onClick={() => action.mutate(confirm)}
                        className="gap-1.5 bg-[#08634e] hover:bg-[#074b3d] text-white text-xs"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Xác nhận
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={action.isPending}
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
                      disabled={note.trim().length < 3}
                      onClick={() => setConfirm('RESOLVE')}
                      className="bg-[#08634e] hover:bg-[#074b3d] text-white text-xs font-semibold"
                    >
                      Đã xử lý
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={note.trim().length < 3}
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
