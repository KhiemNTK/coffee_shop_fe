import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, RefreshCw, Sparkles } from 'lucide-react'
import { ApiError, sessionEvents } from '../../../shared/api/client'
import { pendingIntentKey, readPendingIntent, writePendingIntent } from '../../../shared/api/pending-intent'
import { formatVnd } from '../../../shared/lib/format'
import { Badge, Button, Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle, TabsContent } from '../../../shared/ui'
import {
  businessInsightRecoverySchema, generateBusinessInsight, getBusinessInsight, getBusinessInsightsConfig, insightRangeError,
  type BusinessInsight, type BusinessInsightRequest,
} from '../business-insights.api'

const labels: Record<string, string> = {
  paidInvoiceCount: 'Hóa đơn đã thanh toán', grossSales: 'Doanh số trước giảm giá',
  discountAmount: 'Tiền giảm giá', refundCount: 'Giao dịch hoàn tiền thành công', refundAmount: 'Tiền đã hoàn',
  netReceipts: 'Thực thu sau hoàn tiền', estimatedNetSalesExTax: 'Doanh thu thuần ước tính chưa VAT',
  ingredientCost: 'Chi phí nguyên liệu đã chế biến', wasteCost: 'Chi phí hao hụt',
  estimatedGrossProfit: 'Lợi nhuận gộp ước tính', soldItemCount: 'Số dòng món đã bán',
  itemsWithCostSnapshot: 'Dòng món có snapshot chi phí', zeroCostSnapshotCount: 'Snapshot chi phí bằng 0',
}
const dateFormat = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'medium',
})
const time = (iso: string) => dateFormat.format(new Date(iso))
const busy = (job?: BusinessInsight) => job?.status === 'QUEUED' || job?.status === 'PROCESSING'
const metricLabel = (metric: { key: string; label: string }) => Object.hasOwn(labels, metric.key) ? labels[metric.key] : metric.label
const countFormat = new Intl.NumberFormat('vi-VN')
const metricValue = (value: string, unit: 'VND' | 'COUNT') => unit === 'VND' ? formatVnd(value) : countFormat.format(BigInt(value))

function insightError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'CLIENT_RESPONSE_INVALID') return 'Phản hồi phân tích không hợp lệ. Chưa thể xác nhận kết quả.'
    if (error.status === 403) return 'Không có quyền thực hiện yêu cầu phân tích này.'
    if (error.status === 429) return 'Đã vượt giới hạn yêu cầu. Vui lòng thử lại sau.'
    if (error.status === 503) return 'Dịch vụ phân tích hiện không khả dụng. Vui lòng thử lại sau.'
    if (error.status === 401) return 'Phiên đăng nhập đã hết hạn.'
    if (error.status === 404) return 'Không tìm thấy phân tích hoặc kết quả đã hết hạn lưu trữ.'
  }
  return 'Không thể xác nhận yêu cầu phân tích. Vui lòng thử lại sau.'
}

