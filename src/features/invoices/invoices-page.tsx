import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  ExternalLink,
  Eye,
  FileText,
  QrCode,
  Receipt,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import {
  getInvoices,
  getInvoiceById,
  voidInvoice,
  updateInvoicePayment,
  createPaymentAttempt,
  getInvoicePaymentAttempts,
  reconcilePaymentAttempt,
  type InvoicesFilters,
  type PaymentMethod,
  type PaymentProvider,
  type PaymentStatus,
} from './invoices.api'
import { formatPrice } from '../menu/menu.api'
import { errorMessage } from '../../shared/api/client'
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  Input,
  cn,
} from '../../shared/ui'

export default function InvoicesPage() {
  const queryClient = useQueryClient()

  // Filters state
  const [filters, setFilters] = useState<InvoicesFilters>({
    page: 1,
    itemPerPage: 15,
    paymentStatus: '',
    paymentMethod: '',
  })
  const [searchKeyword, setSearchKeyword] = useState('')

  // Detail Modal state
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)

  // Query Invoices
  const invoicesQuery = useQuery({
    queryKey: ['invoices', filters],
    queryFn: ({ signal }) => getInvoices(filters, signal),
  })

  // Quick statistics calculation from current page/data
  const invoices = invoicesQuery.data?.list ?? []
  const totalPaidAmount = invoices
    .filter((inv) => inv.paymentStatus === 'PAID')
    .reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0)
  const unpaidCount = invoices.filter((inv) => inv.paymentStatus === 'UNPAID').length
  const voidedCount = invoices.filter((inv) => inv.paymentStatus === 'VOIDED').length

  // Filtered by client search keyword if provided
  const displayList = invoices.filter((inv) => {
    if (!searchKeyword.trim()) return true
    const kw = searchKeyword.trim().toLowerCase()
    return (
      inv.invoiceNumber.toLowerCase().includes(kw) ||
      inv.orderSession?.table?.name.toLowerCase().includes(kw) ||
      inv.employee?.fullName.toLowerCase().includes(kw)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-brand-800 text-white flex items-center justify-center shadow-xs">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Quản lý Hóa đơn & Thanh toán
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Theo dõi lịch sử hóa đơn bán hàng, cổng thanh toán VNPay, MoMo và đối soát giao dịch
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void invoicesQuery.refetch()}
            disabled={invoicesQuery.isFetching}
            className="gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', invoicesQuery.isFetching && 'animate-spin')} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/80 shadow-xs">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Doanh thu trang này
              </p>
              <h3 className="text-xl sm:text-2xl font-bold text-brand-900 mt-1">
                {formatPrice(String(totalPaidAmount))}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center">
              <Coins className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-xs">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Tổng hóa đơn
              </p>
              <h3 className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                {invoicesQuery.data?.totalItems ?? 0}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-xs">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Chưa thanh toán
              </p>
              <h3 className="text-xl sm:text-2xl font-bold text-amber-700 mt-1">
                {unpaidCount}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-xs">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Đã hủy / Hoàn trả
              </p>
              <h3 className="text-xl sm:text-2xl font-bold text-destructive mt-1">
                {voidedCount}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
              <Ban className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

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
              {(
                [
                  { value: '', label: 'Tất cả trạng thái' },
                  { value: 'PAID', label: 'Đã thanh toán' },
                  { value: 'UNPAID', label: 'Chờ thanh toán' },
                  { value: 'VOIDED', label: 'Đã hủy' },
                  { value: 'REFUNDED', label: 'Hoàn tiền' },
                ] as const
              ).map((st) => (
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
              {(
                [
                  { value: '', label: 'Tất cả PTTT' },
                  { value: 'CASH', label: 'Tiền mặt' },
                  { value: 'TRANSFER', label: 'Chuyển khoản' },
                  { value: 'CARD', label: 'Thẻ' },
                ] as const
              ).map((method) => (
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
        {invoicesQuery.isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <RefreshCw className="h-6 w-6 animate-spin text-brand-700" />
            <p className="text-sm">Đang tải danh sách hóa đơn…</p>
          </div>
        )}

        {invoicesQuery.isError && (
          <div className="p-6 bg-destructive/10 text-destructive flex items-center justify-between m-4 rounded-xl">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{errorMessage(invoicesQuery.error)}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void invoicesQuery.refetch()}
            >
              Thử lại
            </Button>
          </div>
        )}

        {invoicesQuery.data && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
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
                      onClick={() => setSelectedInvoiceId(invoice.id)}
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
                          onClick={() => setSelectedInvoiceId(invoice.id)}
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
        {invoicesQuery.data && invoicesQuery.data.totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Trang {invoicesQuery.data.currentPage} / {invoicesQuery.data.totalPages} (Tổng{' '}
              {invoicesQuery.data.totalItems} hóa đơn)
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={filters.page! <= 1 || invoicesQuery.isFetching}
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
                disabled={
                  filters.page! >= invoicesQuery.data.totalPages ||
                  invoicesQuery.isFetching
                }
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

      {/* Invoice Detail & Payment Gateway Modal */}
      {selectedInvoiceId && (
        <InvoiceDetailDialog
          invoiceId={selectedInvoiceId}
          onClose={() => setSelectedInvoiceId(null)}
          onUpdated={() => {
            void queryClient.invalidateQueries({ queryKey: ['invoices'] })
          }}
        />
      )}
    </div>
  )
}

// ============================================================================
// INVOICE DETAIL & PAYMENT GATEWAY DIALOG
// ============================================================================

function InvoiceDetailDialog({
  invoiceId,
  onClose,
  onUpdated,
}: {
  invoiceId: string
  onClose: () => void
  onUpdated: () => void
}) {
  const [activeTab, setActiveTab] = useState<'items' | 'gateway' | 'pay_manual'>('items')

  // Create payment attempt form state
  const [provider, setProvider] = useState<PaymentProvider>('VNPAY')
  const [manualMethod, setManualMethod] = useState<'CASH' | 'CARD'>('CASH')
  const [amountTendered, setAmountTendered] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false)

  // Fetch invoice detail
  const invoiceQuery = useQuery({
    queryKey: ['invoice-detail', invoiceId],
    queryFn: ({ signal }) => getInvoiceById(invoiceId, signal),
  })

  // Fetch attempts
  const attemptsQuery = useQuery({
    queryKey: ['invoice-attempts', invoiceId],
    queryFn: ({ signal }) => getInvoicePaymentAttempts(invoiceId, signal),
    refetchInterval: (query) => {
      // Auto-poll if there is a pending attempt
      const hasPending = query.state.data?.list.some((a) => a.status === 'PENDING')
      return hasPending ? 4000 : false
    },
  })

  // Mutations
  const createAttemptMutation = useMutation({
    mutationFn: () =>
      createPaymentAttempt(invoiceId, {
        idempotencyKey: crypto.randomUUID(),
        provider,
        locale: 'vn',
        closeSessionAfterPayment: true,
      }),
    onSuccess: (attempt) => {
      setActionError(null)
      void attemptsQuery.refetch()
      if (attempt.paymentUrl) {
        window.open(attempt.paymentUrl, '_blank', 'noopener,noreferrer')
      }
    },
    onError: (err) => {
      setActionError(errorMessage(err))
    },
  })

  const reconcileMutation = useMutation({
    mutationFn: (attemptId: string) => reconcilePaymentAttempt(attemptId),
    onSuccess: () => {
      setActionError(null)
      void attemptsQuery.refetch()
      void invoiceQuery.refetch()
      onUpdated()
    },
    onError: (err) => {
      setActionError(errorMessage(err))
    },
  })

  const updatePaymentMutation = useMutation({
    mutationFn: () =>
      updateInvoicePayment(invoiceId, {
        paymentStatus: 'PAID',
        paymentMethod: manualMethod,
        amountTendered: amountTendered.trim() || undefined,
        closeSessionAfterPayment: true,
      }),
    onSuccess: () => {
      setActionError(null)
      void invoiceQuery.refetch()
      onUpdated()
      setActiveTab('items')
    },
    onError: (err) => {
      setActionError(errorMessage(err))
    },
  })

  const voidMutation = useMutation({
    mutationFn: () => voidInvoice(invoiceId),
    onSuccess: () => {
      setVoidConfirmOpen(false)
      void invoiceQuery.refetch()
      onUpdated()
    },
    onError: (err) => {
      setActionError(errorMessage(err))
    },
  })

  const inv = invoiceQuery.data

  return (
    <Dialog open onClose={onClose} maxWidth="lg">
      <div className="flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-800 text-white flex items-center justify-center shadow-xs">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-foreground">
                  Hóa đơn #{inv?.invoiceNumber ?? '…'}
                </h3>
                {inv && <PaymentStatusBadge status={inv.paymentStatus} />}
              </div>
              <p className="text-xs text-muted-foreground">
                Bàn: <strong>{inv?.orderSession?.table?.name ?? 'Mang đi'}</strong> • Thu ngân:{' '}
                {inv?.employee?.fullName ?? 'Hệ thống'}
              </p>
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-border px-5 bg-card">
          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={cn(
              'px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors',
              activeTab === 'items'
                ? 'border-brand-800 text-brand-900'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            Chi tiết món ({inv?.orderItems.length ?? 0})
          </button>
          {inv?.paymentStatus === 'UNPAID' && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('gateway')}
                className={cn(
                  'px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5',
                  activeTab === 'gateway'
                    ? 'border-brand-800 text-brand-900'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <QrCode className="h-3.5 w-3.5" />
                Cổng thanh toán (VNPay / MoMo)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pay_manual')}
                className={cn(
                  'px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5',
                  activeTab === 'pay_manual'
                    ? 'border-brand-800 text-brand-900'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Xác nhận tiền mặt / Thẻ
              </button>
            </>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {actionError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {invoiceQuery.isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-brand-700" />
              <p className="text-xs">Đang tải thông tin chi tiết hóa đơn…</p>
            </div>
          )}

          {inv && activeTab === 'items' && (
            <div className="space-y-6">
              {/* Order items list */}
              <div className="border border-border rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-stone-50 border-b border-border text-muted-foreground font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Tên món</th>
                      <th className="py-2.5 px-3 text-center">SL</th>
                      <th className="py-2.5 px-3 text-right">Đơn giá</th>
                      <th className="py-2.5 px-3 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {inv.orderItems.map((it) => (
                      <tr key={it.id}>
                        <td className="py-2.5 px-3 font-semibold text-foreground">
                          {it.menuItem?.name ?? 'Món'}
                          {it.note && (
                            <p className="text-[11px] text-muted-foreground font-normal italic">
                              Ghi chú: {it.note}
                            </p>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">
                          {it.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-right text-muted-foreground">
                          {formatPrice(String(it.price))}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-foreground">
                          {formatPrice(String(it.subTotal))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Breakdown */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Tiền hàng (Tạm tính):</span>
                  <span>{formatPrice(String(inv.subTotal))}</span>
                </div>
                {Number(inv.discountAmount) > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Giảm giá khuyến mãi:</span>
                    <span>-{formatPrice(String(inv.discountAmount))}</span>
                  </div>
                )}
                {Number(inv.taxAmount) > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Thuế VAT ({inv.taxRate}%):</span>
                    <span>+{formatPrice(String(inv.taxAmount))}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-brand-900 pt-2 border-t border-stone-200">
                  <span>Tổng thực thu:</span>
                  <span>{formatPrice(String(inv.totalAmount))}</span>
                </div>
                {inv.amountTendered && (
                  <div className="flex justify-between text-muted-foreground pt-1">
                    <span>Tiền khách đưa:</span>
                    <span>{formatPrice(String(inv.amountTendered))}</span>
                  </div>
                )}
                {inv.changeAmount && Number(inv.changeAmount) > 0 && (
                  <div className="flex justify-between text-emerald-800 font-semibold">
                    <span>Tiền thối lại:</span>
                    <span>{formatPrice(String(inv.changeAmount))}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Online Payment Gateway (VNPay / MoMo) */}
          {inv && activeTab === 'gateway' && (
            <div className="space-y-6">
              {/* Form to create attempt */}
              <div className="p-4 border border-brand-200 bg-brand-50/50 rounded-xl space-y-3">
                <h4 className="text-sm font-bold text-brand-900">
                  Tạo phiên thanh toán trực tuyến
                </h4>
                <p className="text-xs text-muted-foreground">
                  Số tiền thanh toán:{' '}
                  <strong className="text-brand-800 text-sm">
                    {formatPrice(String(inv.totalAmount))}
                  </strong>
                </p>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setProvider('VNPAY')}
                    className={cn(
                      'p-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all',
                      provider === 'VNPAY'
                        ? 'border-brand-700 bg-white text-brand-900 shadow-xs ring-1 ring-brand-700'
                        : 'border-border bg-card text-muted-foreground hover:bg-stone-50',
                    )}
                  >
                    <CreditCard className="h-4 w-4 text-[#0066cc]" />
                    Cổng VNPay (QR / Thẻ ATM)
                  </button>

                  <button
                    type="button"
                    onClick={() => setProvider('MOMO')}
                    className={cn(
                      'p-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all',
                      provider === 'MOMO'
                        ? 'border-brand-700 bg-white text-brand-900 shadow-xs ring-1 ring-brand-700'
                        : 'border-border bg-card text-muted-foreground hover:bg-stone-50',
                    )}
                  >
                    <QrCode className="h-4 w-4 text-[#d82d8b]" />
                    Ví MoMo (QR Code)
                  </button>
                </div>

                <Button
                  type="button"
                  className="w-full mt-2 font-bold"
                  onClick={() => createAttemptMutation.mutate()}
                  isLoading={createAttemptMutation.isPending}
                >
                  Tạo mã thanh toán {provider} & Mở cổng
                </Button>
              </div>

              {/* History of attempts */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Lịch sử các phiên thanh toán ({attemptsQuery.data?.list.length ?? 0})
                </h4>

                {attemptsQuery.isLoading && (
                  <p className="text-xs text-muted-foreground animate-pulse">
                    Đang tải danh sách phiên…
                  </p>
                )}

                {attemptsQuery.data?.list.map((attempt) => (
                  <div
                    key={attempt.id}
                    className="p-3.5 border border-border rounded-xl bg-stone-50 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-brand-900">{attempt.provider}</strong>
                        <span className="font-mono text-muted-foreground">
                          {attempt.merchantReference}
                        </span>
                        <AttemptStatusBadge status={attempt.status} />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Tạo lúc:{' '}
                        {new Date(attempt.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        • Hết hạn:{' '}
                        {new Date(attempt.expiresAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {attempt.paymentUrl && attempt.status === 'PENDING' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            window.open(attempt.paymentUrl!, '_blank', 'noopener,noreferrer')
                          }
                          className="h-7 text-xs gap-1"
                        >
                          <ExternalLink className="h-3 w-3" /> Mở thanh toán
                        </Button>
                      )}
                      {attempt.status === 'PENDING' && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => reconcileMutation.mutate(attempt.id)}
                          isLoading={
                            reconcileMutation.isPending &&
                            reconcileMutation.variables === attempt.id
                          }
                          className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
                        >
                          <CheckCircle2 className="h-3 w-3" /> Đối soát kết quả
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Pay manual (Cash or Card) */}
          {inv && activeTab === 'pay_manual' && (
            <div className="space-y-4 max-w-md mx-auto py-2">
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
                <h4 className="text-sm font-bold text-foreground">
                  Thu tiền trực tiếp tại quầy
                </h4>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Hình thức thu
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={manualMethod === 'CASH' ? 'default' : 'outline'}
                      onClick={() => setManualMethod('CASH')}
                      className="text-xs gap-1.5"
                    >
                      <Coins className="h-3.5 w-3.5" /> Tiền mặt
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={manualMethod === 'CARD' ? 'default' : 'outline'}
                      onClick={() => setManualMethod('CARD')}
                      className="text-xs gap-1.5"
                    >
                      <CreditCard className="h-3.5 w-3.5" /> Quẹt thẻ POS
                    </Button>
                  </div>
                </div>

                {manualMethod === 'CASH' && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">
                      Số tiền khách đưa (VND)
                    </label>
                    <Input
                      type="number"
                      placeholder={`VD: ${inv.totalAmount}`}
                      value={amountTendered}
                      onChange={(e) => setAmountTendered(e.target.value)}
                    />
                    {amountTendered && Number(amountTendered) >= Number(inv.totalAmount) && (
                      <p className="text-xs text-emerald-800 font-semibold mt-1">
                        Tiền thối lại:{' '}
                        {formatPrice(String(Number(amountTendered) - Number(inv.totalAmount)))}
                      </p>
                    )}
                  </div>
                )}

                <Button
                  type="button"
                  className="w-full font-bold mt-2"
                  onClick={() => updatePaymentMutation.mutate()}
                  isLoading={updatePaymentMutation.isPending}
                >
                  Xác nhận đã thanh toán ({formatPrice(String(inv.totalAmount))})
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-stone-50/50 flex items-center justify-between">
          <div>
            {inv?.paymentStatus === 'UNPAID' && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setVoidConfirmOpen(true)}
                className="gap-1.5 text-xs font-semibold"
              >
                <Ban className="h-3.5 w-3.5" /> Hủy hóa đơn
              </Button>
            )}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog to void invoice */}
      <Dialog open={voidConfirmOpen} onClose={() => setVoidConfirmOpen(false)} maxWidth="sm">
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-bold text-destructive">Xác nhận hủy hóa đơn?</h3>
          <p className="text-sm text-muted-foreground">
            Hóa đơn #{inv?.invoiceNumber} chưa được thanh toán sẽ chuyển sang trạng thái ĐÃ HỦY. Hành động này không thể hoàn tác.
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setVoidConfirmOpen(false)}
            >
              Quay lại
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => voidMutation.mutate()}
              isLoading={voidMutation.isPending}
            >
              Xác nhận hủy
            </Button>
          </div>
        </div>
      </Dialog>
    </Dialog>
  )
}

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  if (status === 'PAID') {
    return <Badge variant="success">Đã thanh toán</Badge>
  }
  if (status === 'UNPAID') {
    return <Badge variant="warning">Chưa thanh toán</Badge>
  }
  if (status === 'VOIDED') {
    return <Badge variant="destructive">Đã hủy</Badge>
  }
  if (status === 'REFUNDED' || status === 'PARTIALLY_REFUNDED') {
    return (
      <Badge variant="secondary" className="bg-purple-50 text-purple-800 border-purple-200">
        Hoàn trả
      </Badge>
    )
  }
  return <Badge variant="outline">{status}</Badge>
}

function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  if (method === 'CASH') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-700 bg-stone-100 px-2 py-0.5 rounded">
        <Coins className="h-3 w-3 text-amber-700" /> Tiền mặt
      </span>
    )
  }
  if (method === 'TRANSFER') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
        <QrCode className="h-3 w-3 text-sky-600" /> Chuyển khoản
      </span>
    )
  }
  if (method === 'CARD') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
        <CreditCard className="h-3 w-3 text-indigo-600" /> Thẻ
      </span>
    )
  }
  return <span className="text-xs text-muted-foreground">{method}</span>
}

function AttemptStatusBadge({ status }: { status: string }) {
  if (status === 'SUCCEEDED') {
    return <Badge variant="success">Thành công</Badge>
  }
  if (status === 'PENDING') {
    return <Badge variant="warning">Chờ quét mã</Badge>
  }
  if (status === 'FAILED') {
    return <Badge variant="destructive">Thất bại</Badge>
  }
  if (status === 'EXPIRED') {
    return <Badge variant="secondary">Hết hạn</Badge>
  }
  return <Badge variant="outline">{status}</Badge>
}
