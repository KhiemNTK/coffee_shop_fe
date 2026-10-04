import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChefHat,
  Clock,
  Eye,
  Receipt,
  RefreshCw,
  RotateCcw,
} from 'lucide-react'
import { errorMessage } from '@/shared/api/client'
import {
  printingApi,
  type PrintDevice,
  type PrintJob,
  type PrintJobStatus,
  type PrintJobType,
} from '../printing.api'
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui'

const EMPTY_JOBS: PrintJob[] = []

function formatDateTime(isoString?: string | null) {
  if (!isoString) return '—'
  try {
    const d = new Date(isoString)
    const hours = String(d.getHours()).padStart(2, '0')
    const mins = String(d.getMinutes()).padStart(2, '0')
    const secs = String(d.getSeconds()).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${hours}:${mins}:${secs} ${day}/${month}/${year}`
  } catch {
    return isoString
  }
}

interface PrintJobsTabProps {
  canManageJobs: boolean
  devices: PrintDevice[]
}

export function PrintJobsTab({ canManageJobs, devices }: PrintJobsTabProps) {
  const queryClient = useQueryClient()

  const [jobStatusFilter, setJobStatusFilter] = useState<'ALL' | PrintJobStatus>('ALL')
  const [jobTypeFilter, setJobTypeFilter] = useState<'ALL' | PrintJobType>('ALL')
  const [jobPage, setJobPage] = useState(1)

  const [retryingJob, setRetryingJob] = useState<PrintJob | null>(null)
  const [selectedJob, setSelectedJob] = useState<PrintJob | null>(null)
  const [retryTargetDeviceId, setRetryTargetDeviceId] = useState<string>('')

  const {
    data: jobsData,
    isLoading: isLoadingJobs,
    isFetching: isFetchingJobs,
  } = useQuery({
    queryKey: ['print-jobs', jobStatusFilter, jobTypeFilter, jobPage],
    queryFn: ({ signal }) =>
      printingApi.getJobs(
        {
          type: jobTypeFilter === 'ALL' ? undefined : jobTypeFilter,
          status: jobStatusFilter === 'ALL' ? undefined : jobStatusFilter,
          page: jobPage,
          itemPerPage: 20,
        },
        signal,
      ),
  })

  const jobs = jobsData?.list ?? EMPTY_JOBS
  const totalJobs = jobsData?.totalItems ?? 0
  const totalJobPages = jobsData?.totalPages ?? 1

  const retryJobMutation = useMutation({
    mutationFn: ({ id, deviceId }: { id: string; deviceId?: string }) =>
      printingApi.retryJob(id, { deviceId: deviceId || undefined }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['print-jobs'] })
      setRetryingJob(null)
      setRetryTargetDeviceId('')
    },
  })

  const handleOpenRetry = (job: PrintJob) => {
    setRetryingJob(job)
    setRetryTargetDeviceId(job.deviceId || '')
  }

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <Card className="border border-border/70 shadow-xs">
        <CardContent className="p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Lọc trạng thái lệnh in"
                value={jobStatusFilter}
                onChange={(e) => {
                  setJobStatusFilter(e.target.value as 'ALL' | PrintJobStatus)
                  setJobPage(1)
                }}
                className="h-9 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                <option value="ALL">Tất cả trạng thái lệnh</option>
                <option value="PENDING">Chờ xử lý (PENDING)</option>
                <option value="PROCESSING">Đang in (PROCESSING)</option>
                <option value="PRINTED">Đã in thành công (PRINTED)</option>
                <option value="FAILED">Thất bại (FAILED)</option>
                <option value="CANCELLED">Đã hủy (CANCELLED)</option>
              </select>

              <select
                aria-label="Lọc loại lệnh in"
                value={jobTypeFilter}
                onChange={(e) => {
                  setJobTypeFilter(e.target.value as 'ALL' | PrintJobType)
                  setJobPage(1)
                }}
                className="h-9 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                <option value="ALL">Tất cả loại lệnh</option>
                <option value="RECEIPT">Hóa đơn thanh toán</option>
                <option value="KITCHEN_TICKET">Phiếu chế biến bếp</option>
              </select>
            </div>

            <div className="text-xs text-muted-foreground">
              Tổng cộng: <span className="font-semibold text-foreground">{totalJobs}</span> lệnh in
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jobs Table */}
      {isLoadingJobs ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Đang tải danh sách lệnh in...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Clock className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-3 text-base font-bold text-foreground">Không tìm thấy lệnh in nào</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Chưa có lệnh in nào khớp với bộ lọc trạng thái hiện tại.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="w-full max-w-full overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3">Loại lệnh</th>
                  <th scope="col" className="px-4 py-3">Máy in đích</th>
                  <th scope="col" className="px-4 py-3">Người yêu cầu</th>
                  <th scope="col" className="px-4 py-3">Lần thử</th>
                  <th scope="col" className="px-4 py-3">Thời gian tạo</th>
                  <th scope="col" className="px-4 py-3">Trạng thái</th>
                  <th scope="col" className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {jobs.map((job) => {
                  const isFailed = job.status === 'FAILED'
                  const isPending = job.status === 'PENDING'
                  const canRetry = canManageJobs && (isFailed || isPending)

                  return (
                    <tr key={job.id} className="transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {job.type === 'RECEIPT' ? (
                            <Receipt className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          ) : (
                            <ChefHat className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-xs text-foreground">
                                {job.type === 'RECEIPT' ? 'Hóa đơn' : 'Phiếu bếp'}
                              </span>
                              {job.reprintOfId && (
                                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                                  In lại
                                </Badge>
                              )}
                            </div>
                            <span className="block text-[10px] font-mono text-muted-foreground">
                              {job.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-foreground">
                          {job.device?.name || 'Mặc định (Chưa gán)'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {job.requestedBy?.fullName || 'Hệ thống'}
                      </td>

                      <td className="px-4 py-3">
                        <span className="text-xs font-mono">
                          {job.attempts} / {job.maxAttempts}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                        {formatDateTime(job.createdAt)}
                      </td>

                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            job.status === 'PRINTED'
                              ? 'default'
                              : job.status === 'FAILED'
                                ? 'destructive'
                                : job.status === 'PROCESSING'
                                  ? 'secondary'
                                  : 'outline'
                          }
                          className={`text-[11px] ${
                            job.status === 'PRINTED'
                              ? 'bg-emerald-600 text-white'
                              : job.status === 'PROCESSING'
                                ? 'bg-blue-600 text-white'
                                : job.status === 'PENDING'
                                  ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                                  : ''
                          }`}
                        >
                          {job.status === 'PRINTED'
                            ? 'Đã in'
                            : job.status === 'FAILED'
                              ? 'Thất bại'
                              : job.status === 'PROCESSING'
                                ? 'Đang in'
                                : job.status === 'PENDING'
                                  ? 'Chờ in'
                                  : 'Đã hủy'}
                        </Badge>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canRetry && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenRetry(job)}
                              className="h-7 px-2 text-xs gap-1 text-primary hover:bg-primary/10"
                              title="Thử lại lệnh in"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>Thử lại</span>
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedJob(job)}
                            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                            title="Xem chi tiết lệnh in"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Chi tiết</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalJobPages > 1 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-1">
              <p className="text-xs text-muted-foreground">
                Trang <span className="font-bold text-foreground">{jobPage}</span> / {totalJobPages} (Tổng cộng {totalJobs} lệnh in)
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setJobPage((p) => Math.max(1, p - 1))}
                  disabled={jobPage <= 1 || isFetchingJobs}
                  className="h-8 px-3 text-xs"
                >
                  Trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setJobPage((p) => Math.min(totalJobPages, p + 1))}
                  disabled={jobPage >= totalJobPages || isFetchingJobs}
                  className="h-8 px-3 text-xs"
                >
                  Tiếp
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RETRY JOB MODAL */}
      <Dialog open={!!retryingJob} onClose={() => setRetryingJob(null)}>
        {retryingJob && (
          <>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-foreground">
                Thử lại Lệnh in
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Mã lệnh: {retryingJob.id}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label htmlFor="retry-dev-select" className="block font-medium text-foreground pb-1">
                  Chọn máy in thực hiện lại:
                </label>
                <select
                  id="retry-dev-select"
                  value={retryTargetDeviceId}
                  onChange={(e) => setRetryTargetDeviceId(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
                >
                  <option value="">Máy in mặc định theo cấu hình lệnh</option>
                  {devices
                    .filter((d) => d.type === retryingJob.type && d.isActive)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.paperSize}) {d.isDefault ? '- Mặc định' : ''}
                      </option>
                    ))}
                </select>
              </div>

              {retryJobMutation.isError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400">
                  {errorMessage(retryJobMutation.error)}
                </div>
              )}
            </div>

            <DialogFooter className="mt-5">
              <Button variant="outline" onClick={() => setRetryingJob(null)} className="h-9">
                Hủy
              </Button>
              <Button
                disabled={retryJobMutation.isPending}
                onClick={() => {
                  retryJobMutation.mutate({
                    id: retryingJob.id,
                    deviceId: retryTargetDeviceId || undefined,
                  })
                }}
                className="h-9 bg-primary text-primary-foreground"
              >
                {retryJobMutation.isPending && (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Thực hiện lại
              </Button>
            </DialogFooter>
          </>
        )}
      </Dialog>

      {/* JOB DETAIL MODAL */}
      <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        {selectedJob && (
          <div className="max-w-lg">
            <DialogHeader>
              <div className="flex items-center justify-between pr-4">
                <DialogTitle className="text-base font-bold text-foreground">
                  Chi tiết Lệnh in
                </DialogTitle>
                <Badge
                  variant={selectedJob.status === 'PRINTED' ? 'default' : 'outline'}
                  className="text-xs font-mono"
                >
                  {selectedJob.status}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Mã lệnh: {selectedJob.id}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-border bg-muted/30 p-3">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Loại lệnh</span>
                  <span className="font-semibold text-foreground">
                    {selectedJob.type === 'RECEIPT' ? 'Hóa đơn thanh toán' : 'Phiếu chế biến bếp'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Thiết bị</span>
                  <span className="font-semibold text-foreground">
                    {selectedJob.device?.name || 'Mặc định'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Số bản in / Lần thử</span>
                  <span className="font-semibold text-foreground">
                    {selectedJob.copies} bản / ({selectedJob.attempts}/{selectedJob.maxAttempts})
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Thời gian tạo</span>
                  <span className="font-semibold text-foreground">
                    {formatDateTime(selectedJob.createdAt)}
                  </span>
                </div>
                {selectedJob.invoiceId && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground block text-[11px]">Mã Hóa đơn</span>
                    <span className="font-mono text-foreground">{selectedJob.invoiceId}</span>
                  </div>
                )}
                {selectedJob.kitchenTicketId && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground block text-[11px]">Mã Phiếu Bếp</span>
                    <span className="font-mono text-foreground">{selectedJob.kitchenTicketId}</span>
                  </div>
                )}
              </div>

              {selectedJob.lastError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/30 p-3 text-rose-700 dark:text-rose-400">
                  <span className="font-semibold block text-[11px]">Thông báo lỗi gần nhất:</span>
                  <span className="font-mono mt-0.5 block">{selectedJob.lastError}</span>
                </div>
              )}
            </div>

            <DialogFooter className="mt-5">
              <Button variant="outline" onClick={() => setSelectedJob(null)} className="h-9">
                Đóng
              </Button>
            </DialogFooter>
          </div>
        )}
      </Dialog>
    </div>
  )
}
