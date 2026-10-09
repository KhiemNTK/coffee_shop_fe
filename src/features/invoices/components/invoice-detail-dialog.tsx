import { useRef, useState } from 'react'
import { OrderOptions } from '../../../shared/ui/order-options'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import type { Session } from '../../auth/session'
import { RefundsPanel } from './refunds-panel'
import { PaymentGatewayPanel } from './payment-gateway-panel'
import { PickupCodePanel } from '../../online-orders/components/pickup-panels'
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Coins,
  CreditCard,
  Printer,
  QrCode,
  Receipt,
  RefreshCw,
} from 'lucide-react'
import { printingApi } from '../../printing/printing.api'
import {
  getInvoiceById,
  voidInvoice,
  updateInvoicePayment,
  getInvoicePaymentAttempts,
  type UpdateInvoicePaymentPayload,
} from '../invoices.api'
import { formatPrice } from '../../menu/menu.api'
import { formatLineAmount } from '../../../shared/lib/format'
import { ApiError, errorMessage } from '../../../shared/api/client'
import { Button, Dialog, Input, cn } from '../../../shared/ui'
import { PaymentStatusBadge } from './invoice-badges'
import { isUnresolvedPayment } from '../payment-status'
import { moneySchema } from '../../menu/menu.api'
import { decimalAmount, minorAmount } from '../../../shared/lib/money'

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
  const [activeTab, setActiveTab] = useState<
    'items' | 'gateway' | 'pay_manual'
  >('items')

  const [manualMethod, setManualMethod] = useState<'CASH' | 'CARD'>('CASH')
  const [amountTendered, setAmountTendered] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false)
  const [submittedManual, setSubmittedManual] =
    useState<UpdateInvoicePaymentPayload | null>(null)
  const manualFlight = useRef(false)
  const voidFlight = useRef(false)
  const [refundLocked, setRefundLocked] = useState(false)
  const [gatewayLocked, setGatewayLocked] = useState(false)
  const [recoveryRequired, setRecoveryRequired] = useState(false)

  // In lại hóa đơn (Reprint receipt)
  const [reprintOpen, setReprintOpen] = useState(false)
  const [reprintReason, setReprintReason] = useState('Khách hàng yêu cầu in lại hóa đơn')
  const [reprintSuccess, setReprintSuccess] = useState<string | null>(null)

  const reprintMutation = useMutation({
    mutationFn: (reason: string) => printingApi.reprintReceipt(invoiceId, { reason }),
    onSuccess: (job) => {
      setReprintSuccess(`Đã tạo lệnh in lại hóa đơn #${job.id.slice(0, 8)} thành công.`)
      setReprintOpen(false)
    },
    onError: (err) => {
      setActionError(errorMessage(err))
    },
  })

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
  })

  // Mutations
  const updatePaymentMutation = useMutation({
    mutationFn: (payload: UpdateInvoicePaymentPayload) =>
      updateInvoicePayment(invoiceId, payload),
    onSuccess: () => {
      setActionError(null)
      setSubmittedManual(null)
      onUpdated()
      setActiveTab('items')
    },
    onError: (err) => {
      setActionError(errorMessage(err))
      if (
        err instanceof ApiError &&
        err.status >= 400 &&
        err.status < 500 &&
        err.status !== 408 &&
        err.status !== 429
      )
        setSubmittedManual(null)
    },
    onSettled: () => {
      manualFlight.current = false
      void invoiceQuery.refetch()
      if (can('/payment-attempts_read')) void attemptsQuery.refetch()
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
      setVoidConfirmOpen(false)
      setRecoveryRequired(true)
    },
    onSettled: () => { voidFlight.current = false },
  })

  const inv = invoiceQuery.data
  const unresolvedOnline =
    attemptsQuery.data?.list.some(
      (attempt) => isUnresolvedPayment(attempt.status),
    ) ?? false
  const paymentLocked =
    ((updatePaymentMutation.isPending || Boolean(submittedManual)) &&
      (!inv || inv.paymentStatus === 'UNPAID' || invoiceQuery.isError)) ||
    refundLocked || gatewayLocked || voidMutation.isPending
  const manualBlocked =
    invoiceQuery.isPending || invoiceQuery.isError || invoiceQuery.isFetching ||
    recoveryRequired || voidMutation.isPending || refundLocked || gatewayLocked ||
    unresolvedOnline ||
    (can('/payment-attempts_read') &&
      (attemptsQuery.isPending || attemptsQuery.isError || attemptsQuery.isFetching))
  const parsedTendered = moneySchema.safeParse(amountTendered.trim())
  const tenderedMinor = parsedTendered.success ? minorAmount(parsedTendered.data) : null
  const totalMinor = inv ? minorAmount(inv.totalAmount) : null
  const tenderedEnough = tenderedMinor !== null && totalMinor !== null && tenderedMinor >= totalMinor

  async function refreshStatus() {
    const result = await invoiceQuery.refetch()
    if (result.isError) return
    if (submittedManual && result.data?.paymentStatus !== 'UNPAID') {
      setSubmittedManual(null)
      setActiveTab('items')
    }
    if (can('/payment-attempts_read')) {
      const attempts = await attemptsQuery.refetch()
      if (attempts.isError) return
    }
    setRecoveryRequired(false)
    setActionError(null)
  }
  function confirmManualPayment() {
    if (
      manualFlight.current ||
      manualBlocked ||
      inv?.paymentStatus !== 'UNPAID' ||
      !can('/invoices_update')
    )
      return
    if (!submittedManual && manualMethod === 'CASH' && !tenderedEnough) {
      setActionError('Số tiền khách đưa phải hợp lệ và đủ thanh toán.')
      return
    }
    const payload: UpdateInvoicePaymentPayload = submittedManual ?? {
      paymentStatus: 'PAID',
      paymentMethod: manualMethod,
      amountTendered: manualMethod === 'CASH' ? amountTendered.trim() : undefined,
      closeSessionAfterPayment: true,
    }
    manualFlight.current = true
    setSubmittedManual(payload)
    updatePaymentMutation.mutate(payload)
  }

  return (
    <Dialog
      open
      onClose={() => {
        if (
          !manualFlight.current &&
          !voidFlight.current && !paymentLocked
        )
          onClose()
      }}
      showCloseButton={false}
      maxWidth="lg"
      label="Chi tiết hóa đơn"
    >
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
                Bàn:{' '}
                <strong>{inv?.orderSession?.table?.name ?? 'Mang đi'}</strong> •
                Thu ngân: {inv?.employee?.fullName ?? 'Hệ thống'}
              </p>
            </div>
          </div>
        </div>

        {inv?.paymentStatus === 'PAID' &&
          inv.orderSession &&
          !inv.orderSession.tableId && (
            <PickupCodePanel invoiceId={invoiceId} />
          )}

        {/* Modal Navigation Tabs */}
        <div className="flex flex-wrap border-b border-border px-5 bg-card">
          <button
            type="button"
            disabled={paymentLocked}
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
          {inv?.paymentStatus === 'UNPAID' &&
            (can('/invoices_update') || can('/payment-attempts_read')) && (
              <>
                {can('/payment-attempts_read') && (
                  <button
                    type="button"
                    disabled={paymentLocked}
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
                )}
                {can('/invoices_update') && (
                  <button
                    type="button"
                    disabled={paymentLocked}
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
                )}
              </>
            )}
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          <Button type="button" variant="outline" size="sm"
            disabled={invoiceQuery.isFetching || attemptsQuery.isFetching || updatePaymentMutation.isPending || voidMutation.isPending || refundLocked || gatewayLocked}
            onClick={() => void refreshStatus()}>
            <RefreshCw size={16} aria-hidden="true" />Kiểm tra trạng thái hóa đơn
          </Button>
          {invoiceQuery.isError && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(invoiceQuery.error)}
            </p>
          )}
          {attemptsQuery.isError && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(attemptsQuery.error)}
            </p>
          )}
          {actionError && (
            <div
              role="alert"
              className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive flex items-center gap-2"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {reprintSuccess && (
            <div
              role="status"
              className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{reprintSuccess}</span>
              </div>
              <button
                type="button"
                onClick={() => setReprintSuccess(null)}
                className="text-[11px] text-emerald-700 hover:underline cursor-pointer"
              >
                Đóng
              </button>
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
                          <OrderOptions options={it.selectedOptions} />
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

          {inv && activeTab === 'gateway' && (
            <PaymentGatewayPanel invoiceId={invoiceId} onLockChange={setGatewayLocked} />
          )}

          {inv && (
            <RefundsPanel
              attempts={attemptsQuery.data?.list ?? []}
              invoiceStatus={inv.paymentStatus}
              onLockChange={setRefundLocked}
              onUpdated={() => {
                void invoiceQuery.refetch()
                onUpdated()
              }}
            />
          )}

          {/* Tab 3: Pay manual (Cash or Card) */}
          {inv?.paymentStatus === 'UNPAID' && activeTab === 'pay_manual' && (
            <div className="space-y-4 max-w-md mx-auto py-2">
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
                <h4 className="text-sm font-bold text-foreground">
                  Thu tiền trực tiếp tại quầy
                </h4>
                {manualBlocked && (
                  <p role="status" className="text-sm">
                    Cần kiểm tra hoặc đối soát phiên online trước khi thu tiền
                    trực tiếp.
                  </p>
                )}
                {submittedManual && !updatePaymentMutation.isPending && (
                  <p role="status" className="text-sm">
                    Chưa xác nhận được lần thu tiền. Kiểm tra lại cùng số tiền
                    và phương thức.
                  </p>
                )}

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Hình thức thu
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={manualMethod === 'CASH' ? 'default' : 'outline'}
                      disabled={paymentLocked || manualBlocked}
                      onClick={() => setManualMethod('CASH')}
                      className="text-xs gap-1.5"
                    >
                      <Coins className="h-3.5 w-3.5" /> Tiền mặt
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={manualMethod === 'CARD' ? 'default' : 'outline'}
                      disabled={paymentLocked || manualBlocked}
                      onClick={() => setManualMethod('CARD')}
                      className="text-xs gap-1.5"
                    >
                      <CreditCard className="h-3.5 w-3.5" /> Quẹt thẻ POS
                    </Button>
                  </div>
                </div>

                {manualMethod === 'CASH' && (
                  <div>
                    <label
                      htmlFor="invoice-amount-tendered"
                      className="text-xs font-semibold text-muted-foreground block mb-1"
                    >
                      Số tiền khách đưa (VND)
                    </label>
                    <Input
                      id="invoice-amount-tendered"
                      disabled={paymentLocked || manualBlocked}
                      type="number"
                      min={inv.totalAmount}
                      step="0.01"
                      placeholder={`VD: ${inv.totalAmount}`}
                      value={amountTendered}
                      onChange={(e) => setAmountTendered(e.target.value)}
                    />
                    {tenderedEnough && (
                        <p className="text-xs text-emerald-800 font-semibold mt-1">
                          Tiền thối lại:{' '}
                          {formatPrice(decimalAmount(tenderedMinor - totalMinor))}
                        </p>
                      )}
                  </div>
                )}

                <Button
                  type="button"
                  className="w-full font-bold mt-2"
                  onClick={confirmManualPayment}
                  isLoading={updatePaymentMutation.isPending}
                  disabled={!can('/invoices_update') || manualBlocked || (!submittedManual && manualMethod === 'CASH' && !tenderedEnough)}
                >
                  {submittedManual
                    ? 'Kiểm tra lại lần thu tiền'
                    : `Xác nhận đã thanh toán (${formatPrice(String(inv.totalAmount))})`}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-stone-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {inv?.paymentStatus === 'UNPAID' && can('/invoices_update') && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={paymentLocked || manualBlocked}
                onClick={() => setVoidConfirmOpen(true)}
                className="gap-1.5 text-xs font-semibold cursor-pointer"
              >
                <Ban className="h-3.5 w-3.5" /> Hủy hóa đơn
              </Button>
            )}

            {(inv?.paymentStatus === 'PAID' || inv?.paymentStatus === 'PARTIALLY_REFUNDED') &&
              can('/receipts_reprint') && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActionError(null)
                    setReprintSuccess(null)
                    setReprintOpen(true)
                  }}
                  className="gap-1.5 text-xs font-semibold cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5 text-primary" /> In lại hóa đơn
                </Button>
              )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={paymentLocked}
            onClick={onClose}
          >
            Đóng
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog to void invoice */}
      <Dialog
        open={voidConfirmOpen}
        onClose={() => { if (!voidFlight.current) setVoidConfirmOpen(false) }}
        showCloseButton={!voidMutation.isPending}
        maxWidth="sm"
      >
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-bold text-destructive">
            Xác nhận hủy hóa đơn?
          </h3>
          <p className="text-sm text-muted-foreground">
            Hóa đơn #{inv?.invoiceNumber} chưa được thanh toán sẽ chuyển sang
            trạng thái ĐÃ HỦY. Hành động này không thể hoàn tác.
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={voidMutation.isPending}
              onClick={() => setVoidConfirmOpen(false)}
            >
              Quay lại
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={manualBlocked || inv?.paymentStatus !== 'UNPAID'}
              onClick={() => {
                if (voidFlight.current || manualFlight.current || manualBlocked || inv?.paymentStatus !== 'UNPAID') return
                voidFlight.current = true
                voidMutation.mutate()
              }}
              isLoading={voidMutation.isPending}
            >
              Xác nhận hủy
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Confirmation Dialog to reprint receipt */}
      <Dialog
        open={reprintOpen}
        onClose={() => { if (!reprintMutation.isPending) setReprintOpen(false) }}
        showCloseButton={!reprintMutation.isPending}
        maxWidth="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (reprintReason.trim().length >= 3) {
              reprintMutation.mutate(reprintReason.trim())
            }
          }}
          className="p-6 space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <Printer className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold text-foreground">In lại hóa đơn</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Lệnh in lại phiếu thu cho hóa đơn #{inv?.invoiceNumber} sẽ được gửi vào hàng đợi của thiết bị in mặc định.
          </p>
          <div className="space-y-1.5">
            <label htmlFor="reprintReason" className="text-xs font-semibold text-foreground">
              Lý do in lại <span className="text-destructive">*</span>
            </label>
            <Input
              id="reprintReason"
              type="text"
              required
              minLength={3}
              maxLength={255}
              value={reprintReason}
              onChange={(e) => setReprintReason(e.target.value)}
              placeholder="VD: Khách làm mất bill, yêu cầu in lại"
              disabled={reprintMutation.isPending}
            />
          </div>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={reprintMutation.isPending}
              onClick={() => setReprintOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={reprintReason.trim().length < 3 || reprintMutation.isPending}
              isLoading={reprintMutation.isPending}
              className="gap-1.5 font-bold cursor-pointer"
            >
              <Printer className="h-4 w-4" /> Xác nhận in lại
            </Button>
          </div>
        </form>
      </Dialog>
    </Dialog>
  )
}
