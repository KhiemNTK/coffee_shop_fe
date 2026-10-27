import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Check, Minus, Plus, X } from 'lucide-react'
import { formatPrice, type MenuItem } from '../../menu/menu.api'
import { formatLineAmount } from '../../../shared/lib/format'
import { Button, Dialog, Input, cn } from '../../../shared/ui'
import { type CartItem, decimalAmount, minorAmount } from '../cart'

export function ItemCustomizerModal({
  item,
  onClose,
  onConfirm,
}: {
  item: MenuItem
  onClose: () => void
  onConfirm: (cartItem: CartItem) => void
}) {
  const { t: translate } = useTranslation()
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState('')
  const [selectedOptions, setSelectedOptions] = useState<Map<string, string[]>>(() => {
    const map = new Map<string, string[]>()
    item.optionGroups.forEach((group) => {
      const firstOpt = group.options[0]
      if (group.minSelected === 1 && group.maxSelected === 1 && firstOpt) {
        map.set(group.id, [firstOpt.id])
      } else {
        map.set(group.id, [])
      }
    })
    return map
  })

  // Calculate dynamic unit price
  const basePrice = minorAmount(item.price)
  let deltaSum = 0n
  selectedOptions.forEach((optIds, groupId) => {
    const group = item.optionGroups.find((g) => g.id === groupId)
    if (!group) return
    optIds.forEach((id) => {
      const opt = group.options.find((o) => o.id === id)
      if (opt) deltaSum += minorAmount(opt.priceDelta)
    })
  })
  const unitPrice = decimalAmount(basePrice + deltaSum)

  // Check group constraints
  const errors: string[] = []
  item.optionGroups.forEach((group) => {
    const selected = selectedOptions.get(group.id) ?? []
    if (group.minSelected > 0 && selected.length < group.minSelected) {
      errors.push(
        translate('takeaway.minimumOptions', { count: group.minSelected, name: group.name }),
      )
    }
    if (group.maxSelected > 0 && selected.length > group.maxSelected) {
      errors.push(
        translate('takeaway.maximumOptions', { count: group.maxSelected, name: group.name }),
      )
    }
  })

  function toggleOption(groupId: string, optionId: string, maxSelected: number) {
    setSelectedOptions((prev) => {
      const next = new Map(prev)
      const current = next.get(groupId) ?? []
      if (maxSelected === 1) {
        next.set(groupId, [optionId])
      } else {
        if (current.includes(optionId)) {
          next.set(
            groupId,
            current.filter((id) => id !== optionId),
          )
        } else {
          if (maxSelected === 0 || current.length < maxSelected) {
            next.set(groupId, [...current, optionId])
          }
        }
      }
      return next
    })
  }

  function handleSave() {
    if (errors.length > 0) return
    const allOptionIds = Array.from(selectedOptions.values()).flat()
    onConfirm({
      id: crypto.randomUUID(),
      menuItem: item,
      quantity,
      note: note.trim(),
      selectedOptionIds: allOptionIds,
      calculatedUnitPrice: unitPrice,
    })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="md"
      label={`${translate('common.options')} ${item.name}`}
      showCloseButton={false}
    >
      <div className="flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-brand-900 break-words line-clamp-2 leading-snug">
              {item.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {translate('takeaway.basePrice')}{' '}
              <span className="font-semibold text-brand-700 tabular-nums">
                {formatPrice(item.price)}
              </span>
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label={translate('takeaway.closeOptions')}
            className="h-8 w-8 p-0 rounded-full shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-6">
          {item.optionGroups.map((group) => {
            const selected = selectedOptions.get(group.id) ?? []
            const isSingle = group.maxSelected === 1
            return (
              <div key={group.id} className="space-y-2.5">
                <div className="flex items-baseline justify-between gap-2 min-w-0">
                  <label className="text-sm font-semibold text-foreground min-w-0 flex-1 break-words">
                    {group.name}
                    {group.minSelected > 0 && <span className="text-destructive ml-1">*</span>}
                  </label>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {isSingle
                      ? translate('common.selectOne')
                      : group.maxSelected > 0
                        ? translate('takeaway.chooseMax', { count: group.maxSelected })
                        : translate('common.options')}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {group.minSelected === 0 && isSingle && (
                    <button type="button" aria-pressed={selected.length === 0}
                      onClick={() => setSelectedOptions(prev => new Map(prev).set(group.id, []))}
                      className={cn('rounded-lg border p-3 text-left text-sm', selected.length === 0 ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border bg-card text-foreground')}>
                      {translate('common.noExtras')}
                    </button>
                  )}
                  {group.options.map((opt) => {
                    const isChecked = selected.includes(opt.id)
                    return (
                      <button
                        type="button"
                        key={opt.id}
                        aria-pressed={isChecked}
                        onClick={() => toggleOption(group.id, opt.id, group.maxSelected)}
                        className={cn(
                          'flex items-center justify-between gap-3 p-3 rounded-lg border text-left transition-all text-sm min-w-0',
                          isChecked
                            ? 'border-brand-600 bg-brand-50/80 text-brand-950 font-medium ring-1 ring-brand-500'
                            : 'border-border bg-card hover:bg-stone-50 text-foreground',
                        )}
                      >
                        <span className="min-w-0 flex-1 break-words">{opt.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          {Number(opt.priceDelta) > 0 && (
                            <span className="text-brand-700 font-semibold text-xs tabular-nums">
                              +{formatPrice(opt.priceDelta)}
                            </span>
                          )}
                          <span
                            className={cn(
                              'h-4 w-4 flex items-center justify-center transition-colors',
                              isSingle ? 'rounded-full' : 'rounded',
                              isChecked
                                ? 'bg-brand-700 text-white'
                                : 'border border-stone-300 bg-white',
                            )}
                          >
                            {isChecked && <Check className="h-3 w-3" strokeWidth={3} />}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Special note */}
          <div>
            <label
              htmlFor="item-note"
              className="block text-sm font-semibold text-foreground mb-1.5"
            >
              {translate('takeaway.note')}
            </label>
            <Input
              type="text"
              id="item-note"
              placeholder={translate('takeaway.noteExample')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={255}
            />
          </div>

          {/* Quantity */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="text-sm font-semibold text-foreground">
              {translate('common.quantity')}
            </span>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label={translate('takeaway.decreaseItem')}
                disabled={quantity <= 1}
                className="h-8 w-8 rounded-full p-0"
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="text-base font-bold min-w-6 text-center">{quantity}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                aria-label={translate('takeaway.increaseItem')}
                disabled={quantity >= 20}
                className="h-8 w-8 rounded-full p-0"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {errors.length > 0 && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive space-y-1">
              {errors.map((err, i) => (
                <p key={i}>• {err}</p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-stone-50 flex items-center justify-between gap-4">
          <div>
            <span className="text-xs text-muted-foreground block">
              {translate('takeaway.lineTotal')}
            </span>
            <span className="text-lg font-bold text-brand-800">
              {formatLineAmount(unitPrice, quantity)}
            </span>
          </div>

          <Button
            type="button"
            onClick={handleSave}
            disabled={errors.length > 0}
            className="font-semibold"
          >
            {translate('takeaway.addToCart')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
