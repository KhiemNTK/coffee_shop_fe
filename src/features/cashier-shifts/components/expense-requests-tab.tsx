import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ban, Check, RefreshCw } from 'lucide-react'
import { errorMessage } from '../../../shared/api/client'
import { formatPrice } from '../../menu/menu.api'
import {
  approveExpenseRequest,
  getExpenseRequests,
  rejectExpenseRequest,
  type CashExpenseRequest,
  type CashExpenseRequestStatus,
} from '../cashier-shifts.api'
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogHeader,
  DialogTitle,
  Textarea,
} from '../../../shared/ui'

const EMPTY_EXPENSES: CashExpenseRequest[] = []

interface ExpenseRequestsTabProps {
  onError: (msg: string) => void
  onSuccess: (msg: string) => void
}

export function ExpenseRequestsTab({ onError, onSuccess }: ExpenseRequestsTabProps) {
  const queryClient = useQueryClient()

  const [expenseStatusFilter, setExpenseStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL')
  const [selectedExpense, setSelectedExpense] = useState<CashExpenseRequest | null>(null)
  const [isApproveExpenseModalOpen, setIsApproveExpenseModalOpen] = useState(false)
  const [isRejectExpenseModalOpen, setIsRejectExpenseModalOpen] = useState(false)
  const [expenseReviewNote, setExpenseReviewNote] = useState('')
  const [expenseRejectReason, setExpenseRejectReason] = useState('')

  const expensesQuery = useQuery({
    queryKey: ['private', 'expense-requests', expenseStatusFilter],
    queryFn: ({ signal }) =>
      getExpenseRequests(
        {
          page: 1,
          itemPerPage: 50,
          status: expenseStatusFilter === 'ALL' ? (undefined as CashExpenseRequestStatus | undefined) : (expenseStatusFilter as CashExpenseRequestStatus),
        },
        signal,
      ),
  })

  const expensesList = expensesQuery.data?.list ?? EMPTY_EXPENSES

  const approveExpenseMutation = useMutation({
    mutationFn: () => {
      if (!selectedExpense) throw new Error('Chưa chọn phiếu chi')
      return approveExpenseRequest(selectedExpense.id, expenseReviewNote)
    },
    onSuccess: () => {
      onSuccess('Đã phê duyệt phiếu chi tiền mặt!')
      setIsApproveExpenseModalOpen(false)
      setSelectedExpense(null)
      setExpenseReviewNote('')
      void queryClient.invalidateQueries({ queryKey: ['private', 'expense-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['private', 'funds'] })
    },
    onError: (err) => {
      onError(errorMessage(err))
    },
  })

  const rejectExpenseMutation = useMutation({
    mutationFn: () => {
      if (!selectedExpense) throw new Error('Chưa chọn phiếu chi')
      return rejectExpenseRequest(selectedExpense.id, expenseRejectReason)
    },
    onSuccess: () => {
      onSuccess('Đã từ chối phiếu chi tiền mặt!')
      setIsRejectExpenseModalOpen(false)
      setSelectedExpense(null)
      setExpenseRejectReason('')
      void queryClient.invalidateQueries({ queryKey: ['private', 'expense-requests'] })
    },
    onError: (err) => {
      onError(errorMessage(err))
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">
          Hàng đợi Phê duyệt Phiếu chi Tiền mặt khẩn cấp
        </h2>
        <select
          value={expenseStatusFilter}
          onChange={(e) => setExpenseStatusFilter(e.target.value as 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED')}
          className="px-3 py-1.5 text-xs rounded-lg border border-input bg-background"
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="PENDING">Chờ phê duyệt (PENDING)</option>
          <option value="APPROVED">Đã phê duyệt (APPROVED)</option>
          <option value="REJECTED">Đã từ chối (REJECTED)</option>
        </select>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3 font-semibold">Mã yêu cầu</th>
                <th className="px-4 py-3 font-semibold">Người đề xuất</th>
                <th className="px-4 py-3 font-semibold">Quỹ tiền</th>
                <th className="px-4 py-3 font-semibold text-right">Số tiền chi</th>
                <th className="px-4 py-3 font-semibold">Lý do diễn giải</th>
                <th className="px-4 py-3 font-semibold">Thời gian</th>
                <th className="px-4 py-3 font-semibold text-center">Trạng thái</th>
                <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {expensesQuery.isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    Đang tải danh sách yêu cầu chi tiền...
                  </td>
                </tr>
              ) : expensesList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Không có yêu cầu chi tiền nào.
                  </td>
                </tr>
              ) : (
                expensesList.map((exp) => (
                  <tr key={exp.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium">{exp.id.slice(0, 8)}...</td>
                    <td className="px-4 py-3 font-medium text-foreground">{exp.requestedBy?.fullName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{exp.fund?.name}</td>
                    <td className="px-4 py-3 text-right font-bold text-rose-600 dark:text-rose-400">
                      {formatPrice(exp.amount)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{exp.description}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(exp.createdAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant={
                          exp.status === 'PENDING'
                            ? 'warning'
                            : exp.status === 'APPROVED'
                              ? 'success'
                              : 'destructive'
                        }
                      >
                        {exp.status === 'PENDING'
                          ? 'Chờ duyệt'
                          : exp.status === 'APPROVED'
                            ? 'Đã duyệt'
                            : 'Từ chối'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {exp.status === 'PENDING' && (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedExpense(exp)
                              setIsApproveExpenseModalOpen(true)
                            }}
                            className="h-7 px-2.5 text-emerald-600 dark:text-emerald-400 gap-1 text-[11px]"
                          >
                            <Check className="w-3 h-3" />
                            Duyệt
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedExpense(exp)
                              setIsRejectExpenseModalOpen(true)
                            }}
                            className="h-7 px-2.5 text-rose-600 dark:text-rose-400 gap-1 text-[11px]"
                          >
                            <Ban className="w-3 h-3" />
                            Từ chối
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* 7. APPROVE EXPENSE REQUEST MODAL */}
      <Dialog
        open={isApproveExpenseModalOpen}
        onClose={() => setIsApproveExpenseModalOpen(false)}
      >
        <DialogHeader>
          <DialogTitle>Duyệt Phiếu chi Tiền mặt</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <p className="text-sm text-muted-foreground">
            Duyệt yêu cầu chi{' '}
            <strong className="text-rose-600">{formatPrice(selectedExpense?.amount || '0')}</strong>{' '}
            từ nhân viên <strong className="text-foreground">{selectedExpense?.requestedBy?.fullName}</strong>.
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Ghi chú duyệt chi (tùy chọn)</label>
            <Textarea
              value={expenseReviewNote}
              onChange={(e) => setExpenseReviewNote(e.target.value)}
              placeholder="Đã xác nhận hóa đơn chứng từ..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsApproveExpenseModalOpen(false)}>
              Hủy
            </Button>
            <Button
              variant="default"
              onClick={() => approveExpenseMutation.mutate()}
              disabled={approveExpenseMutation.isPending}
            >
              {approveExpenseMutation.isPending ? 'Đang duyệt...' : 'Xác nhận duyệt chi'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* 8. REJECT EXPENSE REQUEST MODAL */}
      <Dialog
        open={isRejectExpenseModalOpen}
        onClose={() => setIsRejectExpenseModalOpen(false)}
      >
        <DialogHeader>
          <DialogTitle>Từ chối Phiếu chi Tiền mặt</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Lý do từ chối chi *</label>
            <Textarea
              value={expenseRejectReason}
              onChange={(e) => setExpenseRejectReason(e.target.value)}
              placeholder="Không có chứng từ hợp lệ, chi sai quy định..."
              rows={3}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsRejectExpenseModalOpen(false)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!expenseRejectReason.trim()) {
                  onError('Vui lòng nhập lý do từ chối chi')
                  return
                }
                rejectExpenseMutation.mutate()
              }}
              disabled={rejectExpenseMutation.isPending}
            >
              {rejectExpenseMutation.isPending ? 'Đang từ chối...' : 'Từ chối phiếu chi'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
