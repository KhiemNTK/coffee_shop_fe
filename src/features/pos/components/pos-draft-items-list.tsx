import { Minus, Plus, Send } from 'lucide-react'
import { Button } from '../../../shared/ui/button'
import { formatPrice } from '../../menu/menu.api'
import type { DraftItem } from '../pos.types'

interface PosDraftItemsListProps {
  draftItems: DraftItem[]
  onUpdateQuantity: (draftId: string, delta: number) => void
  onClearDraft: () => void
  onSubmitOrder: () => void
  isSubmitting: boolean
}

export function PosDraftItemsList({
  draftItems,
  onUpdateQuantity,
  onClearDraft,
  onSubmitOrder,
  isSubmitting,
}: PosDraftItemsListProps) {
  if (draftItems.length === 0) return null

  return (
    <div className="mt-5 border-t-2 border-dashed border-primary/20 pt-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-primary">
          Món mới chọn ({draftItems.length})
        </span>
        <button
          type="button"
          onClick={onClearDraft}
          className="text-xs font-semibold text-destructive hover:underline cursor-pointer"
        >
          Xóa tất cả
        </button>
      </div>

      <div className="space-y-2 mb-3 max-h-[220px] overflow-y-auto pr-1">
        {draftItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-2.5"
          >
            <div>
              <strong className="text-sm font-semibold text-foreground">
                {item.menuItem.name}
              </strong>
              {item.note && (
                <small className="block text-xs text-muted-foreground">
                  {item.note}
                </small>
              )}
              <div className="mt-0.5 text-xs font-bold text-primary">
                {formatPrice(String(item.calculatedPrice * item.quantity))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onUpdateQuantity(item.id, -1)}
                className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-muted cursor-pointer"
                aria-label="Giảm số lượng"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-5 text-center text-xs font-bold text-foreground">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => onUpdateQuantity(item.id, 1)}
                className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-muted cursor-pointer"
                aria-label="Tăng số lượng"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        onClick={onSubmitOrder}
        isLoading={isSubmitting}
        className="w-full flex items-center justify-center gap-2 cursor-pointer"
      >
        <Send className="h-4 w-4" />
        {isSubmitting ? 'Đang gửi món…' : 'Gửi order vào bếp'}
      </Button>
    </div>
  )
}
