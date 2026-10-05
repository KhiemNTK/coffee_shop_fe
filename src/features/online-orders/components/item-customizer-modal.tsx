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
      errors.push(`Vui lòng chọn ít nhất ${group.minSelected} tùy chọn cho "${group.name}".`)
    }
    if (group.maxSelected > 0 && selected.length > group.maxSelected) {
      errors.push(`Chỉ được chọn tối đa ${group.maxSelected} tùy chọn cho "${group.name}".`)
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
    <Dialog open onClose={onClose} maxWidth="md" label={'Tùy chọn ' + item.name} showCloseButton={false}>
      <div className="flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-brand-900">{item.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Giá cơ bản:{' '}
              <span className="font-semibold text-brand-700">{formatPrice(item.price)}</span>
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Đóng tùy chọn món" className="h-8 w-8 p-0 rounded-full">
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
                <div className="flex items-baseline justify-between">
                  <label className="text-sm font-semibold text-foreground">
                    {group.name}
                    {group.minSelected > 0 && <span className="text-destructive ml-1">*</span>}
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {isSingle
                      ? 'Chọn 1'
                      : group.maxSelected > 0
                        ? `Chọn tối đa ${group.maxSelected}`
                        : 'Tùy chọn'}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {group.options.map((opt) => {
                    const isChecked = selected.includes(opt.id)
                    return (
                      <button
                        type="button"
                        key={opt.id}
                        aria-pressed={isChecked}
                        onClick={() => toggleOption(group.id, opt.id, group.maxSelected)}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg border text-left transition-all text-sm',
                          isChecked
                            ? 'border-brand-600 bg-brand-50/80 text-brand-950 font-medium ring-1 ring-brand-500'
                            : 'border-border bg-card hover:bg-stone-50 text-foreground',
                        )}
                      >
                        <span>{opt.name}</span>
                        <div className="flex items-center gap-2">
                          {Number(opt.priceDelta) > 0 && (
                            <span className="text-brand-700 font-semibold text-xs">
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
            <label htmlFor="item-note" className="block text-sm font-semibold text-foreground mb-1.5">
              Ghi chú cho quán (nếu có)
            </label>
            <Input
              type="text"
              id="item-note"
              placeholder="VD: Ít đá, nhiều đường, mang đi xa..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={255}
            />
          </div>

          {/* Quantity */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="text-sm font-semibold text-foreground">Số lượng</span>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Giảm số lượng món"
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
                aria-label="Tăng số lượng món"
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
            <span className="text-xs text-muted-foreground block">Tổng tiền món:</span>
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
            Thêm vào giỏ
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
