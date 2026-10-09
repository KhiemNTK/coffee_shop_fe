import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import type { Session } from '../auth/session'
import { PaymentGatewayPanel } from '../invoices/components/payment-gateway-panel'
import { AlertCircle, CheckCircle2, CreditCard, DollarSign, QrCode } from 'lucide-react'
import { ApiError, errorMessage } from '../../shared/api/client'
import { formatPrice, moneySchema } from '../menu/menu.api'
import { decimalAmount, minorAmount } from '../../shared/lib/money'
import { checkoutInvoice, quoteInvoice, type Invoice, type SessionItem } from './pos.api'
import { getActivePromotions, promotionKeys } from '../promotions/promotions.api'
import { OrderOptions } from '../../shared/ui/order-options'
import { createUnpaidInvoice, getInvoices } from '../invoices/invoices.api'
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

export function CheckoutModal({
  sessionId,
  totalAmount,
  items = [],
  onClose,
  onCompleted,
}: {
  sessionId: string
  totalAmount: string
  items?: SessionItem[]
  onClose: () => void
  onCompleted: (invoice: Invoice) => void
}) {
  const [billableItems] = useState(items)
  const [selectedIds, setSelectedIds] = useState(() => items.map((item) => item.id))
  const [promotionId, setPromotionId] = useState('')
  const { employee, authorization } = useOutletContext<Session>()
  const [pending, setPending] = useState(false)
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null)
  const [submittedDirect, setSubmittedDirect] = useState<
    Parameters<typeof checkoutInvoice>[0] | null
  >(null)
  const [digitalUncertain, setDigitalUncertain] = useState(false)
  const [gatewayLocked, setGatewayLocked] = useState(false)
  const paymentLocked =
    pending || Boolean(activeInvoiceId) || Boolean(submittedDirect) || digitalUncertain || gatewayLocked
  const customInvoice = Boolean(promotionId) || selectedIds.length !== billableItems.length
  const quote = useQuery({
    queryKey: ['private', employee.id, 'pos-quote', sessionId, selectedIds, promotionId],
    queryFn: () =>
      quoteInvoice({
        orderSessionId: sessionId,
        orderItemIds: selectedIds,
        promotionId: promotionId || null,
      }),
    enabled: customInvoice && selectedIds.length > 0 && !paymentLocked,
    retry: false,
    staleTime: 0,
  })
  const promotions = useQuery({
    queryKey: promotionKeys.active(employee.id),
    queryFn: ({ signal }) => getActivePromotions({}, signal),
    enabled: authorization.permissionKeys.includes('/promotions_read') && !paymentLocked,
    retry: false,
    staleTime: 0,
  })
  const promotionAvailable =
    !promotionId ||
    (promotions.isSuccess &&
      !promotions.isFetching &&
      authorization.permissionKeys.includes('/promotions_read') &&
      promotions.data.list.some((promotion) => promotion.id === promotionId))
  const payableTotal = customInvoice ? (quote.data?.totalAmount ?? '0') : totalAmount
  const quoteReady =
    promotionAvailable &&
    (!billableItems.length || selectedIds.length > 0) &&
    (!customInvoice || (quote.isSuccess && !quote.isFetching))
  const totalMinor = minorAmount(payableTotal)
  const [method, setMethod] = useState<'CASH' | 'CARD' | 'DIGITAL'>('CASH')
  const [tendered, setTendered] = useState(totalAmount)
  const [error, setError] = useState<string | null>(null)
  const [invoice, setInvoice] = useState<Invoice | null>(null)

  const canDigital = [
    '/invoices_read',
    '/invoices_create',
    '/payment-attempts_create',
    '/payment-attempts_read',
  ].every((key) => authorization.permissionKeys.includes(key))
  const flight = useRef(false)
  const completed = useRef(false)
  const parsedTendered = moneySchema.safeParse(tendered.trim())
  const tenderedMinor = parsedTendered.success ? minorAmount(parsedTendered.data) : null
  const tenderedEnough = tenderedMinor !== null && tenderedMinor >= totalMinor
  const change = tenderedEnough ? tenderedMinor - totalMinor : 0n
  const quickDenominations = [
    totalMinor,
    ((totalMinor + 4_999_999n) / 5_000_000n) * 5_000_000n,
    ((totalMinor + 9_999_999n) / 10_000_000n) * 10_000_000n,
    50_000_000n,
  ].filter((val, idx, arr) => val >= totalMinor && arr.indexOf(val) === idx)

  async function handleDirectCheckout(payMethod: 'CASH' | 'CARD') {
    if (flight.current || (!submittedDirect && !quoteReady)) return
    if (!submittedDirect && payMethod === 'CASH' && !tenderedEnough) {
      setError('Tiền khách đưa không đủ thanh toán')
      return
    }
    const payload = submittedDirect ?? {
      orderSessionId: sessionId,
      paymentMethod: payMethod,
      orderItemIds: billableItems.length ? selectedIds : undefined,
      promotionId: promotionId || null,
      amountTendered: payMethod === 'CASH' ? tendered.trim() : payableTotal,
      closeSessionAfterPayment: true,
    }
    flight.current = true
    setSubmittedDirect(payload)
    setError(null)
    setPending(true)
    try {
      const result = await checkoutInvoice(payload)
      setInvoice(result)
      completed.current = true
      onCompleted(result)
    } catch (err) {
      setError(errorMessage(err))
      if (
        err instanceof ApiError &&
        err.status >= 400 &&
        err.status < 500 &&
        err.status !== 408 &&
        err.status !== 429
      )
        setSubmittedDirect(null)
    } finally {
      flight.current = false
      setPending(false)
    }
  }

  async function handlePrepareDigitalPayment() {
    if (flight.current || !canDigital || (!digitalUncertain && !quoteReady)) return
    flight.current = true
    setError(null)
    setPending(true)
    try {
      const existing = await getInvoices({
        orderSessionId: sessionId,
        paymentStatus: 'UNPAID',
        itemPerPage: 100,
      })
      const matching = billableItems.length
        ? existing.list.find(
            (candidate) =>
              (candidate.promotionId ?? null) === (promotionId || null) &&
              candidate.orderItems.length === selectedIds.length &&
              candidate.orderItems.every((item) => selectedIds.includes(item.id)),
          )
        : existing.list[0]
      if (!matching) setDigitalUncertain(true)
      const unpaid =
        matching ??
        (await createUnpaidInvoice(sessionId, {
          orderItemIds: billableItems.length ? selectedIds : undefined,
          promotionId: promotionId || null,
        }))
      setDigitalUncertain(false)
      if (unpaid.paymentStatus === 'PAID') {
        setInvoice(unpaid)
        completed.current = true
        onCompleted(unpaid)
      } else if (unpaid.paymentStatus === 'UNPAID') setActiveInvoiceId(unpaid.id)
      else setError('Hóa đơn không còn chờ thanh toán. Vui lòng kiểm tra lại.')
    } catch (err) {
      setError(errorMessage(err))
      if (
        err instanceof ApiError &&
        err.status >= 400 &&
        err.status < 500 &&
        err.status !== 408 &&
        err.status !== 429
      )
        setDigitalUncertain(false)
    } finally {
      flight.current = false
      setPending(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !flight.current && !submittedDirect && !digitalUncertain && !gatewayLocked) onClose()
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
                    {invoice.amountTendered ? formatPrice(invoice.amountTendered) : 'Chưa xác định'}
                  </span>
                </div>
                <div className="flex justify-between border-t border-dashed border-border pt-2.5 text-base font-bold text-primary">
                  <span>Tiền thừa:</span>
                  <span>{invoice.changeAmount ? formatPrice(invoice.changeAmount) : 'Chưa xác định'}</span>
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

          {error && (
            <div
              className="mt-3 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {billableItems.length > 0 && (
            <fieldset
              disabled={
                pending || Boolean(activeInvoiceId) || Boolean(submittedDirect) || digitalUncertain
              }
              className="mt-4 space-y-2"
            >
              <legend className="text-sm font-medium">Món trong hóa đơn</legend>
              <div className="max-h-48 overflow-y-auto divide-y">
                {billableItems.map((item) => (
                  <label key={item.id} className="flex items-start gap-2 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={(event) =>
                        setSelectedIds((ids) =>
                          event.target.checked
                            ? [...ids, item.id]
                            : ids.filter((id) => id !== item.id),
                        )
                      }
                    />
                    <span className="min-w-0 flex-1 break-words">
                      {item.quantity} × {item.menuItem.name}
                      <OrderOptions options={item.selectedOptions} />
                    </span>
                  </label>
                ))}
              </div>
              {authorization.permissionKeys.includes('/promotions_read') && (
                <label className="block text-sm">
                  Khuyến mãi
                  <select
                    aria-label="Khuyến mãi"
                    className="mt-1 w-full rounded-md border bg-background p-2"
                    value={promotionId}
                    disabled={!promotions.isSuccess}
                    onChange={(event) => setPromotionId(event.target.value)}
                  >
                    <option value="">Không áp dụng</option>
                    {promotionId &&
                      !promotions.data?.list.some((promotion) => promotion.id === promotionId) && (
                        <option value={promotionId}>Khuyến mãi đã chọn (chưa xác nhận)</option>
                      )}
                    {promotions.data?.list.map((promotion) => (
                      <option key={promotion.id} value={promotion.id}>
                        {promotion.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {promotionId && !promotions.isFetching && !promotionAvailable && (
                <div role="alert" className="space-y-2 text-sm text-destructive">
                  <p>Khuyến mãi đã chọn chưa được xác nhận còn hiệu lực.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPromotionId('')}
                  >
                    Bỏ khuyến mãi
                  </Button>
                </div>
              )}
              {promotions.isError && (
                <p role="alert" className="text-sm text-destructive">
                  {errorMessage(promotions.error)}{' '}
                  <button type="button" onClick={() => void promotions.refetch()}>
                    Thử lại
                  </button>
                </p>
              )}
              {customInvoice && quote.isFetching && (
                <p role="status" className="text-sm">
                  Đang lấy báo giá…
                </p>
              )}
              {quote.isError && (
                <p role="alert" className="text-sm text-destructive">
                  {errorMessage(quote.error)}{' '}
                  <button type="button" onClick={() => void quote.refetch()}>
                    Thử lại báo giá
                  </button>
                </p>
              )}
              {customInvoice && quote.data && (
                <p className="text-sm">Giảm giá: {formatPrice(quote.data.discountAmount)}</p>
              )}
            </fieldset>
          )}

          {/* Tổng tiền cần thanh toán */}
          <div className="mt-4 flex items-center justify-between rounded-xl bg-primary/10 px-4 py-3 text-primary">
            <span className="text-sm font-semibold">Tổng tiền thanh toán:</span>
            <span className="text-xl font-bold">
              {quoteReady ? formatPrice(payableTotal) : '—'}
            </span>
          </div>

          {/* Bộ chọn phương thức thanh toán */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setMethod('CASH')
              }}
              disabled={
                pending || Boolean(activeInvoiceId) || Boolean(submittedDirect) || digitalUncertain
              }
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
              }}
              disabled={
                pending || Boolean(activeInvoiceId) || Boolean(submittedDirect) || digitalUncertain
              }
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
              disabled={!canDigital || pending || Boolean(submittedDirect) || digitalUncertain}
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
                  min={payableTotal}
                  step="0.01"
                  value={tendered}
                  disabled={pending || Boolean(submittedDirect)}
                  onChange={(e) => setTendered(e.target.value)}
                  className="text-lg font-bold"
                  required
                />
              </div>

              {/* Phím số tiền gợi ý nhanh */}
              <div className="flex flex-wrap gap-2">
                {quickDenominations.map((val) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => setTendered(decimalAmount(val))}
                    disabled={pending || Boolean(submittedDirect)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
                      tenderedMinor === val
                        ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                        : 'border-border bg-card text-foreground hover:bg-muted',
                    )}
                  >
                    {formatPrice(decimalAmount(val))}
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
                  {tenderedMinor === null ? 'Chưa xác định' : formatPrice(decimalAmount(change))}
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
                Sau khi máy POS ngân hàng in biên lai thành công, bấm &quot;Xác nhận đã thanh
                toán&quot; để chốt đơn.
              </p>
            </div>
          )}

          {method === 'DIGITAL' && (
            <div className="mt-4 space-y-4">
              {activeInvoiceId ? (
                <PaymentGatewayPanel
                  invoiceId={activeInvoiceId}
                  onLockChange={setGatewayLocked}
                  onPaid={(paid) => {
                    if (completed.current) return
                    completed.current = true
                    setInvoice(paid)
                    onCompleted(paid)
                  }}
                />
              ) : (
                <Button
                  type="button"
                  onClick={() => void handlePrepareDigitalPayment()}
                  isLoading={pending}
                  disabled={!quoteReady && !digitalUncertain}
                  className="w-full"
                >
                  <QrCode size={16} aria-hidden="true" />
                  Kiểm tra hóa đơn trước khi tạo QR
                </Button>
              )}
            </div>
          )}

          <DialogFooter className="mt-6 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={pending || Boolean(submittedDirect) || digitalUncertain || gatewayLocked}
              className="flex-1 cursor-pointer"
            >
              Hủy
            </Button>

            {method === 'CASH' && (
              <Button
                type="button"
                onClick={() => void handleDirectCheckout('CASH')}
                isLoading={pending}
                disabled={
                  pending || (!submittedDirect && (!quoteReady || !tenderedEnough))
                }
                className="flex-2 cursor-pointer font-bold"
              >
                {submittedDirect
                  ? 'Kiểm tra lại thanh toán tiền mặt'
                  : 'Xác nhận thanh toán tiền mặt'}
              </Button>
            )}

            {method === 'CARD' && (
              <Button
                type="button"
                onClick={() => void handleDirectCheckout('CARD')}
                isLoading={pending}
                disabled={pending || (!submittedDirect && !quoteReady)}
                className="flex-2 cursor-pointer font-bold"
              >
                {submittedDirect ? 'Kiểm tra lại thanh toán thẻ' : 'Xác nhận quẹt thẻ thành công'}
              </Button>
            )}
          </DialogFooter>
        </div>
      )}
    </Dialog>
  )
}
