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
  const [targetTableId, setTargetTableId] = useState('')

  if (!open) return null

  const emptyTables =
    tables?.filter((t) => t.status === 'EMPTY' && t.id !== currentTableId) ?? []

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm">
      <DialogHeader>
        <DialogTitle>Chuyển bàn phục vụ</DialogTitle>
        <DialogDescription>
          Bàn hiện tại: <strong className="text-foreground">{currentTableName || 'Không xác định'}</strong>
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 space-y-2">
        <label htmlFor="transferSelect" className="block text-sm font-semibold text-foreground">
          Chọn bàn trống muốn chuyển sang:
        </label>
        <select
          id="transferSelect"
          value={targetTableId}
          onChange={(e) => setTargetTableId(e.target.value)}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <option value="">-- Chọn bàn trống --</option>
          {emptyTables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {emptyTables.length === 0 && (
          <p className="text-xs text-destructive">
            Hiện không có bàn trống nào để chuyển.
          </p>
        )}
      </div>

      <DialogFooter className="mt-6 gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="flex-1 cursor-pointer"
        >
          Hủy
        </Button>
        <Button
          type="button"
          onClick={() => onConfirm(targetTableId)}
          isLoading={isPending}
          disabled={isPending || !targetTableId}
          className="flex-2 cursor-pointer"
        >
          Xác nhận chuyển
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
