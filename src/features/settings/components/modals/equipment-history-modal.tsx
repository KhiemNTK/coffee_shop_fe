import { History } from 'lucide-react'
import type { EquipmentItem, EquipmentEventsResponse } from '@/features/settings/settings.api'
import { errorMessage } from '@/shared/api/client'
import { formatVnd, formatDate } from '@/shared/lib/format'
import { Pagination } from '@/shared/ui/pagination'
import {
  Button,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui'

export interface EquipmentHistoryModalProps {
  equipment: EquipmentItem | null
  onClose: () => void
  eventsError: unknown
  isLoadingEvents: boolean
  isFetchingEvents: boolean
  refetchEvents: () => Promise<unknown>
  equipmentEventsData?: EquipmentEventsResponse | null
  eventsPage: number
  setEventsPage: (page: number) => void
}

export function EquipmentHistoryModal({
  equipment,
  onClose,
  eventsError,
  isLoadingEvents,
  isFetchingEvents,
  refetchEvents,
  equipmentEventsData,
  eventsPage,
  setEventsPage,
}: EquipmentHistoryModalProps) {
  return (
    <Dialog
      open={!!equipment}
      onOpenChange={(open) => !open && onClose()}
      maxWidth="lg"
      className="max-h-[85vh] flex flex-col"
    >
      {equipment && (
        <>
          <DialogHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 mb-2">
              <History className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              Lịch sử bảo trì & vòng đời: {equipment.name}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Mã tài sản:{' '}
              <span className="font-mono">{equipment.assetCode}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex-1 overflow-y-auto pr-1 space-y-3">
            {eventsError ? (
              <p role="alert" className="text-sm text-destructive">
                {errorMessage(eventsError)}{' '}
                <Button
                  variant="outline"
                  onClick={() => void refetchEvents()}
                >
                  Thử lại
                </Button>
              </p>
            ) : isLoadingEvents ? (
              <div className="py-12 text-center text-muted-foreground">
                Đang tải lịch sử sự kiện...
              </div>
            ) : !equipmentEventsData?.list ||
              equipmentEventsData.list.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                Chưa ghi nhận sự kiện bảo trì nào cho thiết bị này.
              </div>
            ) : (
              <div className="relative border-l-2 border-border ml-4 space-y-4 py-2">
                {equipmentEventsData.list.map((ev) => (
                  <div key={ev.id} className="relative pl-6">
                    <div className="absolute -left-2 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-primary" />
                    <div className="rounded-xl border border-border/80 bg-card p-3 shadow-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-xs text-foreground">
                          {ev.fromStatus
                            ? `${ev.fromStatus} → ${ev.toStatus}`
                            : ev.toStatus}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {formatDate(ev.occurredAt || ev.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-foreground/90">
                        {ev.reason}
                      </p>
                      {ev.cost && ev.cost !== '0' && (
                        <div className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                          Chi phí: {formatVnd(ev.cost)}
                        </div>
                      )}
                      <div className="mt-1.5 text-[11px] text-muted-foreground">
                        Thực hiện bởi: {ev.employee?.fullName || 'Hệ thống'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {equipmentEventsData && !eventsError && (
            <Pagination
              page={eventsPage}
              totalPages={equipmentEventsData.totalPages}
              onPage={setEventsPage}
              disabled={isFetchingEvents}
            />
          )}
          <DialogFooter className="mt-6 flex justify-end pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Đóng
            </Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  )
}
