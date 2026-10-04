import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Check,
  CreditCard,
  Eye,
  RefreshCw,
} from 'lucide-react'
import { errorMessage } from '../../../shared/api/client'
import { formatPrice } from '../../menu/menu.api'
import {
  approveCashHandover,
  cancelCashHandover,
  createCashHandover,
  getAllCashHandovers,
  getFunds,
  getMyCashHandovers,
  getOverdueCashHandovers,
  registerBankDeposit,
  rejectCashHandover,
  settleCashHandover,
  type CashHandover,
  type CashHandoverStatus,
  type Fund,
} from '../cashier-shifts.api'
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
  cn,
} from '../../../shared/ui'

const EMPTY_HANDOVERS: CashHandover[] = []
const EMPTY_FUNDS: Fund[] = []

interface CashHandoversTabProps {
  employeeId: string
  canCreateHandover: boolean
  canReviewHandover: boolean
  canSettleHandover: boolean
  isCreateModalOpen: boolean
  setIsCreateModalOpen: (open: boolean) => void
  createHandoverShiftId: string
  setCreateHandoverShiftId: (id: string) => void
  onError: (msg: string) => void
  onSuccess: (msg: string) => void
  nowTimestamp: number
}

export function CashHandoversTab({
  employeeId,
  canCreateHandover,
  canReviewHandover,
  canSettleHandover,
  isCreateModalOpen,
  setIsCreateModalOpen,
  createHandoverShiftId,
  setCreateHandoverShiftId,
  onError,
  onSuccess,
  nowTimestamp,
}: CashHandoversTabProps) {
  const queryClient = useQueryClient()

  const [handoverViewMode, setHandoverViewMode] = useState<'ALL' | 'MINE' | 'OVERDUE'>('ALL')
  const [handoverStatusFilter, setHandoverStatusFilter] = useState<CashHandoverStatus | 'ALL'>('ALL')
  const [selectedHandover, setSelectedHandover] = useState<CashHandover | null>(null)

  // Local Modal States
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false)
  const [isRegisterDeposit, setIsRegisterDeposit] = useState(false)

  // Modal Form States
  const [approveNote, setApproveNote] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [settleBankRef, setSettleBankRef] = useState('')
  const [settleEvidenceRef, setSettleEvidenceRef] = useState('')

  // Create Handover Form States
  const [createHandoverDestFundId, setCreateHandoverDestFundId] = useState('')
  const [createHandoverRetained, setCreateHandoverRetained] = useState('0')
  const [createHandoverNote, setCreateHandoverNote] = useState('')

  // Queries
  const handoversQuery = useQuery({
    queryKey: ['private', 'cash-handovers', handoverViewMode, handoverStatusFilter],
    queryFn: ({ signal }) => {
      if (handoverViewMode === 'MINE') {
        return getMyCashHandovers({ page: 1, itemPerPage: 50 }, signal)
      }
      if (handoverViewMode === 'OVERDUE') {
        return getOverdueCashHandovers({ page: 1, itemPerPage: 50 }, signal)
      }
      return getAllCashHandovers(
        {
          page: 1,
          itemPerPage: 50,
          status: handoverStatusFilter === 'ALL' ? undefined : handoverStatusFilter,
        },
        signal,
      )
    },
  })

  const fundsQuery = useQuery({
    queryKey: ['private', 'funds', 'all-for-selection'],
    queryFn: ({ signal }) => getFunds({ page: 1, itemPerPage: 100 }, signal),
  })

  const handoversList = handoversQuery.data?.list ?? EMPTY_HANDOVERS
  const fundsList = fundsQuery.data?.list ?? EMPTY_FUNDS

  // KPI Metrics
  const handoverKpi = useMemo(() => {
    let pendingCount = 0
    let overdueCount = 0
    let needDepositCount = 0
    let settledCount = 0

    for (const h of handoversList) {
      if (h.status === 'PENDING') pendingCount++
      if (
        h.status === 'APPROVED' &&
        h.settlementStatus === 'PENDING' &&
        h.settlementDueAt &&
        new Date(h.settlementDueAt).getTime() < nowTimestamp
      ) {
        overdueCount++
      }
      if (h.status === 'APPROVED' && h.settlementStatus === 'PENDING') {
        needDepositCount++
      }
      if (h.settlementStatus === 'SETTLED') {
        settledCount++
      }
    }

    return { pendingCount, overdueCount, needDepositCount, settledCount }
  }, [handoversList, nowTimestamp])

  // Mutations
  const createHandoverMutation = useMutation({
    mutationFn: () =>
      createCashHandover({
        shiftId: createHandoverShiftId,
        destinationFundId: createHandoverDestFundId,
        retainedCash: createHandoverRetained,
        note: createHandoverNote,
      }),
    onSuccess: () => {
      onSuccess('Lập biên bản bàn giao két tiền mặt thành công!')
      setIsCreateModalOpen(false)
      setCreateHandoverShiftId('')
      setCreateHandoverDestFundId('')
      setCreateHandoverRetained('0')
      setCreateHandoverNote('')
      void queryClient.invalidateQueries({ queryKey: ['private', 'cash-handovers'] })
      void queryClient.invalidateQueries({ queryKey: ['private', 'funds'] })
    },
    onError: (err) => {
      onError(errorMessage(err))
    },
  })

  const approveHandoverMutation = useMutation({
    mutationFn: () => {
      if (!selectedHandover) throw new Error('Chưa chọn biên bản bàn giao')
      return approveCashHandover(selectedHandover.id, approveNote)
    },
    onSuccess: () => {
      onSuccess('Phê duyệt biên bản bàn giao thành công!')
      setIsApproveModalOpen(false)
      setSelectedHandover(null)
      setApproveNote('')
      void queryClient.invalidateQueries({ queryKey: ['private', 'cash-handovers'] })
      void queryClient.invalidateQueries({ queryKey: ['private', 'funds'] })
    },
    onError: (err) => {
      onError(errorMessage(err))
    },
  })

  const rejectHandoverMutation = useMutation({
    mutationFn: () => {
      if (!selectedHandover) throw new Error('Chưa chọn biên bản bàn giao')
      return rejectCashHandover(selectedHandover.id, rejectReason)
    },
    onSuccess: () => {
      onSuccess('Đã từ chối biên bản bàn giao két!')
      setIsRejectModalOpen(false)
      setSelectedHandover(null)
      setRejectReason('')
      void queryClient.invalidateQueries({ queryKey: ['private', 'cash-handovers'] })
    },
    onError: (err) => {
      onError(errorMessage(err))
    },
  })

  const settleHandoverMutation = useMutation({
    mutationFn: () => {
      if (!selectedHandover) throw new Error('Chưa chọn biên bản bàn giao')
      const payload = { bankReference: settleBankRef, evidenceReference: settleEvidenceRef }
      if (isRegisterDeposit) {
        return registerBankDeposit(selectedHandover.id, payload)
      }
      return settleCashHandover(selectedHandover.id, payload)
    },
    onSuccess: () => {
      onSuccess(
        isRegisterDeposit
          ? 'Đã ghi nhận nộp tiền vào ngân hàng thành công!'
          : 'Quyết toán biên bản nộp tiền thành công!',
      )
      setIsSettleModalOpen(false)
      setSelectedHandover(null)
      setSettleBankRef('')
      setSettleEvidenceRef('')
      void queryClient.invalidateQueries({ queryKey: ['private', 'cash-handovers'] })
      void queryClient.invalidateQueries({ queryKey: ['private', 'funds'] })
    },
    onError: (err) => {
      onError(errorMessage(err))
    },
  })

  const cancelHandoverMutation = useMutation({
    mutationFn: (id: string) => cancelCashHandover(id),
    onSuccess: () => {
      onSuccess('Đã hủy biên bản bàn giao thành công!')
      void queryClient.invalidateQueries({ queryKey: ['private', 'cash-handovers'] })
    },
    onError: (err) => {
      onError(errorMessage(err))
    },
  })

  return (
    <div className="flex flex-col gap-6">
      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-muted-foreground font-medium">Biên bản chờ duyệt</span>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {handoverKpi.pendingCount}
            </p>
            <span className="text-xs text-muted-foreground mt-1 block">Cần quản lý xác nhận</span>
          </CardContent>
        </Card>

        <Card className={handoverKpi.overdueCount > 0 ? 'border-rose-500/30 bg-rose-500/5' : ''}>
          <CardContent className="p-4">
            <span className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Nộp ngân hàng quá hạn
            </span>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
              {handoverKpi.overdueCount}
            </p>
            <span className="text-xs text-muted-foreground mt-1 block">Vượt SLA quy định</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-muted-foreground font-medium">Chờ nộp/quyết toán</span>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {handoverKpi.needDepositCount}
            </p>
            <span className="text-xs text-muted-foreground mt-1 block">Đang nộp vào tài khoản</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-muted-foreground font-medium">Đã hoàn tất quyết toán</span>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {handoverKpi.settledCount}
            </p>
            <span className="text-xs text-muted-foreground mt-1 block">Đối soát thành công</span>
          </CardContent>
        </Card>
      </div>

      {/* CONTROLS & SUB-TABS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-xl">
          <button
            onClick={() => setHandoverViewMode('ALL')}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors',
              handoverViewMode === 'ALL'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Tất cả biên bản
          </button>
          <button
            onClick={() => setHandoverViewMode('MINE')}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors',
              handoverViewMode === 'MINE'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Của tôi
          </button>
          <button
            onClick={() => setHandoverViewMode('OVERDUE')}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors',
              handoverViewMode === 'OVERDUE'
                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Quá hạn SLA
          </button>
        </div>

        {handoverViewMode === 'ALL' && (
          <select
            value={handoverStatusFilter}
            onChange={(e) => setHandoverStatusFilter(e.target.value as CashHandoverStatus | 'ALL')}
            className="px-3 py-1.5 text-xs rounded-lg border border-input bg-background"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PENDING">Chờ duyệt (PENDING)</option>
            <option value="APPROVED">Đã duyệt (APPROVED)</option>
            <option value="REJECTED">Đã từ chối (REJECTED)</option>
            <option value="CANCELLED">Đã hủy (CANCELLED)</option>
          </select>
        )}
      </div>

      {/* TABLE OF CASH HANDOVERS */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3 font-semibold">Mã biên bản</th>
                <th className="px-4 py-3 font-semibold">Thu ngân</th>
                <th className="px-4 py-3 font-semibold">Quỹ nguồn → Quỹ đích</th>
                <th className="px-4 py-3 font-semibold text-right">Tiền nộp chuyển</th>
                <th className="px-4 py-3 font-semibold text-right">Tiền giữ lại</th>
                <th className="px-4 py-3 font-semibold text-right">Lệch két</th>
                <th className="px-4 py-3 font-semibold text-center">Trạng thái</th>
                <th className="px-4 py-3 font-semibold text-center">Quyết toán</th>
                <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {handoversQuery.isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    Đang tải danh sách biên bản bàn giao...
                  </td>
                </tr>
              ) : handoversList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    Không có biên bản bàn giao nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                handoversList.map((h) => {
                  const isPending = h.status === 'PENDING'
                  const isApproved = h.status === 'APPROVED'
                  const isRequester = h.requestedById === employeeId
                  const isOverdue =
                    isApproved &&
                    h.settlementStatus === 'PENDING' &&
                    h.settlementDueAt &&
                    new Date(h.settlementDueAt).getTime() < nowTimestamp

                  return (
                    <tr key={h.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-foreground">
                        {h.id.slice(0, 8)}...
                        <span className="text-[10px] text-muted-foreground block font-sans">
                          {new Date(h.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {h.requestedBy?.fullName || 'Thu ngân'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="font-medium text-foreground">{h.sourceFund?.name}</span>
                        <ArrowRight className="w-3 h-3 inline mx-1 text-muted-foreground" />
                        <span className="font-medium text-foreground">{h.destinationFund?.name}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatPrice(h.transferAmount)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {formatPrice(h.retainedCash)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {Number(h.varianceAmount) === 0 ? (
                          <span className="text-muted-foreground">0 đ</span>
                        ) : Number(h.varianceAmount) < 0 ? (
                          <span className="text-rose-600 font-semibold">{formatPrice(h.varianceAmount)}</span>
                        ) : (
                          <span className="text-emerald-600 font-semibold">+{formatPrice(h.varianceAmount)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={
                            isPending
                              ? 'warning'
                              : isApproved
                                ? 'success'
                                : h.status === 'REJECTED'
                                  ? 'destructive'
                                  : 'outline'
                          }
                        >
                          {isPending
                            ? 'Chờ duyệt'
                            : isApproved
                              ? 'Đã duyệt'
                              : h.status === 'REJECTED'
                                ? 'Từ chối'
                                : 'Đã hủy'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {h.destinationFund?.type === 'BANK' ? (
                          <Badge
                            variant={
                              h.settlementStatus === 'SETTLED'
                                ? 'success'
                                : isOverdue
                                  ? 'destructive'
                                  : 'warning'
                            }
                          >
                            {h.settlementStatus === 'SETTLED'
                              ? 'Đã khớp sao kê'
                              : isOverdue
                                ? 'Quá hạn nộp'
                                : 'Chờ nộp NH'}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedHandover(h)
                              setIsDetailModalOpen(true)
                            }}
                            className="h-7 px-2"
                            title="Xem chi tiết"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>

                          {/* Quản lý duyệt/từ chối */}
                          {canReviewHandover && isPending && !isRequester && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedHandover(h)
                                  setIsApproveModalOpen(true)
                                }}
                                className="h-7 px-2 text-emerald-600 hover:text-emerald-700"
                                title="Duyệt bàn giao"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedHandover(h)
                                  setIsRejectModalOpen(true)
                                }}
                                className="h-7 px-2 text-rose-600 hover:text-rose-700"
                                title="Từ chối"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}

                          {/* Thu ngân hoặc Quản lý nộp ngân hàng */}
                          {isApproved &&
                            h.settlementStatus === 'PENDING' &&
                            h.destinationFund?.type === 'BANK' &&
                            (canSettleHandover || canCreateHandover) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedHandover(h)
                                  setIsRegisterDeposit(canCreateHandover && !canSettleHandover)
                                  setIsSettleModalOpen(true)
                                }}
                                className="h-7 px-2 text-blue-600 dark:text-blue-400 gap-1 text-[11px]"
                              >
                                <CreditCard className="w-3 h-3" />
                                Nộp tiền
                              </Button>
                            )}

                          {/* Hủy nếu là người tạo và còn pending */}
                          {isPending && isRequester && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => cancelHandoverMutation.mutate(h.id)}
                              className="h-7 px-2 text-rose-500 hover:text-rose-600 text-[11px]"
                            >
                              Hủy
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ========================================================================= */}
      {/* HANDOVER MODALS */}
      {/* ========================================================================= */}

      {/* 1. CREATE HANDOVER MODAL */}
      <Dialog
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      >
        <DialogHeader>
          <DialogTitle>Lập biên bản Bàn giao Két tiền mặt</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!createHandoverShiftId || !createHandoverDestFundId) {
              onError('Vui lòng chọn ca làm việc và quỹ tiếp nhận')
              return
            }
            createHandoverMutation.mutate()
          }}
          className="flex flex-col gap-4 mt-2"
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Mã ca thu ngân cần bàn giao *</label>
            <Input
              value={createHandoverShiftId}
              onChange={(e) => setCreateHandoverShiftId(e.target.value)}
              placeholder="UUID ca làm việc..."
              required
            />
            <span className="text-xs text-muted-foreground">
              Mẹo: Ca phải ở trạng thái ĐÃ ĐÓNG (CLOSED) và khớp sổ.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Quỹ tiếp nhận bàn giao *</label>
            <select
              value={createHandoverDestFundId}
              onChange={(e) => setCreateHandoverDestFundId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background"
              required
            >
              <option value="">-- Chọn quỹ đích (Két an toàn / Ngân hàng) --</option>
              {fundsList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.type === 'CASH' ? 'Két an toàn/Quầy' : 'Tài khoản Ngân hàng'})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Số tiền giữ lại trong ngăn kéo (VND) *</label>
            <Input
              type="number"
              min="0"
              step="1000"
              value={createHandoverRetained}
              onChange={(e) => setCreateHandoverRetained(e.target.value)}
              placeholder="Ví dụ: 500000"
              required
            />
            <span className="text-xs text-muted-foreground">
              Tiền nộp chuyển = Tiền kiểm đếm - Tiền giữ lại
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Ghi chú bàn giao</label>
            <Textarea
              value={createHandoverNote}
              onChange={(e) => setCreateHandoverNote(e.target.value)}
              placeholder="Ghi chú người nhận, niêm phong túi tiền..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={createHandoverMutation.isPending}
            >
              {createHandoverMutation.isPending ? 'Đang tạo...' : 'Xác nhận gửi biên bản'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* 2. APPROVE HANDOVER MODAL */}
      <Dialog
        open={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
      >
        <DialogHeader>
          <DialogTitle>Xác nhận Phê duyệt Biên bản Bàn giao</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <p className="text-sm text-muted-foreground">
            Bạn đang phê duyệt biên bản bàn giao két{' '}
            <strong className="text-foreground">#{selectedHandover?.id.slice(0, 8)}</strong> với số tiền nộp chuyển{' '}
            <strong className="text-emerald-600">
              {formatPrice(selectedHandover?.transferAmount || '0')}
            </strong>
            .
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Ghi chú phê duyệt (tùy chọn)</label>
            <Textarea
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              placeholder="Đã nhận đủ túi tiền niêm phong..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsApproveModalOpen(false)}>
              Hủy
            </Button>
            <Button
              variant="default"
              onClick={() => approveHandoverMutation.mutate()}
              disabled={approveHandoverMutation.isPending}
            >
              {approveHandoverMutation.isPending ? 'Đang duyệt...' : 'Phê duyệt bàn giao'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* 3. REJECT HANDOVER MODAL */}
      <Dialog
        open={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
      >
        <DialogHeader>
          <DialogTitle>Từ chối Biên bản Bàn giao Két</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <p className="text-sm text-muted-foreground">
            Vui lòng nhập lý do từ chối để thu ngân kiểm đếm lại hoặc điều chỉnh số tiền:
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Lý do từ chối *</label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Tiền thực tế thiếu 50,000 đ so với phiếu bàn giao..."
              rows={3}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsRejectModalOpen(false)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!rejectReason.trim()) {
                  onError('Vui lòng nhập lý do từ chối')
                  return
                }
                rejectHandoverMutation.mutate()
              }}
              disabled={rejectHandoverMutation.isPending}
            >
              {rejectHandoverMutation.isPending ? 'Đang từ chối...' : 'Xác nhận từ chối'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* 4. SETTLE / REGISTER DEPOSIT MODAL */}
      <Dialog
        open={isSettleModalOpen}
        onClose={() => setIsSettleModalOpen(false)}
      >
        <DialogHeader>
          <DialogTitle>
            {isRegisterDeposit ? 'Ghi nhận Nộp tiền vào Ngân hàng' : 'Quyết toán Biên bản Nộp tiền'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <p className="text-sm text-muted-foreground">
            Số tiền nộp chuyển:{' '}
            <strong className="text-emerald-600">
              {formatPrice(selectedHandover?.transferAmount || '0')}
            </strong>{' '}
            vào quỹ <strong className="text-foreground">{selectedHandover?.destinationFund?.name}</strong>.
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Mã giao dịch / Mã tham chiếu Ngân hàng *</label>
            <Input
              value={settleBankRef}
              onChange={(e) => setSettleBankRef(e.target.value)}
              placeholder="Ví dụ: VCB-20261002-889922"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Chứng từ / Giấy nộp tiền tham chiếu *</label>
            <Input
              value={settleEvidenceRef}
              onChange={(e) => setSettleEvidenceRef(e.target.value)}
              placeholder="Ví dụ: Biên lai nộp tiền quầy giao dịch số 0928..."
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsSettleModalOpen(false)}>
              Hủy
            </Button>
            <Button
              variant="default"
              onClick={() => {
                if (!settleBankRef.trim() || !settleEvidenceRef.trim()) {
                  onError('Vui lòng nhập đầy đủ mã ngân hàng và chứng từ nộp tiền')
                  return
                }
                settleHandoverMutation.mutate()
              }}
              disabled={settleHandoverMutation.isPending}
            >
              {settleHandoverMutation.isPending ? 'Đang lưu...' : 'Xác nhận nộp tiền'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* 5. HANDOVER DETAILS MODAL */}
      <Dialog
        open={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
      >
        <DialogHeader>
          <DialogTitle>Chi tiết Biên bản #{selectedHandover?.id.slice(0, 8)}</DialogTitle>
        </DialogHeader>
        {selectedHandover && (
          <div className="flex flex-col gap-4 text-xs mt-2">
            <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-xl">
              <div>
                <span className="text-muted-foreground block">Thu ngân lập phiếu:</span>
                <span className="font-semibold text-foreground">{selectedHandover.requestedBy?.fullName}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Thời gian tạo:</span>
                <span className="font-medium text-foreground">
                  {new Date(selectedHandover.createdAt).toLocaleString('vi-VN')}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Quỹ nguồn:</span>
                <span className="font-medium text-foreground">{selectedHandover.sourceFund?.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Quỹ đích:</span>
                <span className="font-medium text-foreground">{selectedHandover.destinationFund?.name}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-y border-border py-3">
              <div>
                <span className="text-muted-foreground block">Tiền thực kiểm:</span>
                <span className="font-bold text-foreground">{formatPrice(selectedHandover.countedCash)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Tiền bàn giao nộp:</span>
                <span className="font-bold text-emerald-600">{formatPrice(selectedHandover.transferAmount)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Tiền giữ lại két:</span>
                <span className="font-medium text-foreground">{formatPrice(selectedHandover.retainedCash)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Chênh lệch két:</span>
                <span className="font-medium">{formatPrice(selectedHandover.varianceAmount)}</span>
              </div>
            </div>

            {selectedHandover.note && (
              <div>
                <span className="text-muted-foreground block">Ghi chú của thu ngân:</span>
                <p className="mt-0.5 text-foreground italic">{selectedHandover.note}</p>
              </div>
            )}

            {selectedHandover.resolvedBy && (
              <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                <span className="text-muted-foreground block">Phê duyệt bởi:</span>
                <p className="font-semibold text-foreground">
                  {selectedHandover.resolvedBy.fullName}
                  {selectedHandover.resolvedAt && (
                    <span className="font-normal text-muted-foreground ml-2">
                      ({new Date(selectedHandover.resolvedAt).toLocaleString('vi-VN')})
                    </span>
                  )}
                </p>
                {selectedHandover.resolutionNote && (
                  <p className="text-muted-foreground mt-1">Ghi chú: {selectedHandover.resolutionNote}</p>
                )}
              </div>
            )}

            {selectedHandover.bankReference && (
              <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10">
                <span className="text-muted-foreground block">Giao dịch nộp ngân hàng:</span>
                <p className="font-mono text-foreground font-medium mt-0.5">
                  Ref: {selectedHandover.bankReference}
                </p>
                <p className="text-muted-foreground mt-0.5">
                  Chứng từ: {selectedHandover.evidenceReference}
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
