import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Coins, Lock, RefreshCw, Send, Unlock, Wallet } from 'lucide-react'
import { errorMessage } from '../../../shared/api/client'
import { formatPrice } from '../../menu/menu.api'
import {
  addCashMovement,
  cancelCurrentExpenseRequest,
  closeCashierShift,
  getCashFunds,
  getCurrentShift,
  getCurrentShiftExpenseRequests,
  openCashierShift,
  type CashierShift,
} from '../cashier-shifts.api'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
  cn,
} from '../../../shared/ui'

interface CurrentShiftTabProps {
  employeeId: string
  canOpen: boolean
  canClose: boolean
  canTransact: boolean
  canCreateHandover: boolean
  onOpenCreateHandover: (shiftId?: string) => void
  onError: (msg: string) => void
  onSuccess: (msg: string) => void
  onShiftLoaded?: (shift: CashierShift | null) => void
}

export function CurrentShiftTab({
  employeeId,
  canOpen,
  canClose,
  canTransact,
  canCreateHandover,
  onOpenCreateHandover,
  onError,
  onSuccess,
}: CurrentShiftTabProps) {
  const queryClient = useQueryClient()

  // Opening shift state
  const [openingFundId, setOpeningFundId] = useState('')
  const [openingCash, setOpeningCash] = useState('0')

  // Closing shift state
  const [reportedEndingCash, setReportedEndingCash] = useState('')
  const [closingNote, setClosingNote] = useState('')

  // Cash movement state
  const [movementType, setMovementType] = useState<'INCOME' | 'EXPENSE'>(
    'INCOME',
  )
  const [movementAmount, setMovementAmount] = useState('')
  const [movementDesc, setMovementDesc] = useState('')
  const [showMovementForm, setShowMovementForm] = useState(false)

  // Queries
  const currentShiftQuery = useQuery({
    queryKey: ['private', employeeId, 'cashier-shift', 'current'],
    queryFn: ({ signal }) => getCurrentShift(signal),
  })

  const cashFundsQuery = useQuery({
    queryKey: ['private', 'funds', 'cash'],
    queryFn: ({ signal }) => getCashFunds(signal),
    enabled:
      canOpen &&
      currentShiftQuery.isSuccess &&
      (!currentShiftQuery.data || currentShiftQuery.data.status === 'CLOSED'),
  })

  const currentExpensesQuery = useQuery({
    queryKey: ['private', 'cashier-shift', 'current', 'expenses'],
    queryFn: ({ signal }) =>
      getCurrentShiftExpenseRequests({ page: 1, itemPerPage: 20 }, signal),
    enabled: currentShiftQuery.data?.status === 'OPEN',
  })

  // Mutations
  const openShiftMutation = useMutation({
    mutationFn: () => openCashierShift(openingFundId, openingCash),
    onSuccess: () => {
      onSuccess('Mở ca thu ngân thành công!')
      void queryClient.invalidateQueries({
        queryKey: ['private', employeeId, 'cashier-shift'],
      })
      void queryClient.invalidateQueries({ queryKey: ['private', 'funds'] })
    },
    onError: (err) => {
      onError(errorMessage(err))
    },
  })

  const closeShiftMutation = useMutation({
    mutationFn: () => closeCashierShift(reportedEndingCash, closingNote),
    onSuccess: () => {
      onSuccess('Đã đóng ca và chốt sổ tiền mặt an toàn!')
      setReportedEndingCash('')
      setClosingNote('')
      void queryClient.invalidateQueries({
        queryKey: ['private', employeeId, 'cashier-shift'],
      })
      void queryClient.invalidateQueries({ queryKey: ['private', 'funds'] })
      void queryClient.invalidateQueries({
        queryKey: ['private', 'cash-handovers'],
      })
    },
    onError: (err) => {
      onError(errorMessage(err))
    },
  })

  const movementMutation = useMutation({
    mutationFn: () =>
      addCashMovement(movementType, movementAmount, movementDesc),
    onSuccess: () => {
      onSuccess('Đã ghi nhận giao dịch tiền mặt vào ca!')
      setMovementAmount('')
      setMovementDesc('')
      setShowMovementForm(false)
      void queryClient.invalidateQueries({
        queryKey: ['private', employeeId, 'cashier-shift'],
      })
      void queryClient.invalidateQueries({
        queryKey: ['private', 'cashier-shift', 'current', 'expenses'],
      })
      void queryClient.invalidateQueries({ queryKey: ['private', 'funds'] })
    },
    onError: (err) => {
      onError(errorMessage(err))
    },
  })

  const cancelMyExpenseMutation = useMutation({
    mutationFn: (id: string) => cancelCurrentExpenseRequest(id),
    onSuccess: () => {
      onSuccess('Đã hủy phiếu yêu cầu chi tiền!')
      void queryClient.invalidateQueries({
        queryKey: ['private', 'cashier-shift', 'current', 'expenses'],
      })
    },
    onError: (err) => {
      onError(errorMessage(err))
    },
  })

  if (currentShiftQuery.isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
          Đang kiểm tra trạng thái ca thu ngân...
        </CardContent>
      </Card>
    )
  }

  const shift = currentShiftQuery.data

  if (!shift || shift.status === 'CLOSED') {
    return (
      <div className="flex flex-col gap-6">
        {shift?.status === 'CLOSED' && (
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base">
                  Ca làm việc vừa kết thúc
                </h3>
                <p className="text-sm mt-0.5 opacity-90">
                  Đóng lúc:{' '}
                  {new Date(shift.closedAt || '').toLocaleString('vi-VN')}
                  {' • '}Tiền thực kiểm:{' '}
                  {formatPrice(shift.reportedEndingCash || '0')}
                </p>
              </div>
              {canCreateHandover && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onOpenCreateHandover(shift.id)}
                  className="gap-2"
                >
                  <Send className="w-4 h-4" />
                  Bàn giao két cho ca mới
                </Button>
              )}
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Unlock className="w-5 h-5 text-emerald-500" />
              Bắt đầu ca thu ngân mới
            </CardTitle>
          </CardHeader>
          <CardContent>
            {canOpen ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!openingFundId) {
                    onError('Vui lòng chọn quỹ tiền mặt cho ca')
                    return
                  }
                  openShiftMutation.mutate()
                }}
                className="flex flex-col gap-4 max-w-md"
              >
                {cashFundsQuery.isError && (
                  <p role="alert" className="text-sm text-destructive">
                    {errorMessage(cashFundsQuery.error)}{' '}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void cashFundsQuery.refetch()}
                    >
                      Thử tải quỹ
                    </Button>
                  </p>
                )}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">
                    Chọn quỹ tiền mặt ban đầu *
                  </label>
                  <select
                    disabled={
                      cashFundsQuery.isPending || cashFundsQuery.isError
                    }
                    value={openingFundId}
                    onChange={(e) => setOpeningFundId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background"
                    required
                  >
                    <option value="">-- Chọn quỹ tiền mặt --</option>
                    {cashFundsQuery.data?.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} (Số dư hiện tại: {formatPrice(f.balance)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">
                    Số tiền đầu ca (VND) *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                    placeholder="Ví dụ: 1000000"
                    required
                  />
                  <span className="text-xs text-muted-foreground">
                    Quy đổi: {formatPrice(openingCash || '0')}
                  </span>
                </div>

                <Button
                  type="submit"
                  variant="default"
                  disabled={
                    openShiftMutation.isPending ||
                    cashFundsQuery.isPending ||
                    cashFundsQuery.isError ||
                    !openingFundId
                  }
                  className="w-full mt-2"
                >
                  {openShiftMutation.isPending
                    ? 'Đang mở ca...'
                    : 'Xác nhận mở ca thu ngân'}
                </Button>
              </form>
            ) : (
              <div className="text-sm text-muted-foreground">
                Bạn không có đủ quyền mở ca thu ngân và xem quỹ. Vui lòng liên
                hệ quản lý.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Shift Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-muted-foreground font-medium">
              Tiền quỹ đầu ca
            </span>
            <p className="text-xl font-bold text-foreground mt-1">
              {formatPrice(shift.startingCash)}
            </p>
            <span className="text-xs text-muted-foreground mt-1 block">
              Quỹ: {shift.fund?.name || 'Mặc định'}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-muted-foreground font-medium">
              Doanh thu tiền mặt
            </span>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {formatPrice(shift.reconciliation?.cashSales || '0')}
            </p>
            <span className="text-xs text-muted-foreground mt-1 block">
              {shift.reconciliation?.paidInvoiceCount || 0} đơn thanh toán
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-muted-foreground font-medium">
              Doanh thu chuyển khoản/thẻ
            </span>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {formatPrice(shift.reconciliation?.nonCashSales || '0')}
            </p>
            <span className="text-xs text-muted-foreground mt-1 block">
              Đã gạch nợ tự động
            </span>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-4">
            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
              Tiền mặt dự kiến trong két
            </span>
            <p className="text-xl font-bold text-amber-800 dark:text-amber-300 mt-1">
              {formatPrice(
                shift.reconciliation?.actualEndingCash || shift.startingCash,
              )}
            </p>
            <span className="text-xs text-muted-foreground mt-1 block">
              = Tiền đầu ca + Tiền mặt thu được
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Transactions / Cash Movements & Expense Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Movement creation */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Coins className="w-4 h-4 text-primary" />
              Ghi nhận Thu / Chi tiền mặt tại két
            </CardTitle>
            {canTransact && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMovementForm(!showMovementForm)}
              >
                {showMovementForm ? 'Thu gọn' : 'Thêm giao dịch'}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {showMovementForm ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  movementMutation.mutate()
                }}
                className="flex flex-col gap-3 pt-2"
              >
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMovementType('INCOME')}
                    className={cn(
                      'flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                      movementType === 'INCOME'
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                        : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    + Nộp thêm vào két (INCOME)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType('EXPENSE')}
                    className={cn(
                      'flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                      movementType === 'EXPENSE'
                        ? 'bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400'
                        : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    - Chi tiền từ két (EXPENSE)
                  </button>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium">Số tiền (VND) *</label>
                  <Input
                    type="number"
                    min="1000"
                    step="1000"
                    value={movementAmount}
                    onChange={(e) => setMovementAmount(e.target.value)}
                    placeholder="Ví dụ: 100000"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium">
                    Lý do / Diễn giải *
                  </label>
                  <Input
                    value={movementDesc}
                    onChange={(e) => setMovementDesc(e.target.value)}
                    placeholder="Ví dụ: Mua đá lạnh khẩn cấp..."
                    required
                  />
                </div>

                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  disabled={movementMutation.isPending}
                  className="mt-1"
                >
                  {movementMutation.isPending
                    ? 'Đang ghi nhận...'
                    : 'Lưu giao dịch'}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground py-4">
                Dùng khi phát sinh nộp thêm tiền lẻ hoặc xuất quỹ chi tiêu khẩn
                cấp trong ca trực.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Current Shift Expense Requests Tracker */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-amber-500" />
                Phiếu chi tiền chờ duyệt của ca
              </span>
              <Badge variant="outline" className="text-xs">
                {currentExpensesQuery.data?.totalItems || 0} phiếu
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentExpensesQuery.isLoading ? (
              <div className="text-xs text-muted-foreground py-4 text-center">
                Đang tải...
              </div>
            ) : (currentExpensesQuery.data?.list.length || 0) === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center">
                Không có phiếu chi nào đang chờ duyệt trong ca này.
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {currentExpensesQuery.data?.list.map((req) => (
                  <div
                    key={req.id}
                    className="py-2.5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {req.description}
                      </p>
                      <span className="text-muted-foreground">
                        {formatPrice(req.amount)} •{' '}
                        {new Date(req.createdAt).toLocaleTimeString('vi-VN')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          req.status === 'APPROVED'
                            ? 'success'
                            : req.status === 'PENDING'
                              ? 'warning'
                              : 'outline'
                        }
                      >
                        {req.status === 'PENDING'
                          ? 'Chờ duyệt'
                          : req.status === 'APPROVED'
                            ? 'Đã duyệt'
                            : req.status}
                      </Badge>
                      {req.status === 'PENDING' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancelMyExpenseMutation.mutate(req.id)}
                          className="h-7 px-2 text-rose-500 hover:text-rose-600"
                        >
                          Hủy
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Close Shift Section */}
      {canClose && (
        <Card className="border-rose-500/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <Lock className="w-5 h-5" />
              Đóng ca thu ngân & Kiểm đếm tiền mặt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!reportedEndingCash) {
                  onError('Vui lòng nhập số tiền thực kiểm trong két')
                  return
                }
                closeShiftMutation.mutate()
              }}
              className="flex flex-col gap-4 max-w-lg"
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  Số tiền kiểm đếm thực tế cuối ca (VND) *
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1000"
                  value={reportedEndingCash}
                  onChange={(e) => setReportedEndingCash(e.target.value)}
                  placeholder="Ví dụ: 2500000"
                  required
                />
                <span className="text-xs text-muted-foreground">
                  Quy đổi: {formatPrice(reportedEndingCash || '0')}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  Ghi chú đóng ca (tùy chọn)
                </label>
                <Textarea
                  value={closingNote}
                  onChange={(e) => setClosingNote(e.target.value)}
                  placeholder="Ghi chú chênh lệch tiền mặt, bàn giao tiền lẻ..."
                  rows={2}
                />
              </div>

              <Button
                type="submit"
                variant="destructive"
                disabled={closeShiftMutation.isPending}
                className="w-full"
              >
                {closeShiftMutation.isPending
                  ? 'Đang chốt ca...'
                  : 'Xác nhận đóng ca & Chốt sổ'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
