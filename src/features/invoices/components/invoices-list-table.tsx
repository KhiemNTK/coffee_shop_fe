import { formatPrice } from '@/shared/lib/format'
import { AlertCircle, Eye, FilterX, RefreshCw, Search } from 'lucide-react'
import type { Dispatch, SetStateAction, ReactNode } from 'react'
import type {
  InvoicesFilters,
  InvoicesResponse,
  Invoice,
  PaymentMethod,
  PaymentStatus,
} from '../invoices.api'
import { formatStoreDateTime, fromStoreLocal, toStoreLocal } from '../../../shared/lib/store-time'
import { errorMessage } from '../../../shared/api/client'
import { Button, Input } from '../../../shared/ui'
import { Pagination } from '../../../shared/ui/pagination'
import { PaymentMethodBadge, PaymentStatusBadge } from './invoice-badges'

interface InvoicesListTableProps {
  filters: InvoicesFilters
  setFilters: Dispatch<SetStateAction<InvoicesFilters>>
  searchKeyword: string
  setSearchKeyword: (val: string) => void
  displayList: Invoice[]
  data?: InvoicesResponse
  isLoading: boolean
  isError: boolean
  error: unknown
  isFetching: boolean
  onRefetch: () => void
  onSelectInvoice: (id: string) => void
  dateRangeInvalid: boolean
  shiftFilter?: ReactNode
}

