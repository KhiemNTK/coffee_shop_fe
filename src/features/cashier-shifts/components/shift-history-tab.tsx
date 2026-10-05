import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, RefreshCw } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import type { Session } from '../../auth/session'
import { errorMessage } from '../../../shared/api/client'
import {
  Button,
  Dialog,
  DialogTitle,
  DialogDescription,
} from '../../../shared/ui'
import { Pagination } from '../../../shared/ui/pagination'
import { formatPrice } from '../../menu/menu.api'
import {
  getCashierShifts,
  getCashierShift,
  type CashierShift,
} from '../cashier-shifts.api'
import { Badge, Card, CardContent } from '../../../shared/ui'

const EMPTY_SHIFTS: CashierShift[] = []

export function ShiftHistoryTab() {
  const { employee } = useOutletContext<Session>()
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const detail = useQuery({
    queryKey: ['private', employee.id, 'cashier-shifts', 'detail', selectedId],
    queryFn: ({ signal }) => getCashierShift(selectedId!, signal),
    enabled: Boolean(selectedId),
    retry: false,
  })
  const [historyStatusFilter, setHistoryStatusFilter] = useState<
    'ALL' | 'OPEN' | 'CLOSED'
  >('ALL')

  const shiftsHistoryQuery = useQuery({
    queryKey: [
      'private',
      employee.id,
      'cashier-shifts',
      'history',
      historyStatusFilter,
      page,
    ],
    queryFn: ({ signal }) =>
      getCashierShifts(
        {
          page,
          itemPerPage: 50,
          status:
            historyStatusFilter === 'ALL' ? undefined : historyStatusFilter,
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
          aria-label="Trạng thái ca"
          onChange={(e) => {
            setHistoryStatusFilter(e.target.value as "ALL" | "OPEN" | "CLOSED");
            setPage(1);
          }}
          className="px-3 py-1.5 text-xs rounded-lg border border-input bg-background"
        >
          <option value="ALL">Tất cả ca làm việc</option>
          <option value="OPEN">Đang hoạt động (OPEN)</option>
          <option value="CLOSED">Đã đóng sổ (CLOSED)</option>
        </select>
      </div>

      {shiftsHistoryQuery.isError && (
        <p role="alert" className="text-destructive">
          {errorMessage(shiftsHistoryQuery.error)}{" "}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void shiftsHistoryQuery.refetch()}
          >
            Thử lại
          </Button>
        </p>
      )}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3 font-semibold">Mã ca</th>
                <th className="px-4 py-3 font-semibold">Thu ngân phụ trách</th>
                <th className="px-4 py-3 font-semibold">Quỹ tiền</th>
                <th className="px-4 py-3 font-semibold">Thời gian mở - đóng</th>
                <th className="px-4 py-3 font-semibold text-right">
                  Tiền đầu ca
                </th>
                <th className="px-4 py-3 font-semibold text-right">
                  Tiền thực kiểm
                </th>
                <th className="px-4 py-3 font-semibold text-right">
                  Chênh lệch
                </th>
                <th className="px-4 py-3 font-semibold text-center">
                  Trạng thái
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shiftsHistoryQuery.isLoading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    Đang tải lịch sử ca thu ngân...
                  </td>
                </tr>
              ) : shiftsList.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Không có ca làm việc nào.
                  </td>
                </tr>
              ) : (
                shiftsList.map((shift) => (
                  <tr
                    key={shift.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-medium">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Chi tiết ca ${shift.id.slice(0, 8)}`}
                        onClick={() => setSelectedId(shift.id)}
                      >
                        <Eye size={16} />
                        {shift.id.slice(0, 8)}
                      </Button>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {shift.employee.fullName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {shift.fund?.name || "Mặc định"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(shift.openedAt).toLocaleTimeString("vi-VN")}
                      {" → "}
                      {shift.closedAt
                        ? new Date(shift.closedAt).toLocaleTimeString("vi-VN")
                        : "Đang mở"}
                      <span className="block text-[10px]">
                        {new Date(shift.openedAt).toLocaleDateString("vi-VN")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatPrice(shift.startingCash)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {shift.reportedEndingCash
                        ? formatPrice(shift.reportedEndingCash)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(shift.difference ?? shift.reconciliation?.difference) !=
                      null ? (
                        Number(
                          shift.difference ?? shift.reconciliation?.difference,
                        ) === 0 ? (
                          <span className="text-muted-foreground">
                            Khớp (0 đ)
                          </span>
                        ) : Number(
                            shift.difference ??
                              shift.reconciliation?.difference,
                          ) < 0 ? (
                          <span className="text-rose-600 font-bold">
                            {formatPrice(
                              String(
                                shift.difference ??
                                  shift.reconciliation?.difference,
                              ),
                            )}
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-bold">
                            +
                            {formatPrice(
                              String(
                                shift.difference ??
                                  shift.reconciliation?.difference,
                              ),
                            )}
                          </span>
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant={
                          shift.status === "OPEN" ? "success" : "outline"
                        }
                      >
                        {shift.status === "OPEN" ? "Đang mở" : "Đã đóng"}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Pagination
        page={page}
        totalPages={shiftsHistoryQuery.data?.totalPages ?? 0}
        onPage={setPage}
        disabled={shiftsHistoryQuery.isFetching}
      />
      <Dialog
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <DialogTitle>Chi tiết ca thu ngân</DialogTitle>
        <DialogDescription>{detail.data?.employee.fullName}</DialogDescription>
        {detail.isPending && <p role="status">Đang tải đối soát ca…</p>}
        {detail.isError && (
          <p role="alert" className="text-destructive">
            {errorMessage(detail.error)}{" "}
            <Button onClick={() => void detail.refetch()}>Thử lại</Button>
          </p>
        )}
        {detail.data && (
          <dl className="grid grid-cols-2 gap-3 py-4 text-sm">
            {(
              [
                ["Tiền đầu ca", detail.data.startingCash],
                ["Lệch đầu ca", detail.data.openingDifference],
                ["Doanh thu tiền mặt", detail.data.reconciliation?.cashSales],
                [
                  "Doanh thu không tiền mặt",
                  detail.data.reconciliation?.nonCashSales,
                ],
                [
                  "Tiền hệ thống cuối ca",
                  detail.data.reconciliation?.actualEndingCash,
                ],
                ["Tiền thực kiểm", detail.data.reportedEndingCash],
                ["Chênh lệch", detail.data.reconciliation?.difference],
              ] as const
            ).map(([label, amount]) => (
              <div key={label} className="min-w-0">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="wrap-break-word font-medium">
                  {amount != null ? formatPrice(amount) : "—"}
                </dd>
              </div>
            ))}
            {detail.data.closingNote && (
              <div className="col-span-2">
                <dt>Ghi chú đóng ca</dt>
                <dd className="wrap-break-word">{detail.data.closingNote}</dd>
              </div>
            )}
          </dl>
        )}
      </Dialog>
    </div>
  );
}
