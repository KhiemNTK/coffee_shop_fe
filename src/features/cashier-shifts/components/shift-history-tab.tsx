import { formatDateTime, formatPrice } from '@/shared/lib/format'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Eye, RefreshCw } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import type { Session } from '../../auth/session'
import { errorMessage } from '../../../shared/api/client'
import { fromStoreLocal } from '../../../shared/lib/store-time'
import {
  Button,
  Dialog,
  DialogTitle,
  DialogDescription,
  Input,
} from '../../../shared/ui'
import { Pagination } from '../../../shared/ui/pagination'
import {
  getCashierShifts,
  getCashierShift,
  getFunds,
  type GetCashierShiftsParams,
  type CashierShift,
} from '../cashier-shifts.api'
import { Badge, Card, CardContent } from '../../../shared/ui'

const EMPTY_SHIFTS: CashierShift[] = []

export function ShiftHistoryTab() {
  const { t } = useTranslation()
  const { employee, access } = useOutletContext<Session>()
  const canReadFunds = access.has('/funds_read')
  const [openedFrom, setOpenedFrom] = useState('')
  const [openedTo, setOpenedTo] = useState('')
  const [fundId, setFundId] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [filterError, setFilterError] = useState('')
  const [filters, setFilters] = useState<GetCashierShiftsParams>({})
  const [page, setPage] = useState(1)
  const funds = useQuery({
    queryKey: ['private', 'funds', 'history', employee.id],
    queryFn: ({ signal }) => getFunds({ page: 1, itemPerPage: 100 }, signal),
    enabled: canReadFunds,
  })
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
      filters,
      page,
    ],
    queryFn: ({ signal }) =>
      getCashierShifts(
        {
          ...filters,
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">
          {t('cash.historyTitle')}
        </h2>
        <select
          value={historyStatusFilter}
          aria-label={t('cash.shiftStatus')}
          onChange={(e) => {
            setHistoryStatusFilter(e.target.value as "ALL" | "OPEN" | "CLOSED");
            setPage(1);
          }}
          className="px-3 py-1.5 text-xs rounded-lg border border-input bg-background"
        >
          <option value="ALL">{t('cash.allShifts')}</option>
          <option value="OPEN">{t('cash.shiftOpen')}</option>
          <option value="CLOSED">{t('cash.shiftClosed')}</option>
        </select>
      </div>

      <form className="space-y-3" aria-label={t('cash.historyFilters')} onSubmit={event => {
        event.preventDefault()
        try {
          const from = openedFrom ? fromStoreLocal(`${openedFrom}T00:00`) : undefined
          const to = openedTo ? fromStoreLocal(`${openedTo}T00:00`) : undefined
          if (from && to && from > to) throw new Error('Invalid range')
          setFilters({
            openedFrom: from?.toISOString(),
            openedTo: to ? new Date(to.getTime() + 86_400_000).toISOString() : undefined,
            fundId: canReadFunds ? fundId || undefined : undefined,
            employeeId: mineOnly ? employee.id : undefined,
          })
          setFilterError('')
          setPage(1)
        } catch {
          setFilterError(t('cash.invalidDateRange'))
        }
      }}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label htmlFor="shifts-from" className="text-sm font-medium">{t('cash.openedFrom')}</label>
            <Input id="shifts-from" type="date" value={openedFrom} onChange={event => setOpenedFrom(event.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor="shifts-to" className="text-sm font-medium">{t('cash.openedTo')}</label>
            <Input id="shifts-to" type="date" value={openedTo} onChange={event => setOpenedTo(event.target.value)} />
          </div>
          {canReadFunds && <div className="space-y-1">
            <label htmlFor="shifts-fund" className="text-sm font-medium">{t('cash.fund')}</label>
            <select id="shifts-fund" value={fundId} onChange={event => setFundId(event.target.value)} disabled={!funds.isSuccess} className="min-h-10 w-full max-w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">{t('cash.allFunds')}</option>
              {funds.data?.list.map(fund => <option key={fund.id} value={fund.id}>{fund.name}</option>)}
            </select>
          </div>}
          <label className="flex min-h-10 items-center gap-2 self-end text-sm">
            <input type="checkbox" checked={mineOnly} onChange={event => setMineOnly(event.target.checked)} className="size-4" />
            {t('cash.mineOnly')}
          </label>
        </div>
        {canReadFunds && funds.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(funds.error)} <Button type="button" variant="outline" size="sm" onClick={() => void funds.refetch()}>{t('common.retry')}</Button></p>}
        {filterError && <p role="alert" className="text-sm text-destructive">{filterError}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="outline" size="sm">{t('cash.applyFilters')}</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => {
            setOpenedFrom(''); setOpenedTo(''); setFundId(''); setMineOnly(false); setFilters({}); setHistoryStatusFilter('ALL'); setFilterError(''); setPage(1)
          }}>{t('cash.resetFilters')}</Button>
          <span className="text-xs text-muted-foreground">{t('cash.historyDateHint')}</span>
        </div>
      </form>

      {shiftsHistoryQuery.isError && (
        <p role="alert" className="text-destructive">
          {errorMessage(shiftsHistoryQuery.error)}{" "}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void shiftsHistoryQuery.refetch()}
          >
            {t('common.retry')}
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
              ) : !shiftsHistoryQuery.isError && shiftsList.length === 0 ? (
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
                      <span className="block">{formatDateTime(shift.openedAt)}</span>
                      <span className="block">{shift.closedAt ? formatDateTime(shift.closedAt) : t('cash.shiftOpen')}</span>
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
                ["Chi hoàn tiền mặt", detail.data.reconciliation?.cashRefundAmount],
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