export function InvoicesListTable({
  filters,
  setFilters,
  searchKeyword,
  setSearchKeyword,
  displayList,
  data,
  isLoading,
  isError,
  error,
  isFetching,
  onRefetch,
  onSelectInvoice,
  dateRangeInvalid,
  shiftFilter,
}: InvoicesListTableProps) {
  return (
    <section aria-label="Danh sách hóa đơn" className="space-y-4">
      <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_180px_160px]">
        <label className="block min-w-0 space-y-1.5 text-xs font-medium">
          <span>Tìm hóa đơn</span>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              maxLength={120}
              placeholder="Mã hóa đơn, bàn, nhân viên…"
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              className="bg-card pl-9 text-foreground"
            />
          </div>
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          <span>Trạng thái thanh toán</span>
          <select
            value={filters.paymentStatus ?? ''}
            onChange={(event) =>
              setFilters((previous) => ({
                ...previous,
                paymentStatus: event.target.value as PaymentStatus | '',
                page: 1,
              }))
            }
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="UNPAID">Chờ thanh toán</option>
            <option value="PAID">Đã thanh toán</option>
            <option value="PARTIALLY_REFUNDED">Hoàn một phần</option>
            <option value="REFUNDED">Hoàn toàn bộ</option>
            <option value="VOIDED">Đã hủy</option>
          </select>
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          <span>Phương thức</span>
          <select
            value={filters.paymentMethod ?? ''}
            onChange={(event) =>
              setFilters((previous) => ({
                ...previous,
                paymentMethod: event.target.value as PaymentMethod | '',
                page: 1,
              }))
            }
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
          >
            <option value="">Tất cả phương thức</option>
            <option value="CASH">Tiền mặt</option>
            <option value="TRANSFER">Chuyển khoản</option>
            <option value="CARD">Thẻ</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {(['createdFrom', 'createdTo'] as const).map((field) => (
          <label key={field} className="grid gap-1.5 text-xs font-medium">
            <span>
              {field === 'createdFrom' ? 'Từ ngày (giờ Việt Nam)' : 'Đến ngày (giờ Việt Nam)'}
            </span>
            <Input
              type="date"
              max="9999-12-31"
              className="bg-card text-foreground"
              value={filters[field] ? toStoreLocal(new Date(filters[field]!)).slice(0, 10) : ''}
              onChange={(event) => {
                const value = event.target.value
                if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return
                const start = value ? fromStoreLocal(`${value}T00:00`) : null
                const at = start
                  ? new Date(
                      start.getTime() + (field === 'createdTo' ? 86_400_000 - 1 : 0),
                    ).toISOString()
                  : undefined
                setFilters((previous) => ({ ...previous, [field]: at, page: 1 }))
              }}
            />
          </label>
        ))}
        {shiftFilter}
        {(searchKeyword ||
          filters.paymentStatus ||
          filters.paymentMethod ||
          filters.createdFrom ||
          filters.createdTo ||
          filters.shiftId) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10"
            onClick={() => {
              setSearchKeyword('')
              setFilters({
                page: 1,
                itemPerPage: filters.itemPerPage,
                paymentStatus: '',
                paymentMethod: '',
              })
            }}
          >
            <FilterX size={16} aria-hidden="true" />
            Xóa bộ lọc
          </Button>
        )}
      </div>
      {dateRangeInvalid && (
        <p role="alert" className="text-sm text-destructive">
          Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.
        </p>
      )}
      {isLoading && (
        <div
          role="status"
          className="flex items-center justify-center gap-2 border-y border-border py-16 text-sm text-muted-foreground"
        >
          <RefreshCw size={18} className="animate-spin" aria-hidden="true" />
          Đang tải danh sách hóa đơn…
        </div>
      )}
      {isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-destructive bg-destructive/5 p-4 text-sm text-destructive"
        >
          <span className="flex items-center gap-2">
            <AlertCircle size={18} aria-hidden="true" />
            {errorMessage(error)}
          </span>
          <Button variant="outline" size="sm" onClick={onRefetch} disabled={isFetching}>
            <RefreshCw size={16} aria-hidden="true" />
            Thử lại
          </Button>
        </div>
      )}
      {data && (
        <>
          <div className="overflow-x-auto border-y border-border" aria-busy={isFetching}>
            <table className="w-full min-w-[800px] border-collapse text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Mã hóa đơn</th>
                  <th className="px-4 py-3">Bàn / Đơn</th>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Thu ngân</th>
                  <th className="px-4 py-3">Phương thức</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Tổng tiền</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {!displayList.length && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                      Không tìm thấy hóa đơn nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                )}
                {displayList.map((invoice) => (
                  <tr
                    key={invoice.id}
                    tabIndex={0}
                    aria-label={`Chi tiết hóa đơn ${invoice.invoiceNumber}`}
                    className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
                    onClick={() => onSelectInvoice(invoice.id)}
                    onKeyDown={(event) => {
                      if (
                        event.target === event.currentTarget &&
                        (event.key === 'Enter' || event.key === ' ')
                      ) {
                        event.preventDefault()
                        onSelectInvoice(invoice.id)
                      }
                    }}
                  >
                  <td className="whitespace-nowrap px-4 py-4 font-mono text-xs font-semibold text-foreground">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="px-4 py-4 font-medium">
                      {(invoice.documentSnapshot
                        ? invoice.documentSnapshot.tableName
                        : invoice.orderSession?.table?.name) ?? 'Mang đi / Quầy'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-xs text-muted-foreground">
                      {formatStoreDateTime(invoice.createdAt)}
                    </td>
                    <td className="px-4 py-4 text-xs text-muted-foreground">
                      {invoice.documentSnapshot?.issuedByName ??
                        invoice.employee?.fullName ??
                        'Hệ thống'}
                    </td>
                    <td className="px-4 py-4">
                      <PaymentMethodBadge method={invoice.paymentMethod} />
                    </td>
                    <td className="px-4 py-4">
                      <PaymentStatusBadge status={invoice.paymentStatus} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right font-semibold tabular-nums">
                      {formatPrice(invoice.totalAmount)}
                    </td>
                    <td
                      className="px-4 py-4 text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Xem chi tiết & Thanh toán"
                        aria-label={`Xem chi tiết hóa đơn ${invoice.invoiceNumber}`}
                        onClick={() => onSelectInvoice(invoice.id)}
                      >
                        <Eye size={17} aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {displayList.length} / {data.totalItems} hóa đơn
            </span>
            <Pagination
              page={filters.page ?? 1}
              totalPages={data.totalPages}
              disabled={isFetching}
              onPage={(page) => setFilters((previous) => ({ ...previous, page }))}
            />
          </div>
        </>
      )}
    </section>
  )
}
