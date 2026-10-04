import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  DollarSign,
  ExternalLink,
  QrCode,
  RefreshCw,
  Smartphone,
} from 'lucide-react'
import { errorMessage } from '../../shared/api/client'
import { formatPrice } from '../menu/menu.api'
import { checkoutInvoice, type Invoice } from './pos.api'
import {
  createUnpaidInvoice,
  createPaymentAttempt,
  getInvoiceById,
  getInvoices,
  getPaymentAttempt,
  reconcilePaymentAttempt,
  type PaymentAttempt,
  type PaymentProvider,
} from '../invoices/invoices.api'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../shared/ui/dialog'
import { Button } from '../../shared/ui/button'
import { Input } from '../../shared/ui/input'
import { Badge } from '../../shared/ui/badge'
import { cn } from '../../shared/ui/utils'
import { PaymentQr } from '../../shared/ui/payment-qr'

export function CheckoutModal({
  sessionId,
  totalAmount,
  onClose,
  onCompleted,
}: {
  sessionId: string
  totalAmount: string
  onClose: () => void
  onCompleted: (invoice: Invoice) => void
}) {
  const numericTotal = Number(totalAmount) || 0
  const [method, setMethod] = useState<'CASH' | 'CARD' | 'DIGITAL'>('CASH')
  const [tendered, setTendered] = useState(totalAmount)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invoice, setInvoice] = useState<Invoice | null>(null)

  // Digital payments state (MoMo & VNPay)
  const [digitalProvider, setDigitalProvider] = useState<PaymentProvider>('MOMO')
  const [digitalAttempt, setDigitalAttempt] = useState<PaymentAttempt | null>(null)
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null)
  const [isReconciling, setIsReconciling] = useState(false)
  const completed = useRef(false)
  const invoiceQuery = useQuery({
    queryKey: ['private', 'checkout', sessionId, activeInvoiceId],
    queryFn: ({ signal }) => getInvoiceById(activeInvoiceId!, signal),
    enabled: Boolean(activeInvoiceId) && !invoice,
    staleTime: 0,
    refetchInterval: (query) => {
      const status = query.state.data?.paymentStatus
      if (status && status !== 'UNPAID') return false
      if (digitalAttempt && Date.now() > Date.parse(digitalAttempt.expiresAt) + 30_000) return false
      return 3000
    },
  })
  const attemptQuery = useQuery({
    queryKey: ['private', 'payment-attempt', digitalAttempt?.id],
    queryFn: ({ signal }) => getPaymentAttempt(digitalAttempt!.id, signal),
    enabled: Boolean(digitalAttempt) && !invoice,
    refetchInterval: (query) => query.state.data?.status === 'PENDING' ? 4000 : false,
    staleTime: 0,
  })
  const currentAttempt = attemptQuery.data ?? digitalAttempt
  const pollError = invoiceQuery.error ?? attemptQuery.error

  const numericTendered = Number(tendered) || 0
  const change = Math.max(0, numericTendered - numericTotal)

  const quickDenominations = [
    numericTotal,
    Math.ceil(numericTotal / 50000) * 50000,
    Math.ceil(numericTotal / 100000) * 100000,
    500000,
  ].filter((val, idx, arr) => val >= numericTotal && arr.indexOf(val) === idx)

  useEffect(() => {
    const paid = invoiceQuery.data
    if (paid?.paymentStatus === 'PAID' && !completed.current) {
      completed.current = true
      setInvoice(paid)
      onCompleted(paid)
    }
  }, [invoiceQuery.data, onCompleted])

  // Handle direct cash or card checkout
  async function handleDirectCheckout(payMethod: 'CASH' | 'CARD') {
    if (payMethod === 'CASH' && numericTendered < numericTotal) {
      setError('Tiền khách đưa không đủ thanh toán')
      return
    }
    setError(null)
    setPending(true)
    try {
      const result = await checkoutInvoice({
        orderSessionId: sessionId,
        paymentMethod: payMethod,
        amountTendered: payMethod === 'CASH' ? tendered.trim() : totalAmount,
        closeSessionAfterPayment: true,
      })
      setInvoice(result)
      completed.current = true
      onCompleted(result)
    } catch (err) {
      setError(errorMessage(err))
      setPending(false)
    }
  }

  // Handle initiating digital payment (MoMo / VNPay)
  async function handleStartDigitalPayment() {
    setError(null)
    setPending(true)
    try {
      const existing = activeInvoiceId ? null : await getInvoices({
        orderSessionId: sessionId, paymentStatus: 'UNPAID', itemPerPage: 1,
      })
      const unpaidInv = activeInvoiceId
        ? await getInvoiceById(activeInvoiceId)
        : existing?.list[0] ?? await createUnpaidInvoice(sessionId)
      if (unpaidInv.paymentStatus !== 'UNPAID') {
        await invoiceQuery.refetch()
        return
      }
      setActiveInvoiceId(unpaidInv.id)

      // 2. Create payment attempt
      const attempt = await createPaymentAttempt(unpaidInv.id, {
        provider: digitalProvider,
        closeSessionAfterPayment: true,
      })
      setDigitalAttempt(attempt)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  // Manual reconciliation check
  async function handleManualReconcile() {
    if (!digitalAttempt) return
    setIsReconciling(true)
    setError(null)
    try {
      const reconciled = await reconcilePaymentAttempt(digitalAttempt.id)
      setDigitalAttempt(reconciled)
      await attemptQuery.refetch()
      if (activeInvoiceId) {
        const inv = await getInvoiceById(activeInvoiceId)
        if (inv.paymentStatus === 'PAID') {
          setInvoice(inv)
          completed.current = true
          onCompleted(inv)
        } else {
          setError('Hệ thống chưa ghi nhận tiền vào tài khoản. Vui lòng thử lại sau giây lát.')
        }
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setIsReconciling(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
      maxWidth={invoice ? 'sm' : 'md'}
    >
      {invoice ? (
        <div className="py-2 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <DialogTitle className="text-center text-xl font-bold text-primary">
            Thanh toán thành công!
          </DialogTitle>
          <DialogDescription className="mt-1 text-center text-sm text-muted-foreground">
            Hóa đơn số: <strong className="text-foreground">{invoice.invoiceNumber}</strong>
          </DialogDescription>

          <div className="my-5 rounded-lg border border-border bg-muted/40 p-4 text-left text-sm space-y-2.5">
            <div className="flex justify-between text-muted-foreground">
              <span>Phương thức thanh toán:</span>
              <Badge variant="secondary" className="font-bold">
                {invoice.paymentMethod === 'CASH'
                  ? 'Tiền mặt'
                  : invoice.paymentMethod === 'CARD'
                    ? 'Thẻ POS'
                    : 'Chuyển khoản'}
              </Badge>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Tổng tiền thanh toán:</span>
              <strong className="text-foreground">{formatPrice(invoice.totalAmount)}</strong>
            </div>
            {invoice.paymentMethod === 'CASH' && (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tiền khách đưa:</span>
                  <span className="font-medium text-foreground">
                    {invoice.amountTendered ? formatPrice(invoice.amountTendered) : '0 ₫'}
                  </span>
                </div>
                <div className="flex justify-between border-t border-dashed border-border pt-2.5 text-base font-bold text-primary">
                  <span>Tiền thừa:</span>
                  <span>{invoice.changeAmount ? formatPrice(invoice.changeAmount) : '0 ₫'}</span>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button className="w-full cursor-pointer font-bold" onClick={onClose}>
              Hoàn tất & Đóng
            </Button>
          </DialogFooter>
        </div>
      ) : (
        <div>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <DollarSign className="h-5 w-5 text-primary" /> Thanh toán đơn hàng
            </DialogTitle>
            <DialogDescription>
              Chọn phương thức thanh toán phù hợp với nhu cầu của khách hàng.
            </DialogDescription>
          </DialogHeader>

          {(error || pollError) && (
            <div
              className="mt-3 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error || errorMessage(pollError)}</span>
            </div>
          )}

          {/* Tổng tiền cần thanh toán */}
          <div className="mt-4 flex items-center justify-between rounded-xl bg-primary/10 px-4 py-3 text-primary">
            <span className="text-sm font-semibold">Tổng tiền thanh toán:</span>
            <span className="text-2xl font-extrabold tracking-tight">{formatPrice(totalAmount)}</span>
          </div>

          {/* Bộ chọn phương thức thanh toán */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setMethod('CASH')
                setDigitalAttempt(null)
              }}
              disabled={pending || Boolean(digitalAttempt)}
              className={cn(
                'flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-bold transition-all cursor-pointer',
                method === 'CASH'
                  ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted',
              )}
            >
              <DollarSign className="h-4 w-4" />
              Tiền mặt
            </button>

            <button
              type="button"
              onClick={() => {
                setMethod('CARD')
                setDigitalAttempt(null)
              }}
              disabled={pending || Boolean(digitalAttempt)}
              className={cn(
                'flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-bold transition-all cursor-pointer',
                method === 'CARD'
                  ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted',
              )}
            >
              <CreditCard className="h-4 w-4" />
              Quẹt thẻ POS
            </button>

            <button
              type="button"
              onClick={() => setMethod('DIGITAL')}
              className={cn(
                'flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-bold transition-all cursor-pointer',
                method === 'DIGITAL'
                  ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted',
              )}
            >
              <QrCode className="h-4 w-4" />
              Quét mã QR
            </button>
          </div>

          {/* Nội dung Tab 1: Tiền mặt */}
          {method === 'CASH' && (
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="amountTenderedInput"
                  className="block text-sm font-semibold text-foreground"
                >
                  Khách đưa (₫)
                </label>
                <Input
                  id="amountTenderedInput"
                  type="number"
                  min={numericTotal}
                  step="1000"
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value)}
                  className="text-lg font-bold"
                  required
                />
              </div>

              {/* Phím số tiền gợi ý nhanh */}
              <div className="flex flex-wrap gap-2">
                {quickDenominations.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTendered(String(val))}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
                      Number(tendered) === val
                        ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                        : 'border-border bg-card text-foreground hover:bg-muted',
                    )}
                  >
                    {formatPrice(String(val))}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm text-muted-foreground">Tiền thừa trả khách:</span>
                <span
                  className={cn(
                    'text-lg font-bold',
                    change > 0 ? 'text-primary' : 'text-foreground',
                  )}
                >
                  {formatPrice(String(change))}
                </span>
              </div>
            </div>
          )}

          {/* Nội dung Tab 2: Quẹt thẻ POS */}
          {method === 'CARD' && (
            <div className="my-5 rounded-xl border border-border bg-muted/20 p-4 text-center space-y-2">
              <CreditCard className="mx-auto h-8 w-8 text-primary" />
              <p className="text-sm font-semibold text-foreground">
                Quẹt thẻ thanh toán trên thiết bị POS ngân hàng
              </p>
              <p className="text-xs text-muted-foreground">
                Sau khi máy POS ngân hàng in biên lai thành công, bấm &quot;Xác nhận đã thanh toán&quot; để chốt đơn.
              </p>
            </div>
          )}

          {/* Nội dung Tab 3: Chuyển khoản QR (MoMo & VNPay) */}
          {method === 'DIGITAL' && (
            <div className="mt-4 space-y-4">
              {!digitalAttempt ? (
                <div className="space-y-3">
                  <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Chọn cổng thanh toán điện tử
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setDigitalProvider('MOMO')}
                      className={cn(
                        'flex items-center gap-2 rounded-xl border p-3 text-xs font-bold transition-all cursor-pointer',
                        digitalProvider === 'MOMO'
                          ? 'border-[#a50064] bg-[#a50064]/10 text-[#a50064] ring-1 ring-[#a50064]'
                          : 'border-border bg-card hover:bg-muted',
                      )}
                    >
                      <Smartphone className="h-5 w-5" />
                      MoMo QR Code
                    </button>

                    <button
                      type="button"
                      onClick={() => setDigitalProvider('VNPAY')}
                      className={cn(
                        'flex items-center gap-2 rounded-xl border p-3 text-xs font-bold transition-all cursor-pointer',
                        digitalProvider === 'VNPAY'
                          ? 'border-[#005baa] bg-[#005baa]/10 text-[#005baa] ring-1 ring-[#005baa]'
                          : 'border-border bg-card hover:bg-muted',
                      )}
                    >
                      <QrCode className="h-5 w-5" />
                      VNPay Gateway
                    </button>
                  </div>

                  <Button
                    type="button"
                    onClick={() => void handleStartDigitalPayment()}
                    isLoading={pending}
                    className="w-full mt-2 cursor-pointer font-bold"
                  >
                    Tạo mã thanh toán ({digitalProvider})
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-3 py-2">
                  <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-600">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                    </span>
                    {currentAttempt?.status === 'PENDING'
                      ? 'Đang chờ xác nhận thanh toán…'
                      : currentAttempt?.status === 'REQUIRES_REVIEW'
                        ? 'Giao dịch cần quản lý đối soát.'
                        : currentAttempt?.status === 'SUCCEEDED'
                          ? 'Đang kiểm tra hóa đơn…'
                          : 'Phiên thanh toán đã kết thúc. Kiểm tra trạng thái trước khi tạo phiên mới.'}
                  </div>

                  {digitalAttempt.paymentUrl && (
                    <div className="my-2 inline-block rounded-2xl border-2 border-primary/20 bg-white p-3 shadow-md">
                      {currentAttempt?.status === 'PENDING' && <PaymentQr value={digitalAttempt.paymentUrl} />}
                    </div>
                  )}

                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                    {(currentAttempt?.status === 'FAILED' || currentAttempt?.status === 'EXPIRED') && (
                      <Button type="button" variant="outline" size="sm" onClick={() => {
                        setDigitalAttempt(null)
                        setError(null)
                      }}>Tạo phiên mới</Button>
                    )}
                    {digitalAttempt.paymentUrl && (
                      <a
                        href={digitalAttempt.paymentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Mở liên kết thanh toán {digitalAttempt.provider}
                      </a>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleManualReconcile()}
                      isLoading={isReconciling}
                      className="cursor-pointer gap-1.5 text-xs"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Kiểm tra / Đối soát ngay
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-6 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={pending}
              className="flex-1 cursor-pointer"
            >
              Hủy
            </Button>

            {method === 'CASH' && (
              <Button
                type="button"
                onClick={() => void handleDirectCheckout('CASH')}
                isLoading={pending}
                disabled={pending || numericTendered < numericTotal}
                className="flex-2 cursor-pointer font-bold"
              >
                Xác nhận thanh toán tiền mặt
              </Button>
            )}

            {method === 'CARD' && (
              <Button
                type="button"
                onClick={() => void handleDirectCheckout('CARD')}
                isLoading={pending}
                disabled={pending}
                className="flex-2 cursor-pointer font-bold"
              >
                Xác nhận quẹt thẻ thành công
              </Button>
            )}
          </DialogFooter>
        </div>
      )}
    </Dialog>
  )
}
