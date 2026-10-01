import { useState } from 'react'
import { AlertCircle, CheckCircle2, DollarSign } from 'lucide-react'
import { errorMessage } from '../../shared/api/client'
import { formatPrice } from '../menu/menu.api'
import { checkoutInvoice, type Invoice } from './pos.api'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../shared/ui/dialog'
import { Button } from '../../shared/ui/button'
import { Input } from '../../shared/ui/input'
import { cn } from '../../shared/ui/utils'

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
  const [tendered, setTendered] = useState(String(numericTotal))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invoice, setInvoice] = useState<Invoice | null>(null)

  const numericTendered = Number(tendered) || 0
  const change = Math.max(0, numericTendered - numericTotal)

  const quickDenominations = [
    numericTotal,
    Math.ceil(numericTotal / 50000) * 50000,
    Math.ceil(numericTotal / 100000) * 100000,
    500000,
  ].filter((val, idx, arr) => val >= numericTotal && arr.indexOf(val) === idx)

  async function handleCheckout() {
    if (numericTendered < numericTotal) {
      setError('Tiền khách đưa không đủ thanh toán')
      return
    }
    setError(null)
    setPending(true)
    try {
      const result = await checkoutInvoice({
        orderSessionId: sessionId,
        amountTendered: String(numericTendered),
        closeSessionAfterPayment: true,
      })
      setInvoice(result)
      onCompleted(result)
    } catch (err) {
      setError(errorMessage(err))
      setPending(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
      maxWidth="sm"
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
              <span>Tổng tiền hàng:</span>
              <strong className="text-foreground">{formatPrice(invoice.totalAmount)}</strong>
            </div>
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
          </div>

          <DialogFooter>
            <Button className="w-full" onClick={onClose}>
              Hoàn tất
            </Button>
          </DialogFooter>
        </div>
      ) : (
        <div>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <DollarSign className="h-5 w-5 text-primary" /> Thanh toán tiền mặt
            </DialogTitle>
            <DialogDescription>
              Xác nhận số tiền khách đưa để hoàn tất hóa đơn.
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

          <div className="mt-4 flex items-center justify-between rounded-lg bg-primary/10 px-4 py-3 text-primary">
            <span className="text-sm font-medium">Tổng cần thanh toán:</span>
            <span className="text-2xl font-bold tracking-tight">{formatPrice(totalAmount)}</span>
          </div>

          <div className="mt-4 space-y-2">
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
          <div className="mt-3 flex flex-wrap gap-2">
            {quickDenominations.map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setTendered(String(val))}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors',
                  Number(tendered) === val
                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                    : 'border-border bg-card text-foreground hover:bg-muted',
                )}
              >
                {formatPrice(String(val))}
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
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

          <DialogFooter className="mt-6 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={pending}
              className="flex-1"
            >
              Hủy
            </Button>
            <Button
              type="button"
              onClick={() => void handleCheckout()}
              isLoading={pending}
              disabled={pending || numericTendered < numericTotal}
              className="flex-2"
            >
              Xác nhận thanh toán
            </Button>
          </DialogFooter>
        </div>
      )}
    </Dialog>
  )
}
