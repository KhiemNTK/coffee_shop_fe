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
import type { DiningTable } from '../pos.api'

interface PosTransferDialogProps {
  open: boolean
  currentTableName?: string
  currentTableId?: string
  tables?: DiningTable[]
  onClose: () => void
  onConfirm: (targetTableId: string) => void
  isPending: boolean
}

export function PosTransferDialog({
  open,
  currentTableName,
  currentTableId,
  tables,
  onClose,
  onConfirm,
  isPending,
}: PosTransferDialogProps) {
  const { t: translate } = useTranslation()
  const [targetTableId, setTargetTableId] = useState('')

  if (!open) return null

  const emptyTables = tables?.filter((t) => t.status === 'EMPTY' && t.id !== currentTableId) ?? []

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm">
      <DialogHeader>
        <DialogTitle>{translate('pos.transferHeading')}</DialogTitle>
        <DialogDescription>
          {translate('pos.currentTable')}{' '}
          <strong className="text-foreground">
            {currentTableName || translate('common.unknown')}
          </strong>
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 space-y-2">
        <label htmlFor="transferSelect" className="block text-sm font-semibold text-foreground">
          {translate('pos.chooseEmptyTable')}
        </label>
        <select
          id="transferSelect"
          value={targetTableId}
          onChange={(e) => setTargetTableId(e.target.value)}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <option value="">{translate('pos.chooseEmptyPlaceholder')}</option>
          {emptyTables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {emptyTables.length === 0 && (
          <p className="text-xs text-destructive">{translate('pos.noEmptyTable')}</p>
        )}
      </div>

      <DialogFooter className="mt-6 gap-2">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1 cursor-pointer">
          {translate('common.cancel')}
        </Button>
        <Button
          type="button"
          onClick={() => onConfirm(targetTableId)}
          isLoading={isPending}
          disabled={isPending || !targetTableId}
          className="flex-2 cursor-pointer"
        >
          {translate('pos.confirmTransfer')}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
