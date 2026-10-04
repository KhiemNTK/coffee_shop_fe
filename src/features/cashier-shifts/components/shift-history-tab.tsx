import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { formatPrice } from '../../menu/menu.api'
import {
  getCashierShifts,
  type CashierShift,
} from '../cashier-shifts.api'
import {
  Badge,
  Card,
  CardContent,
} from '../../../shared/ui'

const EMPTY_SHIFTS: CashierShift[] = []

export function ShiftHistoryTab() {
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL')

  const shiftsHistoryQuery = useQuery({
    queryKey: ['private', 'cashier-shifts', 'history', historyStatusFilter],
    queryFn: ({ signal }) =>
      getCashierShifts(
        {
          page: 1,
          itemPerPage: 50,
          status: historyStatusFilter === 'ALL' ? undefined : historyStatusFilter,
        },
        signal,
      ),
  })

  const shiftsList = shiftsHistoryQuery.data?.list ?? EMPTY_SHIFTS

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">
          Nhật ký Lịch sử Toàn bộ Ca làm việc
        </h2>
        <select
          value={historyStatusFilter}
          onChange={(e) => setHistoryStatusFilter(e.target.value as 'ALL' | 'OPEN' | 'CLOSED')}
          className="px-3 py-1.5 text-xs rounded-lg border border-input bg-background"
        >
          <option value="ALL">Tất cả ca làm việc</option>
          <option value="OPEN">Đang hoạt động (OPEN)</option>
          <option value="CLOSED">Đã đóng sổ (CLOSED)</option>
        </select>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3 font-semibold">Mã ca</th>
                <th className="px-4 py-3 font-semibold">Thu ngân phụ trách</th>
                <th className="px-4 py-3 font-semibold">Quỹ tiền</th>
                <th className="px-4 py-3 font-semibold">Thời gian mở - đóng</th>
                <th className="px-4 py-3 font-semibold text-right">Tiền đầu ca</th>
                <th className="px-4 py-3 font-semibold text-right">Tiền thực kiểm</th>
                <th className="px-4 py-3 font-semibold text-right">Chênh lệch</th>
                <th className="px-4 py-3 font-semibold text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shiftsHistoryQuery.isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    Đang tải lịch sử ca thu ngân...
                  </td>
                </tr>
              ) : shiftsList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Không có ca làm việc nào.
                  </td>
                </tr>
              ) : (
                shiftsList.map((shift) => (
                  <tr key={shift.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium">{shift.id.slice(0, 8)}...</td>
                    <td className="px-4 py-3 font-medium text-foreground">{shift.employee.fullName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{shift.fund?.name || 'Mặc định'}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(shift.openedAt).toLocaleTimeString('vi-VN')}
                      {' → '}
                      {shift.closedAt
                        ? new Date(shift.closedAt).toLocaleTimeString('vi-VN')
                        : 'Đang mở'}
                      <span className="block text-[10px]">
                        {new Date(shift.openedAt).toLocaleDateString('vi-VN')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatPrice(shift.startingCash)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {shift.reportedEndingCash ? formatPrice(shift.reportedEndingCash) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {shift.reconciliation?.difference ? (
                        Number(shift.reconciliation.difference) === 0 ? (
                          <span className="text-muted-foreground">Khớp (0 đ)</span>
                        ) : Number(shift.reconciliation.difference) < 0 ? (
                          <span className="text-rose-600 font-bold">
                            {formatPrice(shift.reconciliation.difference)}
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-bold">
                            +{formatPrice(shift.reconciliation.difference)}
                          </span>
                        )
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={shift.status === 'OPEN' ? 'success' : 'outline'}>
                        {shift.status === 'OPEN' ? 'Đang mở' : 'Đã đóng'}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
