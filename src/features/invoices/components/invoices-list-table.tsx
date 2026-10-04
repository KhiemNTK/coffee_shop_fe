import { AlertCircle, ArrowLeft, Eye, RefreshCw, Search } from 'lucide-react'
import {
  type InvoicesFilters,
  type InvoicesResponse,
  type Invoice,
  type PaymentMethod,
  type PaymentStatus,
} from '../invoices.api'
import { formatPrice } from '../../menu/menu.api'
import { errorMessage } from '../../../shared/api/client'
import { Button, Card, CardContent, Input } from '../../../shared/ui'
import { PaymentMethodBadge, PaymentStatusBadge } from './invoice-badges'

interface InvoicesListTableProps {
  filters: InvoicesFilters
  setFilters: React.Dispatch<React.SetStateAction<InvoicesFilters>>
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
}

const STATUS_FILTERS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'PAID', label: 'Đã thanh toán' },
  { value: 'UNPAID', label: 'Chờ thanh toán' },
  { value: 'VOIDED', label: 'Đã hủy' },
  { value: 'REFUNDED', label: 'Hoàn tiền' },
] as const

const METHOD_FILTERS = [
  { value: '', label: 'Tất cả PTTT' },
  { value: 'CASH', label: 'Tiền mặt' },
  { value: 'TRANSFER', label: 'Chuyển khoản' },
  { value: 'CARD', label: 'Thẻ' },
] as const

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
}: InvoicesListTableProps) {
  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                placeholder="Tìm mã hóa đơn, bàn, nhân viên…"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {STATUS_FILTERS.map((st) => (
                <Button
                  key={st.value}
                  type="button"
                  size="sm"
                  variant={filters.paymentStatus === st.value ? 'default' : 'outline'}
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      paymentStatus: st.value as PaymentStatus | '',
                      page: 1,
                    }))
                  }
                  className="rounded-full text-xs font-medium whitespace-nowrap"
                >
                  {st.label}
                </Button>
              ))}
            </div>

            {/* Method Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {METHOD_FILTERS.map((method) => (
                <Button
                  key={method.value}
                  type="button"
                  size="sm"
                  variant={filters.paymentMethod === method.value ? 'default' : 'outline'}
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      paymentMethod: method.value as PaymentMethod | '',
                      page: 1,
                    }))
                  }
                  className="rounded-full text-xs font-medium whitespace-nowrap"
                >
                  {method.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="border-border/80 shadow-xs overflow-hidden">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <RefreshCw className="h-6 w-6 animate-spin text-brand-700" />
            <p className="text-sm">Đang tải danh sách hóa đơn…</p>
          </div>
        )}

        {isError && (
          <div className="p-6 bg-destructive/10 text-destructive flex items-center justify-between m-4 rounded-xl">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{errorMessage(error)}</span>
            </div>
            <Button variant="outline" size="sm" onClick={onRefetch}>
              Thử lại
            </Button>
          </div>
        )}

        {data && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm border-collapse">
              <thead className="bg-stone-50 border-b border-border text-xs uppercase text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Mã Hóa đơn</th>
                  <th className="py-3.5 px-4">Bàn / Đơn</th>
                  <th className="py-3.5 px-4">Thời gian</th>
                  <th className="py-3.5 px-4">Thu ngân</th>
                  <th className="py-3.5 px-4">Phương thức</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4 text-right">Tổng tiền</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {displayList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      Không tìm thấy hóa đơn nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  displayList.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="hover:bg-stone-50/70 transition-colors group cursor-pointer"
                      onClick={() => onSelectInvoice(invoice.id)}
                    >
                      <td className="py-3.5 px-4 sm:px-6">
                        <code className="text-xs font-mono font-bold text-brand-900 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded">
                          {invoice.invoiceNumber}
                        </code>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-foreground">
                        {invoice.orderSession?.table?.name ?? 'Mang đi / Quầy'}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-muted-foreground">
                        {new Date(invoice.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        •{' '}
                        {new Date(invoice.createdAt).toLocaleDateString([], {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-muted-foreground">
                        {invoice.employee?.fullName ?? 'Hệ thống'}
                      </td>
                      <td className="py-3.5 px-4">
                        <PaymentMethodBadge method={invoice.paymentMethod} />
                      </td>
                      <td className="py-3.5 px-4">
                        <PaymentStatusBadge status={invoice.paymentStatus} />
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-brand-800 text-sm">
                        {formatPrice(String(invoice.totalAmount))}
                      </td>
                      <td
                        className="py-3.5 px-4 sm:px-6 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onSelectInvoice(invoice.id)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          title="Xem chi tiết & Thanh toán"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Trang {data.currentPage} / {data.totalPages} (Tổng {data.totalItems} hóa đơn)
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={filters.page! <= 1 || isFetching}
                onClick={() =>
                  setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) - 1 }))
                }
                className="h-8 gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Trước
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={filters.page! >= data.totalPages || isFetching}
                onClick={() =>
                  setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))
                }
                className="h-8 gap-1"
              >
                Sau
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
