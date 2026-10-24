import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Minus,
  Plus,
  X,
} from 'lucide-react'
import { formatPrice, type MenuItem } from '../menu.api'
import { Button, Dialog, cn } from '../../../shared/ui'
import { type CartItem, decimalAmount, minorAmount } from '../../online-orders/cart'
import { FavoriteButton } from '../../customers/favorite-button'
import { ProductImage } from './product-image'

export function ProductDetailModal({
  item,
  onClose,
  onConfirm,
}: {
  item: MenuItem
  onClose: () => void
  onConfirm: (cartItem: CartItem) => void
}) {
  const { t } = useTranslation()
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState('')

  // Map optionGroupId -> selected optionId(s)
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

  // Dynamic price calculation
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
  const totalPrice = decimalAmount((basePrice + deltaSum) * BigInt(quantity))

  // Validation
  const errors: string[] = []
  item.optionGroups.forEach((group) => {
    const selected = selectedOptions.get(group.id) ?? []
    if (group.minSelected > 0 && selected.length < group.minSelected) {
      errors.push(t('storefront.optionMinimum', { count: group.minSelected, group: group.name }))
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
          if (maxSelected > 0 && current.length >= maxSelected) return prev
          next.set(groupId, [...current, optionId])
        }
      }
      return next
    })
  }

  function handleAdd() {
    if (errors.length > 0) return
    const allSelectedIds: string[] = []
    selectedOptions.forEach((ids) => allSelectedIds.push(...ids))

    onConfirm({
      id: `${item.id}-${crypto.randomUUID()}`,
      menuItem: item,
      quantity,
      note: note.trim(),
      selectedOptionIds: allSelectedIds,
      calculatedUnitPrice: unitPrice,
    })
  }

  return (
    <Dialog open onClose={onClose} maxWidth="xl" showCloseButton={false}>
      <div className="relative p-2 sm:p-4">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label={t('common.close')}
          title={t('common.close')}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Breadcrumbs */}
        <nav className="mb-4 flex flex-wrap items-center gap-1.5 break-words pr-10 text-xs font-semibold text-muted-foreground">
          <span>{t('nav.menu')}</span>
          <span>&gt;</span>
          <span>{item.category.name}</span>
          <span>&gt;</span>
          <span className="text-foreground">{item.name}</span>
        </nav>

        {/* 2-Column Product Detail Layout matching Mockup Panel 3 */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 items-start">
          <div className="md:col-span-6 flex flex-col gap-4">
            <div className="relative aspect-square w-full rounded-[14px] border border-border/80 overflow-hidden bg-surface-muted shadow-xs">
              <ProductImage item={item} />
            </div>
          </div>

          {/* Right Column: Title, Price, Option Pills, Toppings */}
          <div className="md:col-span-6 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="min-w-0 flex-1 break-words text-xl sm:text-2xl font-extrabold text-foreground leading-tight">
                  {item.name}
                </h2>
                <FavoriteButton itemId={item.id} />
              </div>

              <p className="mt-2 text-2xl font-extrabold text-primary tabular-nums">
                {formatPrice(unitPrice)}
              </p>

              {item.description && <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {item.description}
              </p>}

              {/* Option Groups (Size, Sugar, Ice, Toppings) */}
              <div className="mt-5 space-y-4 max-h-[320px] overflow-y-auto pr-1">
                {item.optionGroups.map((group) => {
                  const selectedIds = selectedOptions.get(group.id) ?? []

                  return (
                    <div key={group.id} className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-foreground">
                          {group.name}
                        </span>
                        {group.minSelected > 0 && (
                          <span className="text-[11px] font-semibold text-accent">
                            {t('storefront.required')}
                          </span>
                        )}
                      </div>

                      {/* Pill options (Size, Sugar, Ice, etc.) */}
                      <div className="flex flex-wrap gap-2">
                        {group.options.map((opt) => {
                          const isSelected = selectedIds.includes(opt.id)

                          return (
                            <button
                              key={opt.id}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() =>
                                toggleOption(group.id, opt.id, group.maxSelected)
                              }
                              className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer',
                                isSelected
                                  ? 'border-primary bg-primary text-white shadow-xs'
                                  : 'border-border bg-card text-foreground hover:bg-muted/80',
                              )}
                            >
                              <span>{opt.name}</span>
                              {Number(opt.priceDelta) > 0 && (
                                <span
                                  className={cn(
                                    'text-[10px] tabular-nums',
                                    isSelected
                                      ? 'text-emerald-200'
                                      : 'text-primary font-bold',
                                  )}
                                >
                                  +{formatPrice(opt.priceDelta)}
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                {/* Special Note */}
                <div className="pt-2">
                  <label htmlFor="product-note" className="block text-xs font-bold text-foreground mb-1.5">
                    {t('storefront.note')}
                  </label>
                  <input
                    type="text"
                    id="product-note"
                    maxLength={150}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t('storefront.notePlaceholder')}
                    className="w-full rounded-[10px] border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-primary placeholder:text-muted-foreground"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Actions: Stepper + Big Add Button */}
            <div className="mt-6 pt-4 border-t border-border flex items-center gap-3">
              {/* Stepper */}
              <div className="flex items-center rounded-[10px] border border-border bg-card p-1 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label={t('common.decreaseQuantity')}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                  disabled={quantity <= 1}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-9 text-center text-sm font-bold tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                  aria-label={t('common.increaseQuantity')}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                  disabled={quantity >= 20}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Add to Cart CTA */}
              <Button
                type="button"
                onClick={handleAdd}
                disabled={errors.length > 0}
                className="min-h-11 h-auto min-w-0 flex-1 flex-col gap-0.5 whitespace-normal rounded-[10px] bg-primary px-3 py-2 text-sm font-bold text-white shadow-md hover:bg-primary-hover sm:flex-row sm:gap-2"
              >
                <span>{t('storefront.addToCart')}</span>
                <span className="min-w-0 break-all tabular-nums">{formatPrice(totalPrice)}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
