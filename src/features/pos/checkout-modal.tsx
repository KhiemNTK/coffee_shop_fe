import { useTranslation } from 'react-i18next'
import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import type { Session } from '../auth/session'
import { PaymentGatewayPanel } from '../invoices/components/payment-gateway-panel'
import { CheckoutReceipt } from '../printing/components/checkout-receipt'
import { PrecheckPrint } from '../printing/components/precheck-print'
import { ShiftRequiredLink } from '../cashier-shifts/components/shift-required-link'
import { CheckCircle2, CreditCard, DollarSign, QrCode } from 'lucide-react'
import { ApiError, errorMessage } from '../../shared/api/client'
import { useRetryAfter } from '../../shared/api/use-retry-after'
import { ApiErrorAlert } from '../../shared/ui/api-error-alert'
import { formatPrice, moneySchema } from '../menu/menu.api'
import { decimalAmount, minorAmount } from '../../shared/lib/money'
import {
  checkoutInvoice,
  checkoutInputSchema,
  quoteInvoice,
  type CheckoutInput,
  type Invoice,
  type SessionItem,
} from './pos.api'
import {
  pendingIntentKey,
  readPendingIntent,
  writePendingIntent,
  isPendingIntentExpired,
  type PendingIntent,
} from '../../shared/api/pending-intent'
import { WorkflowPermissions } from '@/shared/auth/workflow-permissions'
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
  onReviewRequired,
}: {
  sessionId: string
  totalAmount: string
  items?: SessionItem[]
  onClose: () => void
  onCompleted: (invoice: Invoice) => void
  onReviewRequired: () => void
}) {
  const { t: translate } = useTranslation()
  const [billableItems] = useState(items)
  const [selectedIds, setSelectedIds] = useState(() => items.map((item) => item.id))
  const [promotionId, setPromotionId] = useState('')
  const { employee, access } = useOutletContext<Session>()
  const [pending, setPending] = useState(false)
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null)
  const recoveryKey = pendingIntentKey(employee.id, `invoice.checkout:${sessionId}`)
  const [submittedDirect, setSubmittedDirect] = useState<PendingIntent<CheckoutInput> | null>(() =>
    readPendingIntent(recoveryKey, checkoutInputSchema)
  )
  const [reviewRequired, setReviewRequired] = useState(false)
  const [digitalUncertain, setDigitalUncertain] = useState(false)
  const [gatewayLocked, setGatewayLocked] = useState(false)
  const paymentLocked =
    pending ||
    Boolean(activeInvoiceId) ||
    Boolean(submittedDirect) ||
    digitalUncertain ||
    gatewayLocked
  const quote = useQuery({
    queryKey: ['private', employee.id, 'pos-quote', sessionId, selectedIds, promotionId],
    queryFn: () =>
      quoteInvoice({
        orderSessionId: sessionId,
        orderItemIds: selectedIds,
        promotionId: promotionId || null,
      }),
    enabled: selectedIds.length > 0 && !paymentLocked && !reviewRequired,
    retry: false,
    staleTime: 0,
  })
  const promotions = useQuery({
    queryKey: promotionKeys.active(employee.id),
    queryFn: ({ signal }) => getActivePromotions({}, signal),
    enabled: access.has('/promotions_read') && !paymentLocked,
    retry: false,
    staleTime: 0,
  })
  const promotionAvailable =
    !promotionId ||
    (promotions.isSuccess &&
      !promotions.isFetching &&
      access.has('/promotions_read') &&
      promotions.data.list.some((promotion) => promotion.id === promotionId))
  const payableTotal =
    submittedDirect?.payload.expectedTotal ?? quote.data?.totalAmount ?? totalAmount
  const quoteReady =
    promotionAvailable &&
    (!billableItems.length || selectedIds.length > 0) &&
    !reviewRequired &&
    quote.isSuccess &&
    !quote.isFetching
  const totalMinor = minorAmount(payableTotal)
  const canDirect = access.hasAll(...WorkflowPermissions.manualCheckout)
  const [method, setMethod] = useState<'CASH' | 'CARD' | 'DIGITAL'>(
    submittedDirect?.payload.paymentMethod ?? (canDirect ? 'CASH' : 'DIGITAL')
  )
  const [tendered, setTendered] = useState(submittedDirect?.payload.amountTendered ?? totalAmount)
  const [error, setError] = useState<unknown>(null)
  const retryWait = useRetryAfter(error)
  const [shiftRequired, setShiftRequired] = useState(false)
  const [invoice, setInvoice] = useState<Invoice | null>(null)

  const canDigital = access.hasAll(...WorkflowPermissions.digitalCheckout)
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
    20_000_000n,
    50_000_000n,
  ].filter((val, idx, arr) => val >= totalMinor && arr.indexOf(val) === idx)

  async function handleDirectCheckout(payMethod: 'CASH' | 'CARD') {
    if (retryWait || flight.current || !canDirect || (!submittedDirect && !quoteReady)) return
    if (submittedDirect && isPendingIntentExpired(submittedDirect)) {
      setError(translate('pos.checkoutExpired'))
      return
    }
    if (!submittedDirect && payMethod === 'CASH' && !tenderedEnough) {
      setError(translate('pos.insufficientCash'))
      return
    }
    const intent = submittedDirect ?? {
      createdAt: Date.now(),
      idempotencyKey: crypto.randomUUID(),
      payload: {
        orderSessionId: sessionId,
        paymentMethod: payMethod,
        orderItemIds: billableItems.length ? selectedIds : undefined,
        promotionId: promotionId || null,
        amountTendered: payMethod === 'CASH' ? tendered.trim() : payableTotal,
        closeSessionAfterPayment: true,
        quoteFingerprint: quote.data!.quoteFingerprint,
        expectedTotal: payableTotal,
      },
    }
    flight.current = true
    setError(null)
    setShiftRequired(false)
    setPending(true)
    let saved = false
    try {
      const sending = { ...intent, uncertain: true }
      writePendingIntent(recoveryKey, sending)
      saved = true
      setSubmittedDirect(sending)
      const result = await checkoutInvoice({
        ...intent.payload,
        idempotencyKey: intent.idempotencyKey,
      })
      sessionStorage.removeItem(recoveryKey)
      setSubmittedDirect(null)
      setInvoice(result)
      completed.current = true
      onCompleted(result)
    } catch (err) {
      setShiftRequired(err instanceof ApiError && err.code === 'CASHIER_SHIFT_REQUIRED')
      setError(err)
      if (!saved) return
      if (
        err instanceof ApiError &&
        err.status >= 400 &&
        err.status < 500 &&
        err.status !== 408 &&
        err.status !== 429 &&
        !submittedDirect?.uncertain
      ) {
        sessionStorage.removeItem(recoveryKey)
        setSubmittedDirect(null)
        if (err.code === 'INVOICE_QUOTE_CHANGED') {
          setReviewRequired(true)
          onReviewRequired()
        }
      } else {
        const uncertain = { ...intent, uncertain: true }
        setSubmittedDirect(uncertain)
      }
    } finally {
      flight.current = false
      setPending(false)
    }
  }

  async function handlePrepareDigitalPayment() {
    if (retryWait || flight.current || !canDigital || (!digitalUncertain && !quoteReady)) return
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
              candidate.orderItems.every((item) => selectedIds.includes(item.id))
          )
        : existing.list[0]
      if (!matching) setDigitalUncertain(true)
      const unpaid =
        matching ??
        (await createUnpaidInvoice(sessionId, {
          orderItemIds: billableItems.length ? selectedIds : undefined,
          promotionId: promotionId || null,
          quoteFingerprint: quote.data?.quoteFingerprint,
          expectedTotal: payableTotal,
        }))
      setDigitalUncertain(false)
      if (unpaid.paymentStatus === 'PAID') {
        setInvoice(unpaid)
        completed.current = true
        onCompleted(unpaid)
      } else if (unpaid.paymentStatus === 'UNPAID') setActiveInvoiceId(unpaid.id)
      else setError(translate('pos.invoiceChanged'))
    } catch (err) {
      setError(err)
      if (
        err instanceof ApiError &&
        err.status >= 400 &&
        err.status < 500 &&
        err.status !== 408 &&
        err.status !== 429
      ) {
        setDigitalUncertain(false)
        if (err.code === 'INVOICE_QUOTE_CHANGED') {
          setReviewRequired(true)
          onReviewRequired()
        }
      }
    } finally {
      flight.current = false
      setPending(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !flight.current && !submittedDirect && !digitalUncertain && !gatewayLocked)
          onClose()
      }}
      maxWidth={invoice ? 'sm' : 'md'}
    >
      {invoice ? (
        <div className="py-2 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <DialogTitle className="text-center text-xl font-bold text-primary">
            {translate('pos.paymentSuccess')}
          </DialogTitle>
          <DialogDescription className="mt-1 text-center text-sm text-muted-foreground">
            {translate('pos.invoiceNumber')}{' '}
            <strong className="text-foreground">{invoice.invoiceNumber}</strong>
          </DialogDescription>

          <div className="my-5 rounded-lg border border-border bg-muted/40 p-4 text-left text-sm space-y-2.5">
            <div className="flex justify-between text-muted-foreground">
              <span>{translate('pos.paymentMethod')}</span>
              <Badge variant="secondary" className="font-bold">
                {invoice.paymentMethod === 'CASH'
                  ? translate('pos.cash')
                  : invoice.paymentMethod === 'CARD'
                    ? translate('pos.card')
                    : translate('pos.bankTransfer')}
              </Badge>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>{translate('pos.paymentTotal')}</span>
              <strong className="text-foreground">{formatPrice(invoice.totalAmount)}</strong>
            </div>
            {invoice.paymentMethod === 'CASH' && (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>{translate('pos.cashReceived')}</span>
                  <span className="font-medium text-foreground">
                    {invoice.amountTendered
                      ? formatPrice(invoice.amountTendered)
                      : translate('common.undetermined')}
                  </span>
                </div>
                <div className="flex justify-between border-t border-dashed border-border pt-2.5 text-base font-bold text-primary">
                  <span>{translate('pos.change')}</span>
                  <span>
                    {invoice.changeAmount
                      ? formatPrice(invoice.changeAmount)
                      : translate('common.undetermined')}
                  </span>
                </div>
              </>
            )}
          </div>

          <CheckoutReceipt invoiceId={invoice.id} />
          <DialogFooter>
            <Button className="w-full cursor-pointer font-bold" onClick={onClose}>
              {translate('pos.finishClose')}
            </Button>
          </DialogFooter>
        </div>
      ) : (
        <div>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <DollarSign className="h-5 w-5 text-primary" /> {translate('pos.checkoutHeading')}
            </DialogTitle>
            <DialogDescription>{translate('pos.paymentDescription')}</DialogDescription>
          </DialogHeader>

          {error != null && (
            <div className="mt-3">
              <ApiErrorAlert error={error} />
            </div>
          )}

          {shiftRequired && <ShiftRequiredLink />}
          {submittedDirect && (
            <p role="status" className="mt-3 text-sm text-muted-foreground">
              {translate(
                isPendingIntentExpired(submittedDirect)
                  ? 'pos.checkoutExpired'
                  : 'pos.checkoutRecovering'
              )}
            </p>
          )}
          {reviewRequired && (
            <Button type="button" variant="outline" className="mt-3" onClick={onClose}>
              {translate('pos.reviewOrder')}
            </Button>
          )}

          <div className="mt-4">
            <PrecheckPrint
              input={{
                orderSessionId: sessionId,
                orderItemIds: billableItems.length ? selectedIds : undefined,
                promotionId: promotionId || null,
              }}
              disabled={paymentLocked || !quoteReady}
            />
          </div>

          {billableItems.length > 0 && (
            <fieldset
              disabled={
                pending || Boolean(activeInvoiceId) || Boolean(submittedDirect) || digitalUncertain
              }
              className="mt-4 space-y-2"
            >
              <legend className="text-sm font-medium">{translate('pos.invoiceItems')}</legend>
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
                            : ids.filter((id) => id !== item.id)
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
              {access.has('/promotions_read') && (
                <label className="block text-sm">
                  {translate('nav.promotions')}
                  <select
                    aria-label={translate('nav.promotions')}
                    className="mt-1 w-full rounded-md border bg-background p-2"
                    value={promotionId}
                    disabled={!promotions.isSuccess}
                    onChange={(event) => setPromotionId(event.target.value)}
                  >
                    <option value="">{translate('pos.noPromotion')}</option>
                    {promotionId &&
                      !promotions.data?.list.some((promotion) => promotion.id === promotionId) && (
                        <option value={promotionId}>{translate('pos.promotionUnconfirmed')}</option>
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
                  <p>{translate('pos.promotionUnknown')}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPromotionId('')}
                  >
                    {translate('pos.removePromotion')}
                  </Button>
                </div>
              )}
              {promotions.isError && (
                <p role="alert" className="text-sm text-destructive">
                  {errorMessage(promotions.error)}{' '}
                  <button type="button" onClick={() => void promotions.refetch()}>
                    {translate('common.retry')}
                  </button>
                </p>
              )}
              {quote.isFetching && (
                <p role="status" className="text-sm">
                  {translate('pos.loadingQuote')}
                </p>
              )}
              {quote.isError && (
                <p role="alert" className="text-sm text-destructive">
                  {errorMessage(quote.error)}{' '}
                  <button type="button" onClick={() => void quote.refetch()}>
                    {translate('pos.retryQuote')}
                  </button>
                </p>
              )}
              {quote.data && (
                <p className="text-sm">
                  {translate('pos.discount')} {formatPrice(quote.data.discountAmount)}
                </p>
              )}
            </fieldset>
          )}

          {/* Tổng tiền cần thanh toán */}
          <div className="mt-4 flex items-center justify-between rounded-xl bg-primary/10 px-4 py-3 text-primary">
            <span className="text-sm font-semibold">{translate('pos.paymentTotal')}</span>
            <span className="text-xl font-bold">
              {quoteReady || submittedDirect ? formatPrice(payableTotal) : '—'}
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
                !canDirect ||
                pending ||
                Boolean(activeInvoiceId) ||
                Boolean(submittedDirect) ||
                digitalUncertain
              }
              className={cn(
                'flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-bold transition-all cursor-pointer',
                method === 'CASH'
                  ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted'
              )}
            >
              <DollarSign className="h-4 w-4" />
              {translate('pos.cash')}
            </button>

            <button
              type="button"
              onClick={() => {
                setMethod('CARD')
              }}
              disabled={
                !canDirect ||
                pending ||
                Boolean(activeInvoiceId) ||
                Boolean(submittedDirect) ||
                digitalUncertain
              }
              className={cn(
                'flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-bold transition-all cursor-pointer',
                method === 'CARD'
                  ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted'
              )}
            >
              <CreditCard className="h-4 w-4" />
              {translate('pos.swipeCard')}
            </button>

            <button
              type="button"
              onClick={() => setMethod('DIGITAL')}
              disabled={!canDigital || pending || Boolean(submittedDirect) || digitalUncertain}
              className={cn(
                'flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-bold transition-all cursor-pointer',
                method === 'DIGITAL'
                  ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted'
              )}
            >
              <QrCode className="h-4 w-4" />
              {translate('pos.qr')}
            </button>
          </div>

          {/* Nội dung Tab 1: Tiền mặt */}
          {method === 'CASH' && (
            <div className="mt-4 space-y-3.5">
              <div className="space-y-1.5">
                <label
                  htmlFor="amountTenderedInput"
                  className="block text-sm font-semibold text-foreground"
                >
                  {translate('pos.cashInput')}
                </label>
                <Input
                  id="amountTenderedInput"
                  type="number"
                  inputMode="decimal"
                  min={payableTotal}
                  step="1000"
                  value={tendered}
                  disabled={pending || Boolean(submittedDirect)}
                  onChange={(e) => setTendered(e.target.value)}
                  className="text-lg font-bold tabular-nums"
                  required
                />
              </div>

              {/* Phím số tiền gợi ý nhanh theo màu polymer VND */}
              <div className="flex flex-wrap gap-2">
                {quickDenominations.map((val) => {
                  const isExact = val === totalMinor
                  const is500k = val === 50_000_000n
                  const is200k = val === 20_000_000n
                  const is100k = val === 10_000_000n
                  const isSelected = tenderedMinor === val

                  let colorClasses = 'border-border bg-card text-foreground hover:bg-muted'
                  if (isSelected) {
                    colorClasses =
                      'border-primary bg-primary/10 text-primary ring-2 ring-primary/40 font-bold'
                  } else if (isExact) {
                    colorClasses =
                      'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold'
                  } else if (is500k) {
                    colorClasses =
                      'border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100 font-semibold'
                  } else if (is200k) {
                    colorClasses =
                      'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 font-semibold'
                  } else if (is100k) {
                    colorClasses =
                      'border-teal-300 bg-teal-50 text-teal-800 hover:bg-teal-100 font-semibold'
                  }

                  return (
                    <button
                      key={String(val)}
                      type="button"
                      onClick={() => setTendered(decimalAmount(val))}
                      disabled={pending || Boolean(submittedDirect)}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-xs transition-all active:scale-95 cursor-pointer',
                        colorClasses
                      )}
                    >
                      {isExact
                        ? `Đúng tiền (${formatPrice(decimalAmount(val))})`
                        : formatPrice(decimalAmount(val))}
                    </button>
                  )
                })}
              </div>

              {/* Khối hiển thị tiền thừa / còn thiếu */}
              <div
                className={cn(
                  'flex items-center justify-between rounded-xl border p-3.5 transition-all',
                  tenderedEnough
                    ? change > 0n
                      ? 'border-emerald-200 bg-emerald-50/60 text-emerald-950'
                      : 'border-border bg-muted/40 text-foreground'
                    : 'border-amber-200 bg-amber-50/60 text-amber-950'
                )}
              >
                <div>
                  <span className="block text-xs font-semibold text-muted-foreground">
                    {tenderedEnough ? translate('pos.cashChange') : translate('pos.cashShort')}
                  </span>
                  <span
                    className={cn(
                      'text-xl font-bold tracking-tight tabular-nums',
                      tenderedEnough
                        ? change > 0n
                          ? 'text-emerald-700'
                          : 'text-foreground'
                        : 'text-amber-700'
                    )}
                  >
                    {tenderedMinor === null
                      ? translate('common.undetermined')
                      : tenderedEnough
                        ? formatPrice(decimalAmount(change))
                        : formatPrice(decimalAmount(totalMinor - tenderedMinor))}
                  </span>
                </div>
                {tenderedEnough && change === 0n && (
                  <Badge variant="success" className="font-bold">
                    {translate('pos.enoughCash')}
                  </Badge>
                )}
                {tenderedEnough && change > 0n && (
                  <Badge
                    variant="outline"
                    className="border-emerald-300 bg-white font-bold text-emerald-700"
                  >
                    {translate('pos.returnChange')} {formatPrice(decimalAmount(change))}
                  </Badge>
                )}
                {!tenderedEnough && tenderedMinor !== null && (
                  <Badge variant="warning" className="font-bold">
                    {translate('pos.notEnoughCash')}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Nội dung Tab 2: Quẹt thẻ POS */}
          {method === 'CARD' && (
            <div className="my-5 rounded-xl border border-border bg-muted/20 p-4 text-center space-y-2">
              <CreditCard className="mx-auto h-8 w-8 text-primary" />
              <p className="text-sm font-semibold text-foreground">
                {translate('pos.bankTerminal')}
              </p>
              <p className="text-xs text-muted-foreground">{translate('pos.cardConfirmInfo')}</p>
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
                  disabled={retryWait > 0 || (!quoteReady && !digitalUncertain)}
                  className="w-full"
                >
                  <QrCode size={16} aria-hidden="true" />
                  {translate('pos.reviewBeforeQr')}
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
              {translate('common.cancel')}
            </Button>

            {method === 'CASH' && (
              <Button
                type="button"
                onClick={() => void handleDirectCheckout('CASH')}
                isLoading={pending}
                disabled={
                  retryWait > 0 ||
                  !canDirect ||
                  pending ||
                  (!submittedDirect && (!quoteReady || !tenderedEnough))
                }
                className="flex-2 cursor-pointer font-bold"
              >
                {submittedDirect ? translate('pos.reviewCash') : translate('pos.confirmCash')}
              </Button>
            )}

            {method === 'CARD' && (
              <Button
                type="button"
                onClick={() => void handleDirectCheckout('CARD')}
                isLoading={pending}
                disabled={
                  retryWait > 0 || !canDirect || pending || (!submittedDirect && !quoteReady)
                }
                className="flex-2 cursor-pointer font-bold"
              >
                {submittedDirect ? translate('pos.reviewCard') : translate('pos.confirmCard')}
              </Button>
            )}
          </DialogFooter>
        </div>
      )}
    </Dialog>
  )
}
