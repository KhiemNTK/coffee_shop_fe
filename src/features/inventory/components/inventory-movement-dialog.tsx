import { useId, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowDownToLine, ArrowUpFromLine, RotateCcw, X } from 'lucide-react'
import { Button, Dialog, DialogTitle, Input } from '@/shared/ui'
import { ApiError, errorMessage } from '@/shared/api/client'
import {
  readPendingIntent,
  writePendingIntent,
  isPendingIntentExpired,
  type PendingIntent,
} from '@/shared/api/pending-intent'
import { pendingOperationPrefix } from '@/shared/api/idempotency'
import { decimalAmount, minorAmount } from '@/shared/lib/money'
import { formatPrice } from '@/shared/lib/format'
import { moneySchema } from '../../menu/menu.api'
import { exportInventory, importInventory } from '../inventory.api'
import { formatQuantity, quantityDifference, quantitySchema } from '../quantity'
import {
  movementIntentKey,
  movementIntentSchema,
  type MovementTarget,
  type StockMovement,
} from '../movement-intent'

export function InventoryMovementDialog({
  employeeId,
  target,
  onClose,
  onUpdated,
}: {
  employeeId: string
  target: MovementTarget | null
  onClose: () => void
  onUpdated: () => void
}) {
  const { t } = useTranslation()
  const key = movementIntentKey(employeeId)
  const [recovery] = useState(() => {
    try {
      const intent = readPendingIntent(key, movementIntentSchema)
      const legacy =
        !intent &&
        Object.keys(sessionStorage).some((name) =>
          name.startsWith(`${pendingOperationPrefix}private:/inventory/items/`),
        )
      return { intent, error: legacy }
    } catch {
      return { intent: null, error: true }
    }
  })
  const [pending, setPending] = useState(recovery.intent)
  const [hidden, setHidden] = useState(false)
  const current = pending?.payload ?? target
  if (recovery.error)
    return (
      <p role="alert" className="border-l-2 border-destructive p-3 text-sm text-destructive">
        {t('inventory.movement.corrupt')}
      </p>
    )
  if (!current) return null
  if (pending && hidden && !target)
    return (
      <div
        role="status"
        className="flex flex-wrap items-center gap-3 border-l-2 border-amber-500 p-3 text-sm"
      >
        <p>{t('inventory.movement.uncertain')}</p>
        <Button type="button" variant="outline" onClick={() => setHidden(false)}>
          <RotateCcw size={16} aria-hidden="true" />
          {t('inventory.movement.recover')}
        </Button>
      </div>
    )
  return (
    <MovementForm
      key={`${current.type}:${current.item.id}`}
      target={current}
      storageKey={key}
      pending={pending}
      setPending={setPending}
      onClose={() => {
        setHidden(true)
        onClose()
      }}
      onUpdated={onUpdated}
    />
  )
}

