import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import {
  AlertCircle,
  CheckCircle2,
  Lock,
  PlusCircle,
  Receipt,
  Unlock,
} from 'lucide-react'
import { errorMessage } from '../../shared/api/client'
import { type Session } from '../auth/session'
import { formatPrice } from '../menu/menu.api'
import {
  addCashMovement,
  closeCashierShift,
  getCashFunds,
  getCurrentShift,
  openCashierShift,
} from './cashier-shifts.api'
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Input,
  Textarea,
} from '../../shared/ui'

export default function CashierShiftPage() {
  const { employee, authorization } = useOutletContext<Session>()
  const queryClient = useQueryClient()
  const canOpen = authorization.permissionKeys.includes('/cashier-shifts_open')
  const canClose = authorization.permissionKeys.includes('/cashier-shifts_close')
  const canTransact = authorization.permissionKeys.includes(
    '/cashier-shifts_transactions-create',
  )

  const [openingFundId, setOpeningFundId] = useState('')
  const [openingCash, setOpeningCash] = useState('0')
  const [reportedEndingCash, setReportedEndingCash] = useState('')
  const [closingNote, setClosingNote] = useState('')

  const [movementType, setMovementType] = useState<'INCOME' | 'EXPENSE'>('INCOME')
  const [movementAmount, setMovementAmount] = useState('')
  const [movementDesc, setMovementDesc] = useState('')
  const [showMovementForm, setShowMovementForm] = useState(false)

  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  const shiftQuery = useQuery({
    queryKey: ['private', employee.id, 'cashier-shift', 'current'],
    queryFn: ({ signal }) => getCurrentShift(signal),
  })

  const fundsQuery = useQuery({
    queryKey: ['private', employee.id, 'funds', 'cash'],
    queryFn: ({ signal }) => getCashFunds(signal),
    enabled: shiftQuery.data === null && canOpen,
  })

  const openMutation = useMutation({
    mutationFn: async () => {
      setActionError(null)
      setActionSuccess(null)
      const fundId = openingFundId || fundsQuery.data?.[0]?.id
      if (!fundId) throw new Error('Vui lòng chọn quỹ tiền mặt')
      return openCashierShift(fundId, openingCash)
    },
    onSuccess: () => {
      setActionSuccess('Đã mở ca làm việc thành công')
      void queryClient.invalidateQueries({ queryKey: ['private', employee.id, 'cashier-shift'] })
    },
    onError: (err) => {
      setActionError(errorMessage(err))
    },
  })

  const closeMutation = useMutation({
    mutationFn: async () => {
      setActionError(null)
      setActionSuccess(null)
      if (!reportedEndingCash.trim()) {
        throw new Error('Vui lòng nhập số tiền mặt thực tế khi đóng ca')
      }
      return closeCashierShift(reportedEndingCash, closingNote)
    },
    onSuccess: (closedShift) => {
      setActionSuccess('Đã chốt ca làm việc thành công')
      setReportedEndingCash('')
      setClosingNote('')
      void queryClient.invalidateQueries({ queryKey: ['private', employee.id, 'cashier-shift'] })
      if (closedShift.reconciliation?.difference) {
        setActionSuccess(
          `Đã chốt ca. Chênh lệch tiền mặt: ${formatPrice(closedShift.reconciliation.difference)}`,
        )
      }
    },
    onError: (err) => {
      setActionError(errorMessage(err))
    },
  })

  const movementMutation = useMutation({
    mutationFn: async () => {
      setActionError(null)
      setActionSuccess(null)
      if (!movementAmount.trim() || Number(movementAmount) <= 0) {
        throw new Error('Số tiền phải lớn hơn 0')
      }
      if (!movementDesc.trim()) {
        throw new Error('Vui lòng nhập lý do thu/chi')
      }
      return addCashMovement(movementType, movementAmount, movementDesc)
    },
    onSuccess: () => {
      setActionSuccess('Đã ghi nhận giao dịch tiền mặt')
      setMovementAmount('')
      setMovementDesc('')
      setShowMovementForm(false)
      void queryClient.invalidateQueries({ queryKey: ['private', employee.id, 'cashier-shift'] })
    },
    onError: (err) => {
      setActionError(errorMessage(err))
    },
  })

  if (shiftQuery.isPending) {
    return (
      <main className="py-16 text-center text-sm text-[#68776f]" role="status">
        <p>Đang kiểm tra ca thu ngân…</p>
      </main>
    )
  }

  if (shiftQuery.isError) {
    return (
      <main className="py-12 flex flex-col items-center gap-3">
        <p role="alert" className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
          {errorMessage(shiftQuery.error)}
        </p>
        <Button
          variant="default"
          onClick={() => void shiftQuery.refetch()}
          disabled={shiftQuery.isFetching}
        >
          Thử lại
        </Button>
      </main>
    )
  }

  const shift = shiftQuery.data

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[#68776f]">THU NGÂN</p>
        <h1 className="text-2xl font-bold tracking-tight text-[#1a2723] mt-1">Quản lý ca làm việc</h1>
      </div>

      {actionError && (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-lg border border-red-300 bg-red-50 p-3.5 text-sm text-red-800"
        >
          <AlertCircle size={18} />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-lg border border-emerald-300 bg-emerald-50 p-3.5 text-sm font-semibold text-emerald-800"
        >
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {!shift ? (
        <Card className="max-w-xl">
          <CardHeader>
            <div className="flex items-center gap-2 text-[#174f3f]">
              <Unlock size={20} />
              <CardTitle>Mở ca mới</CardTitle>
            </div>
            <p className="text-sm text-[#68776f] mt-1">
              Bạn hiện chưa có ca làm việc nào đang mở. Vui lòng chọn quỹ và khai báo tiền mặt ban đầu để bắt đầu bán hàng.
            </p>
          </CardHeader>

          <CardContent>
            {!canOpen ? (
              <p role="alert" className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                Bạn không có quyền mở ca thu ngân (`/cashier-shifts_open`). Vui lòng liên hệ quản lý.
              </p>
            ) : fundsQuery.isPending ? (
              <p role="status" className="text-sm text-[#68776f]">Đang tải danh sách quỹ…</p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  openMutation.mutate()
                }}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="fundSelect" className="block text-xs font-semibold text-[#202d29] mb-1.5">
                    Quỹ tiền mặt
                  </label>
                  <select
                    id="fundSelect"
                    value={openingFundId || fundsQuery.data?.[0]?.id || ''}
                    onChange={(e) => setOpeningFundId(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-[#bccdc3] bg-white px-3 py-2 text-sm text-[#202d29] shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#174f3f]"
                    required
                  >
                    {fundsQuery.data?.map((fund) => (
                      <option key={fund.id} value={fund.id}>
                        {fund.name} (Số dư sổ sách: {formatPrice(fund.balance)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="startingCashInput" className="block text-xs font-semibold text-[#202d29] mb-1.5">
                    Tiền mặt đầu ca (₫)
                  </label>
                  <Input
                    id="startingCashInput"
                    type="number"
                    min="0"
                    step="1000"
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={openMutation.isPending}
                  isLoading={openMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  <Unlock size={16} />
                  {openMutation.isPending ? 'Đang mở ca…' : 'Xác nhận mở ca'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Thông tin ca hiện tại */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock size={18} className="text-emerald-700" />
                  <CardTitle>Ca đang hoạt động</CardTitle>
                </div>
                <Badge variant="success">Đang mở</Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <dl className="grid grid-cols-2 gap-3 text-xs bg-[#f8faf9] p-3.5 rounded-lg border border-[#e2eae5]">
                <div>
                  <dt className="text-[#68776f]">Quỹ tiền</dt>
                  <dd className="font-semibold text-sm text-[#202d29] mt-0.5">
                    {shift.fund?.name ?? 'Quỹ tiền mặt'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#68776f]">Thu ngân</dt>
                  <dd className="font-semibold text-sm text-[#202d29] mt-0.5">
                    {shift.employee.fullName}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#68776f]">Giờ mở ca</dt>
                  <dd className="font-medium text-[#202d29] mt-0.5">
                    {new Date(shift.openedAt).toLocaleString('vi-VN')}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#68776f]">Tiền mặt đầu ca</dt>
                  <dd className="font-bold text-sm text-[#174f3f] mt-0.5">
                    {formatPrice(shift.startingCash)}
                  </dd>
                </div>
                {shift.openingDifference && shift.openingDifference !== '0' && (
                  <div className="col-span-2 pt-1 border-t border-[#dce5df]">
                    <dt className="text-[#68776f]">Chênh lệch mở</dt>
                    <dd className="font-bold text-red-700 mt-0.5">
                      {formatPrice(shift.openingDifference)}
                    </dd>
                  </div>
                )}
              </dl>

              {/* Thao tác nạp / rút tiền mặt nội bộ */}
              {canTransact && (
                <div className="pt-3 border-t border-dashed border-[#dce5df]">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMovementForm((prev) => !prev)}
                    className="text-[#174f3f] font-semibold gap-1.5 p-0 h-auto hover:bg-transparent hover:underline"
                  >
                    <PlusCircle size={15} />
                    {showMovementForm ? 'Đóng biểu mẫu thu/chi lẻ' : 'Thu / Chi tiền mặt lẻ trong ca'}
                  </Button>

                  {showMovementForm && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        movementMutation.mutate()
                      }}
                      className="bg-[#f8faf9] p-3.5 rounded-lg border border-[#e2eae5] mt-3 space-y-3"
                    >
                      <div className="flex gap-4 text-xs font-medium">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="movementType"
                            value="INCOME"
                            checked={movementType === 'INCOME'}
                            onChange={() => setMovementType('INCOME')}
                            className="text-[#174f3f] focus:ring-[#174f3f]"
                          />
                          Nạp tiền lẻ (Thu)
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="movementType"
                            value="EXPENSE"
                            checked={movementType === 'EXPENSE'}
                            onChange={() => setMovementType('EXPENSE')}
                            className="text-[#174f3f] focus:ring-[#174f3f]"
                          />
                          Rút tiền lẻ / Chi vặt
                        </label>
                      </div>

                      <Input
                        type="number"
                        min="1000"
                        step="1000"
                        placeholder="Số tiền (₫)"
                        value={movementAmount}
                        onChange={(e) => setMovementAmount(e.target.value)}
                        required
                        className="bg-white"
                      />

                      <Input
                        type="text"
                        maxLength={300}
                        placeholder="Lý do thu / chi"
                        value={movementDesc}
                        onChange={(e) => setMovementDesc(e.target.value)}
                        required
                        className="bg-white"
                      />

                      <Button
                        type="submit"
                        size="sm"
                        disabled={movementMutation.isPending}
                        isLoading={movementMutation.isPending}
                      >
                        {movementMutation.isPending ? 'Đang lưu…' : 'Ghi nhận giao dịch'}
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Doanh thu & Chốt ca */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-[#174f3f]">
                <Receipt size={18} />
                <CardTitle>Doanh thu & Chốt ca</CardTitle>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {shift.reconciliation ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#f8faf9] p-3 rounded-lg border border-[#e2eae5]">
                    <span className="text-xs text-[#68776f]">Hóa đơn đã thanh toán</span>
                    <p className="text-xl font-bold text-[#202d29] mt-0.5">
                      {shift.reconciliation.paidInvoiceCount ?? 0}
                    </p>
                  </div>
                  <div className="bg-[#f8faf9] p-3 rounded-lg border border-[#e2eae5]">
                    <span className="text-xs text-[#68776f]">Doanh thu tiền mặt</span>
                    <p className="text-lg font-bold text-[#174f3f] mt-0.5">
                      {formatPrice(shift.reconciliation.cashSales ?? '0')}
                    </p>
                  </div>
                  <div className="bg-[#f8faf9] p-3 rounded-lg border border-[#e2eae5]">
                    <span className="text-xs text-[#68776f]">Tiền mặt lý thuyết (Két)</span>
                    <p className="text-lg font-bold text-[#174f3f] mt-0.5">
                      {formatPrice(shift.reconciliation.actualEndingCash ?? '0')}
                    </p>
                  </div>
                  <div className="bg-[#f8faf9] p-3 rounded-lg border border-[#e2eae5]">
                    <span className="text-xs text-[#68776f]">Tổng doanh thu ca</span>
                    <p className="text-lg font-bold text-[#202d29] mt-0.5">
                      {formatPrice(shift.reconciliation.totalSales ?? '0')}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#68776f]">
                  Chưa có dữ liệu đối soát phát sinh trong ca.
                </p>
              )}

              {canClose && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    closeMutation.mutate()
                  }}
                  className="border-t border-[#e2eae5] pt-4 space-y-3"
                >
                  <h3 className="text-sm font-semibold text-[#1a2723]">Đóng ca thu ngân</h3>
                  <div>
                    <label
                      htmlFor="reportedEndingCash"
                      className="block text-xs font-semibold text-[#202d29] mb-1"
                    >
                      Số tiền mặt thực tế kiểm đếm trong két (₫)
                    </label>
                    <Input
                      id="reportedEndingCash"
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="Nhập tổng số tiền mặt thực tế"
                      value={reportedEndingCash}
                      onChange={(e) => setReportedEndingCash(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="closingNote"
                      className="block text-xs font-semibold text-[#202d29] mb-1"
                    >
                      Ghi chú đóng ca (nếu có chênh lệch)
                    </label>
                    <Textarea
                      id="closingNote"
                      maxLength={500}
                      rows={2}
                      placeholder="Lý do chênh lệch hoặc bàn giao ca..."
                      value={closingNote}
                      onChange={(e) => setClosingNote(e.target.value)}
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={closeMutation.isPending}
                    isLoading={closeMutation.isPending}
                    className="w-full"
                  >
                    <Lock size={15} />
                    {closeMutation.isPending ? 'Đang chốt ca…' : 'Xác nhận đóng ca'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