export function BusinessInsightsTab({ employeeId, from, to, active, canRead, canGenerate }: {
  employeeId: string; from: string; to: string; active: boolean; canRead: boolean; canGenerate: boolean
}) {
  const client = useQueryClient()
  const storageKey = pendingIntentKey(employeeId, 'business-insight')
  // shortcut: recover only the latest request in this tab; add server history for cross-device recovery.
  const [recovery] = useState(() => {
    try {
      const intent = readPendingIntent(storageKey, businessInsightRecoverySchema)
      if (intent && (intent.createdAt > Date.now() || Date.now() - intent.createdAt >= 7 * 86_400_000 ||
          intent.idempotencyKey !== intent.payload.request.clientRequestId))
        throw new Error('Invalid or expired insight reference')
      return { intent, error: null }
    } catch {
      return { intent: null, error: 'Tham chiếu phân tích không đọc được hoặc đã hết hạn. Chưa gửi yêu cầu mới.' }
    }
  })
  const [visible, setVisible] = useState(() => !document.hidden)
  const [request, setRequest] = useState<BusinessInsightRequest | null>(recovery.intent?.payload.request ?? null)
  const [jobId, setJobId] = useState<string | null>(recovery.intent?.payload.jobId ?? null)
  const [storageError, setStorageError] = useState<string | null>(recovery.error)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const requestedAt = useRef(recovery.intent?.createdAt ?? null)
  const controller = useRef<AbortController | null>(null)
  const submitting = useRef(false)
  const tracking = active && visible && canRead
  const rangeError = insightRangeError(!jobId && request ? request.from : from, !jobId && request ? request.to : to)

  useEffect(() => {
    const abort = new AbortController()
    controller.current = abort
    const visibility = () => setVisible(!document.hidden)
    const expire = () => abort.abort()
    document.addEventListener('visibilitychange', visibility)
    sessionEvents.addEventListener('expired', expire)
    return () => {
      abort.abort()
      document.removeEventListener('visibilitychange', visibility)
      sessionEvents.removeEventListener('expired', expire)
    }
  }, [])

  const config = useQuery({
    queryKey: ['private', employeeId, 'business-insights-config'],
    queryFn: ({ signal }) => getBusinessInsightsConfig(signal),
    enabled: tracking, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
  })
  const jobQuery = useQuery({
    queryKey: ['private', employeeId, 'business-insight-job', jobId],
    queryFn: ({ signal }) => getBusinessInsight(jobId!, request!, signal),
    enabled: tracking && !!jobId,
    retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
    staleTime: query => busy(query.state.data) ? 0 : Infinity,
    refetchInterval: query => !query.state.error && busy(query.state.data) ? 2_000 : false,
    refetchIntervalInBackground: false,
  })
  useEffect(() => {
    if (!tracking) {
      void client.cancelQueries({ queryKey: ['private', employeeId, 'business-insights-config'], exact: true })
      void client.cancelQueries({ queryKey: ['private', employeeId, 'business-insight-job', jobId], exact: true })
    }
  }, [client, employeeId, jobId, tracking])

  const mutation = useMutation({
    mutationKey: ['private', employeeId, 'business-insight-generate', from, to],
    mutationFn: (body: BusinessInsightRequest) => generateBusinessInsight(body, controller.current!.signal),
    retry: false,
    networkMode: 'always',
    onSuccess: (job, body) => {
      if (controller.current?.signal.aborted) return
      try {
        writePendingIntent(storageKey, { payload: { request: body, jobId: job.id }, createdAt: requestedAt.current!, idempotencyKey: body.clientRequestId })
      } catch { setStorageError('Không lưu được tham chiếu phân tích. Không tạo thêm yêu cầu trước khi kiểm tra trạng thái.') }
      client.setQueryData(['private', employeeId, 'business-insight-job', job.id], job)
      setJobId(job.id)
    },
    onSettled: () => { submitting.current = false },
  })
  const job = jobQuery.data
  const recovering = !!jobId && jobQuery.isPending
  const blocked = !tracking || !canGenerate || config.data?.enabled !== true || config.isError ||
    config.isFetching || !!rangeError || mutation.isPending || busy(job) || jobQuery.isError || recovering || !!storageError

  function generate() {
    if (blocked || submitting.current || !controller.current || controller.current.signal.aborted) return
    const body = !jobId && request ? request : {
      clientRequestId: crypto.randomUUID(), from, to, timeZone: 'Asia/Ho_Chi_Minh' as const,
    }
    const started = body.clientRequestId === request?.clientRequestId ? requestedAt.current! : Date.now()
    if (started > Date.now() || Date.now() - started >= 7 * 86_400_000) {
      setStorageError('Tham chiếu phân tích đã hết hạn. Chưa gửi yêu cầu mới.')
      return
    }
    // Persist only identifiers and period before POST; an unknown outcome keeps the same UUID.
    try { writePendingIntent(storageKey, { payload: { request: body, jobId: null }, createdAt: started, idempotencyKey: body.clientRequestId }) }
    catch { setStorageError('Không lưu được tham chiếu phân tích. Chưa gửi yêu cầu mới.'); return }
    requestedAt.current = started
    submitting.current = true
    setRequest(body)
    setJobId(null)
    mutation.mutate(body)
  }

  function forgetReference() {
    try { sessionStorage.removeItem(storageKey) }
    catch { setStorageError('Không xóa được tham chiếu phân tích.'); return }
    setConfirmDiscard(false)
    setRequest(null)
    setJobId(null)
    requestedAt.current = null
    setStorageError(null)
    mutation.reset()
  }

  const snapshot = job?.snapshot
  const analysis = job?.status === 'COMPLETED' ? job.analysis : null
  const metrics = new Map(snapshot?.metrics.map(metric => [metric.key, metric]))
  const zeroCost = metrics.get('zeroCostSnapshotCount')
  const sold = metrics.get('soldItemCount')
  const costed = metrics.get('itemsWithCostSnapshot')
  const missingCosts = sold?.unit === 'COUNT' && costed?.unit === 'COUNT' && (
    BigInt(costed.value) < BigInt(sold.value) || BigInt(costed.previousValue) < BigInt(sold.previousValue)
  )

  // Keep the hooks mounted when TabsContent hides its children, without polling the hidden tab.
  return <TabsContent value="insights">
    <section className="min-w-0 space-y-5 text-foreground" aria-label="Phân tích kinh doanh">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Phân tích kinh doanh</h2>
        <Button onClick={generate} disabled={blocked} className="gap-2" aria-describedby="insights-notice">
          {mutation.isPending || busy(job) || recovering
            ? <RefreshCw size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            : <Sparkles size={16} aria-hidden="true" />}
          {mutation.isPending ? 'Đang gửi yêu cầu...' : recovering ? 'Kiểm tra yêu cầu...' : busy(job) ? 'Đang phân tích...' : !jobId && request ? 'Gửi lại yêu cầu' : 'Tạo phân tích'}
        </Button>
      </div>
      <p id="insights-notice" className="text-sm text-muted-foreground">
        Nhận định AI chỉ mang tính tham khảo, không phải kết luận nhân quả. Số liệu do hệ thống báo cáo cung cấp.
      </p>
      <p className="break-words text-sm">Kỳ báo cáo (giờ Việt Nam): {rangeError ? from + ' - ' + to : time(from) + ' - ' + time(to)}</p>
      {request && <p className="break-words text-sm">Kỳ của yêu cầu: {time(request.from)} - {time(request.to)} (giờ Việt Nam)</p>}
      {rangeError && <p role="alert" className="text-sm text-destructive">{rangeError}</p>}
      {!canGenerate && <p role="status" className="text-sm text-muted-foreground">Bạn có quyền xem báo cáo nhưng không có quyền tạo phân tích.</p>}
      {config.isPending && <p role="status">Đang tải cấu hình phân tích...</p>}
      {config.data?.enabled === false && <p role="status" className="text-sm">Phân tích kinh doanh chưa được bật.</p>}
      {config.data && <p className="text-xs text-muted-foreground">Kết quả được lưu {config.data.retentionDays} ngày. Khoảng phân tích tối đa {config.data.maxRangeDays} ngày.</p>}
      {config.isError && <div className="flex flex-wrap items-center gap-3">
        <p role="alert" className="text-sm text-destructive">{insightError(config.error)}</p>
        <Button variant="outline" disabled={config.isFetching} onClick={() => void config.refetch()} className="gap-2">
          <RefreshCw size={16} aria-hidden="true" />Tải lại cấu hình
        </Button>
      </div>}
      {mutation.isError && <p role="alert" className="text-sm text-destructive">{insightError(mutation.error)} Yêu cầu gửi lại giữ nguyên mã và kỳ báo cáo.</p>}
      {!jobId && request && !mutation.isPending && !mutation.isError && <p role="status" className="text-sm">Có yêu cầu chưa xác nhận. Gửi lại giữ nguyên mã và kỳ của yêu cầu.</p>}
      {storageError && <p role="alert" className="text-sm text-destructive">{storageError}</p>}
      {!mutation.isPending && !busy(job) && (storageError || jobQuery.error instanceof ApiError && jobQuery.error.status === 404) &&
        <Button variant="outline" onClick={() => setConfirmDiscard(true)}>Bỏ tham chiếu cũ</Button>}
      {busy(job) && <p role="status">{job?.status === 'QUEUED' ? 'Yêu cầu đang chờ xử lý.' : 'Đang xử lý phân tích.'}</p>}
      {jobQuery.isError && <div className="flex flex-wrap items-center gap-3">
        <p role="alert" className="text-sm text-destructive">{insightError(jobQuery.error)} Trạng thái hiển thị là lần xác nhận gần nhất.</p>
        <Button variant="outline" disabled={jobQuery.isFetching} onClick={() => void jobQuery.refetch()} className="gap-2">
          <RefreshCw size={16} aria-hidden="true" />Kiểm tra trạng thái
        </Button>
      </div>}
      {job?.status === 'FAILED' && <p role="alert" className="text-sm text-destructive">Không thể hoàn tất phân tích. Số liệu snapshot nếu có vẫn là dữ liệu hệ thống; chưa có kết luận AI.</p>}
      {job && <dl className="grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
        <div className="min-w-0"><dt className="text-muted-foreground">Yêu cầu lúc</dt><dd>{time(job.requestedAt)}</dd></div>
        <div className="min-w-0"><dt className="text-muted-foreground">Mô hình / phiên bản prompt</dt><dd className="break-words [overflow-wrap:anywhere]">{job.model} / {job.promptVersion}</dd></div>
      </dl>}
      {job && !snapshot && <p className="text-sm text-muted-foreground">Chưa có snapshot số liệu.</p>}
      {snapshot && <section className="space-y-3 border-t border-border pt-4" aria-label="Số liệu hệ thống">
        <h3 className="text-base font-semibold">Số liệu hệ thống</h3>
        <p className="text-sm">Snapshot lúc: {time(snapshot.asOf)} (giờ Việt Nam)</p>
        <p className="text-sm">Kỳ so sánh: {time(snapshot.comparisonPeriod.from)} - {time(snapshot.comparisonPeriod.to)} (giờ Việt Nam)</p>
        <p className="text-sm">{snapshot.comparisonBasis === 'PREVIOUS_DAY_SAME_WINDOW' ? 'Cùng khung giờ ngày trước.' : 'Kỳ liền trước có cùng thời lượng.'}</p>
        <p className="text-sm text-muted-foreground">Doanh số theo ngày tạo hóa đơn. Hoàn tiền của nhóm hóa đơn được tính đến lúc snapshot, không phải dòng tiền trong kỳ. Hao hụt theo ngày ghi nhận.</p>
        {!snapshot.metrics.length && <p role="status">Snapshot chưa có số liệu. Dữ liệu phân tích chưa đầy đủ.</p>}
        {zeroCost && (!/^0(?:\.0+)?$/.test(zeroCost.value) || !/^0(?:\.0+)?$/.test(zeroCost.previousValue)) && <p role="status" className="flex items-start gap-2 text-sm">
          <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />Có snapshot chi phí bằng 0 trong kỳ báo cáo hoặc kỳ so sánh; chi phí và lợi nhuận ước tính có thể chưa đầy đủ.
        </p>}
        {missingCosts && <p role="status" className="text-sm">Một số dòng món chưa có snapshot chi phí trong kỳ báo cáo hoặc kỳ so sánh. Dữ liệu chi phí chưa đầy đủ.</p>}
        {!!snapshot.metrics.length && <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <caption className="sr-only">Số liệu hiện tại và kỳ so sánh từ snapshot hệ thống</caption>
            <thead><tr className="border-b border-border"><th scope="col" className="p-2">Chỉ số</th><th scope="col" className="p-2 text-right">Hiện tại</th><th scope="col" className="p-2 text-right">Kỳ trước</th></tr></thead>
            <tbody>{snapshot.metrics.map(metric => <tr key={metric.key} className="border-b border-border">
              <th scope="row" className="max-w-64 break-words p-2 font-medium [overflow-wrap:anywhere]">{metricLabel(metric)}</th>
              <td className="whitespace-nowrap p-2 text-right tabular-nums">{metricValue(metric.value, metric.unit)}</td>
              <td className="whitespace-nowrap p-2 text-right tabular-nums">{metricValue(metric.previousValue, metric.unit)}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </section>}
      {analysis && <section className="space-y-4 border-t border-border pt-4" aria-label="Quan sát và giả thuyết">
        <h3 className="text-base font-semibold">Quan sát và giả thuyết</h3>
        <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{analysis.summary}</p>
        <ol className="divide-y divide-border">{analysis.findings.map((finding, index) => <li key={index} className="space-y-3 py-4 first:pt-0">
          <div className="flex flex-wrap items-start gap-2">
            <h4 className="min-w-0 whitespace-pre-wrap break-words text-sm font-semibold [overflow-wrap:anywhere]">{finding.title}</h4>
            <Badge variant={finding.kind === 'HYPOTHESIS' ? 'warning' : 'outline'} className="whitespace-normal">
              {finding.kind === 'HYPOTHESIS' ? 'Giả thuyết (chưa kiểm chứng)' : 'Quan sát hệ thống'}
            </Badge>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{finding.detail}</p>
          <div className="space-y-1 text-sm">
            <p className="font-medium">Số liệu dẫn chứng</p>
            <ul className="space-y-1">{finding.metricKeys.map((key, evidenceIndex) => {
              const metric = metrics.get(key)!
              return <li key={evidenceIndex} className="break-words [overflow-wrap:anywhere]">
                {metricLabel(metric)}: {metricValue(metric.value, metric.unit)}; kỳ trước: {metricValue(metric.previousValue, metric.unit)}
              </li>
            })}</ul>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]"><span className="font-medium">Hành động đề xuất: </span>{finding.action}</p>
        </li>)}</ol>
        {!!analysis.limitations.length && <div className="space-y-2 border-t border-border pt-4">
          <h4 className="text-sm font-semibold">Giới hạn dữ liệu và phân tích</h4>
          <ul className="list-inside list-disc space-y-1 text-sm">{analysis.limitations.map((limit, index) =>
            <li key={index} className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{limit}</li>)}</ul>
        </div>}
      </section>}
    </section>
    <Dialog open={confirmDiscard} onClose={() => setConfirmDiscard(false)} maxWidth="sm">
      <DialogHeader>
        <DialogTitle>Bỏ tham chiếu phân tích?</DialogTitle>
        <DialogDescription>Bỏ tham chiếu không hủy job trên máy chủ. Yêu cầu mới có thể dùng thêm hạn mức.</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={() => setConfirmDiscard(false)}>Giữ tham chiếu</Button>
        <Button onClick={forgetReference}>Bỏ tham chiếu</Button>
      </DialogFooter>
    </Dialog>
  </TabsContent>
}