function MovementForm({
  target,
  storageKey,
  pending,
  setPending,
  onClose,
  onUpdated,
}: {
  target: MovementTarget
  storageKey: string
  pending: PendingIntent<StockMovement> | null
  setPending: (value: PendingIntent<StockMovement> | null) => void
  onClose: () => void
  onUpdated: () => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const flight = useRef(false)
  const isImport = target.type === 'IMPORT'
  const item = target.item
  const unit = 'unitName' in item ? item.unitName : (item.unit?.name ?? '')
  const [quantity, setQuantity] = useState(pending?.payload.quantity ?? '')
  const [unitPrice, setUnitPrice] = useState(
    pending?.payload.type === 'IMPORT' ? pending.payload.unitPrice : '',
  )
  const [note, setNote] = useState(pending?.payload.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(() => (pending ? isPendingIntentExpired(pending) : false))
  const available =
    'reservedStock' in item ? quantityDifference(item.stock, item.reservedStock) : item.stock
  const mutation = useMutation({
    retry: false,
    mutationFn: ({ payload, idempotencyKey }: PendingIntent<StockMovement>) =>
      payload.type === 'IMPORT'
        ? importInventory(payload.item.id, {
            quantity: payload.quantity,
            unitPrice: payload.unitPrice,
            note: payload.note,
            idempotencyKey,
          })
        : exportInventory(payload.item.id, {
            quantity: payload.quantity,
            note: payload.note,
            idempotencyKey,
          }),
    onSuccess: () => {
      sessionStorage.removeItem(storageKey)
      setPending(null)
      onClose()
    },
    onError: (err, intent) => {
      setError(errorMessage(err))
      if (
        !intent.uncertain &&
        err instanceof ApiError &&
        err.status >= 400 &&
        err.status < 500 &&
        err.status !== 408 &&
        err.status !== 429
      ) {
        sessionStorage.removeItem(storageKey)
        setPending(null)
      } else {
        const uncertain = { ...intent, uncertain: true }
        setPending(uncertain)
        try {
          writePendingIntent(storageKey, uncertain)
        } catch {
          setError(t('inventory.movement.storageFailed'))
        }
      }
    },
    onSettled: () => {
      flight.current = false
      onUpdated()
    },
  })
  const locked = !!pending || mutation.isPending
  const close = () => {
    if (!flight.current && !mutation.isPending) onClose()
  }
  const validQuantity = quantitySchema.safeParse(quantity.trim())
  const validPrice = moneySchema.safeParse(unitPrice.trim())
  let estimate: string | null = null
  if (
    isImport &&
    validQuantity.success &&
    !validQuantity.data.startsWith('-') &&
    validPrice.success
  ) {
    const [integer = '0', fraction = ''] = validQuantity.data.split('.')
    const scaled = BigInt(integer) * 10000n + BigInt(fraction.padEnd(4, '0'))
    estimate = decimalAmount((scaled * minorAmount(validPrice.data) + 5000n) / 10000n)
  }

  return (
    <Dialog open onClose={close} maxWidth="sm" showCloseButton={false}>
      <form
        className="grid min-w-0 gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (flight.current || mutation.isPending) return
          setError(null)
          if (pending && isPendingIntentExpired(pending)) {
            setExpired(true)
            return
          }
          if (
            !pending &&
            (!validQuantity.success ||
              validQuantity.data.startsWith('-') ||
              quantityDifference(validQuantity.data, '0') === '0.0000')
          ) {
            setError(t('inventory.movement.invalidQuantity'))
            return
          }
          if (!pending && isImport && !validPrice.success) {
            setError(t('inventory.movement.invalidPrice'))
            return
          }
          if (
            !pending &&
            !isImport &&
            quantityDifference(available, quantity.trim()).startsWith('-')
          ) {
            setError(t('inventory.exportExceedsAvailable', { quantity: formatQuantity(available) }))
            return
          }
          if (!pending && (note.trim().length < 3 || note.trim().length > 500)) {
            setError(t('inventory.movement.invalidNote'))
            return
          }
          const intent = pending ?? {
            payload: movementIntentSchema.parse({
              ...target,
              quantity: quantity.trim(),
              ...(isImport ? { unitPrice: unitPrice.trim() } : {}),
              note: note.trim(),
            }),
            idempotencyKey: crypto.randomUUID(),
            createdAt: Date.now(),
          }
          try {
            writePendingIntent(storageKey, { ...intent, uncertain: true })
          } catch {
            setError(t('inventory.movement.storageFailed'))
            return
          }
          setPending(intent)
          flight.current = true
          mutation.mutate(intent)
        }}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border pb-3">
          <DialogTitle className="flex min-w-0 items-center gap-2 pr-1">
            {isImport ? (
              <ArrowDownToLine size={19} aria-hidden="true" className="shrink-0" />
            ) : (
              <ArrowUpFromLine size={19} aria-hidden="true" className="shrink-0" />
            )}
            {t(isImport ? 'inventory.movement.importTitle' : 'inventory.movement.exportTitle')}
          </DialogTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0"
            disabled={mutation.isPending}
            aria-label={t('inventory.movement.close')}
            onClick={close}
          >
            <X size={18} aria-hidden="true" />
          </Button>
        </header>
        <div className="grid gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
          <p className="break-words font-semibold text-foreground">{item.name}</p>
          <p className="text-muted-foreground">
            {t('inventory.movement.observedStock')}:{' '}
            {formatQuantity(isImport ? item.stock : available)} {unit}
          </p>
        </div>
        {pending && (
          <p
            id={`${id}-recovery`}
            role="status"
            className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          >
            {t('inventory.movement.uncertain')}
          </p>
        )}
        {expired && (
          <p role="alert" className="text-sm text-destructive">
            {t('inventory.movement.expired')}
          </p>
        )}
        <fieldset
          disabled={locked}
          aria-describedby={pending ? `${id}-recovery` : undefined}
          className="grid min-w-0 gap-4"
        >
          <label className="grid min-w-0 gap-2 text-sm font-medium">
            <span>{t('inventory.movement.quantity', { unit })}</span>
            <Input
              className="bg-card text-foreground"
              required
              inputMode="decimal"
              autoComplete="off"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
          {isImport && (
            <label className="grid min-w-0 gap-2 text-sm font-medium">
              <span>{t('inventory.movement.unitPrice', { unit })}</span>
              <Input
                className="bg-card text-foreground"
                required
                inputMode="decimal"
                autoComplete="off"
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value)}
              />
            </label>
          )}
          <label className="grid min-w-0 gap-2 text-sm font-medium">
            <span>{t('inventory.movement.note')}</span>
            <Input
              className="bg-card text-foreground"
              required
              minLength={3}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        </fieldset>
        {estimate !== null && (
          <p className="text-sm text-muted-foreground">
            {t('inventory.movement.estimate')}:{' '}
            <strong className="text-foreground">{formatPrice(estimate)}</strong>
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <footer className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" disabled={mutation.isPending} onClick={close}>
            {t(pending ? 'inventory.movement.reviewClose' : 'inventory.movement.cancel')}
          </Button>
          <Button
            type="submit"
            variant={isImport ? 'default' : 'destructive'}
            disabled={expired}
            isLoading={mutation.isPending}
          >
            {pending && <RotateCcw size={16} aria-hidden="true" />}
            {t(
              pending
                ? 'inventory.movement.recover'
                : isImport
                  ? 'inventory.movement.confirmImport'
                  : 'inventory.movement.confirmExport',
            )}
          </Button>
        </footer>
      </form>
    </Dialog>
  )
}
