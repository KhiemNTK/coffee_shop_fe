import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import type { Session } from '../../auth/session'
import { RefundsPanel } from './refunds-panel'
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Coins,
  CreditCard,
  ExternalLink,
  QrCode,
  Receipt,
  RefreshCw,
} from 'lucide-react'
import {
  getInvoiceById,
  voidInvoice,
  updateInvoicePayment,
  createPaymentAttempt,
  getInvoicePaymentAttempts,
  reconcilePaymentAttempt,
  type PaymentProvider,
} from '../invoices.api'
import { formatPrice } from '../../menu/menu.api'
import { formatLineAmount } from '../../../shared/lib/format'
import { errorMessage } from '../../../shared/api/client'
import { Button, Dialog, Input, cn } from '../../../shared/ui'
import { AttemptStatusBadge, PaymentStatusBadge } from './invoice-badges'

interface InvoiceDetailDialogProps {
  invoiceId: string
  onClose: () => void
  onUpdated: () => void
}

export function InvoiceDetailDialog({
  invoiceId,
  onClose,
  onUpdated,
}: InvoiceDetailDialogProps) {
  const { employee, authorization } = useOutletContext<Session>()
  const can = (key: string) => authorization.permissionKeys.includes(key)
  const [activeTab, setActiveTab] = useState<'items' | 'gateway' | 'pay_manual'>('items')

  // Create payment attempt form state
  const [provider, setProvider] = useState<PaymentProvider>('VNPAY')
  const [manualMethod, setManualMethod] = useState<'CASH' | 'CARD'>('CASH')
  const [amountTendered, setAmountTendered] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false)

  // Fetch invoice detail
  const invoiceQuery = useQuery({
    queryKey: ['private', employee.id, 'invoice-detail', invoiceId],
    queryFn: ({ signal }) => getInvoiceById(invoiceId, signal),
  })

  // Fetch attempts
  const attemptsQuery = useQuery({
    queryKey: ['private', employee.id, 'invoice-attempts', invoiceId],
    enabled: can('/payment-attempts_read'),
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
        provider,
        locale: 'vn',
        closeSessionAfterPayment: true,
      }),
    onSuccess: () => {
      setActionError(null)
      void attemptsQuery.refetch()
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
    <Dialog open onClose={onClose} maxWidth="lg" label="Chi tiết hóa đơn">
      <div className="flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 pr-10 border-b border-border flex items-center justify-between bg-stone-50/50">
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

        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex flex-wrap border-b border-border px-5 bg-card">
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
          {inv?.paymentStatus === 'UNPAID' && (can('/invoices_update') || can('/payment-attempts_create') || can('/payment-attempts_read')) && (
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
          {invoiceQuery.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(invoiceQuery.error)}</p>}
          {attemptsQuery.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(attemptsQuery.error)}</p>}
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
              <div className="border border-border rounded-lg overflow-x-auto shadow-xs">
                <table className="w-full min-w-[320px] text-left text-xs border-collapse">
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
                          {formatPrice(it.priceAtTime)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-foreground">
                          {formatLineAmount(it.priceAtTime, it.quantity)}
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
                  disabled={!can('/payment-attempts_create') || inv.paymentStatus !== 'UNPAID'}
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
                      {attempt.status === 'PENDING' && can('/payment-reconciliation_manage') && (
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

          {inv && <RefundsPanel attempts={attemptsQuery.data?.list ?? []} onUpdated={() => {
            void invoiceQuery.refetch()
            onUpdated()
          }} />}

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
                  disabled={!can('/invoices_update')}
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
            {inv?.paymentStatus === 'UNPAID' && can('/invoices_update') && (
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
