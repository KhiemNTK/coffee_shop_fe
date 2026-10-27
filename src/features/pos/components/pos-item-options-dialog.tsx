import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../../shared/ui/dialog'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { cn } from '../../../shared/ui/utils'
import { formatPrice, type MenuItem } from '../../menu/menu.api'
import { decimalAmount, minorAmount } from '../../../shared/lib/money'

interface PosItemOptionsDialogProps {
  item: MenuItem | null
  onClose: () => void
  onConfirm: (
    item: MenuItem,
    selectedOptionIds: string[],
    note: string,
    calculatedPrice: string,
  ) => void
}

interface PosItemOptionsContentProps {
  item: MenuItem
  onClose: () => void
  onConfirm: (
    item: MenuItem,
    selectedOptionIds: string[],
    note: string,
    calculatedPrice: string,
  ) => void
}

function PosItemOptionsContent({ item, onClose, onConfirm }: PosItemOptionsContentProps) {
  const { t: translate } = useTranslation()
  const [configuredOptions, setConfiguredOptions] = useState<Record<string, string[]>>({})
  const [configuredNote, setConfiguredNote] = useState('')

  // Calculate live total price based on base price + selected options
  const allSelectedIds = Object.values(configuredOptions).flat()
  let livePrice = minorAmount(item.price)
  for (const group of item.optionGroups) {
    for (const opt of group.options) {
      if (allSelectedIds.includes(opt.id)) {
        livePrice += minorAmount(opt.priceDelta)
      }
    }
  }

  function handleConfirm() {
    onConfirm(item, allSelectedIds, configuredNote, decimalAmount(livePrice))
    onClose()
  }

  return (
    <div>
      <DialogHeader>
        <DialogTitle>{item.name}</DialogTitle>
        <DialogDescription>
          {translate('takeaway.basePrice')}{' '}
          <strong className="text-primary font-bold">{formatPrice(item.price)}</strong>
          {livePrice !== minorAmount(item.price) && (
            <span className="ml-2 text-foreground font-semibold">
              {translate('pos.totalArrow')}{' '}
              <strong className="text-primary font-bold">
                {formatPrice(decimalAmount(livePrice))}
              </strong>
            </span>
          )}
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 space-y-4 max-h-95 overflow-y-auto pr-1">
        {item.optionGroups.map((group) => (
          <div key={group.id} className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {group.name}{' '}
              {group.maxSelected === 1
                ? translate('common.selectOneParen')
                : `(Tối đa ${group.maxSelected})`}
            </span>
            <div className="space-y-1.5">
              {group.minSelected === 0 && group.maxSelected === 1 && (
                <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3.5 py-2.5 text-sm">
                  <input type="radio" name={`option-group-${group.id}`} checked={!configuredOptions[group.id]?.length}
                    onChange={() => setConfiguredOptions(prev => ({ ...prev, [group.id]: [] }))}
                    className="h-4 w-4 accent-primary" />
                  {translate('common.noExtras')}
                </label>
              )}
              {group.options.map((opt) => {
                const isSelected = configuredOptions[group.id]?.includes(opt.id) ?? false
                return (
                  <label
                    key={opt.id}
                    className={cn(
                      'flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-xs transition-all active:scale-[0.99] min-w-0',
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary'
                        : 'border-border bg-card text-foreground hover:bg-muted',
                    )}
                  >
                    <span className="flex items-center gap-2.5 min-w-0 flex-1">
                      <input
                        type={group.maxSelected === 1 ? 'radio' : 'checkbox'}
                        name={`option-group-${group.id}`}
                        checked={isSelected}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setConfiguredOptions((prev) => {
                            const current = prev[group.id] || []
                            if (group.maxSelected === 1) {
                              return {
                                ...prev,
                                [group.id]: checked ? [opt.id] : [],
                              }
                            }
                            if (checked) {
                              return {
                                ...prev,
                                [group.id]: [...current, opt.id],
                              }
                            }
                            return {
                              ...prev,
                              [group.id]: current.filter((id) => id !== opt.id),
                            }
                          })
                        }}
                        className="h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary cursor-pointer"
                      />
                      <span className="text-sm font-medium break-words">{opt.name}</span>
                    </span>
                    <span className="text-xs font-bold text-primary shrink-0 tabular-nums">
                      +{formatPrice(opt.priceDelta)}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        ))}

        <div className="space-y-1.5 pt-2">
          <label
            htmlFor="configuredNote"
            className="block text-xs font-bold text-muted-foreground uppercase tracking-wider"
          >
            {translate('pos.extraNote')}
          </label>
          <Input
            id="configuredNote"
            type="text"
            maxLength={255}
            placeholder={translate('pos.noteExample')}
            value={configuredNote}
            onChange={(e) => setConfiguredNote(e.target.value)}
            className="min-h-[42px]"
          />
        </div>
      </div>

      <DialogFooter className="mt-6 gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="flex-1 min-h-[44px] cursor-pointer font-medium"
        >
          {translate('common.cancel')}
        </Button>
        <Button
          type="button"
          onClick={handleConfirm}
          className="flex-2 min-h-[44px] cursor-pointer font-bold"
        >
          {translate('pos.addToOrderPrefix')}
          {formatPrice(decimalAmount(livePrice))})
        </Button>
      </DialogFooter>
    </div>
  )
}

export function PosItemOptionsDialog({ item, onClose, onConfirm }: PosItemOptionsDialogProps) {
  if (!item) return null

  return (
    <Dialog open={Boolean(item)} onClose={onClose} maxWidth="sm">
      <PosItemOptionsContent key={item.id} item={item} onClose={onClose} onConfirm={onConfirm} />
    </Dialog>
  )
}
