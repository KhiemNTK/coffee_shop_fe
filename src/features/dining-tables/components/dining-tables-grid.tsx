import { useNavigate } from 'react-router-dom'
import {
  Armchair,
  ArrowRightLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Coffee,
  Edit2,
  RotateCcw,
  Trash2,
  Users,
  UtensilsCrossed,
} from 'lucide-react'
import { type DiningTableAdmin } from '../dining-tables.api'
import { Badge, Button } from '../../../shared/ui'
import { cn } from '../../../shared/ui/utils'
import { formatSessionDuration } from '../../../shared/lib/format'

interface DiningTablesGridProps {
  tables: DiningTableAdmin[]
  canAccessPos: boolean
  canUpdate: boolean
  canTransfer: boolean
  canClear: boolean
  canDelete: boolean
  onEdit: (table: DiningTableAdmin) => void
  onTransfer: (table: DiningTableAdmin) => void
  onClear: (table: DiningTableAdmin) => void
  onDelete: (table: DiningTableAdmin) => void
}

export function DiningTablesGrid({
  tables,
  canAccessPos,
  canUpdate,
  canTransfer,
  canClear,
  canDelete,
  onEdit,
  onTransfer,
  onClear,
  onDelete,
}: DiningTablesGridProps) {
  const navigate = useNavigate()

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {tables.map((table) => {
        const activeSession = table.orderSessions?.[0]
        const orderItemsCount = activeSession?.orderItems?.length ?? 0
        const sessionDuration = formatSessionDuration(activeSession?.createdAt)

        return (
          <div
            key={table.id}
            className={cn(
              'group relative flex flex-col justify-between rounded-2xl border-2 bg-card p-4 transition-all duration-200 hover:shadow-md',
              table.status === 'OCCUPIED'
                ? 'border-amber-400 bg-amber-50/40 shadow-xs'
                : table.status === 'RESERVED'
                  ? 'border-purple-400 bg-purple-50/40 shadow-xs'
                  : 'border-emerald-500/50 bg-card hover:border-emerald-600 shadow-xs',
            )}
          >
            {/* Card Top: Name & Status */}
            <div>
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold text-sm shadow-xs',
                      table.status === 'OCCUPIED'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200'
                        : table.status === 'RESERVED'
                          ? 'bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-950 dark:text-purple-200'
                          : 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200',
                    )}
                  >
                    <Armchair className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3
                      className="font-bold text-base text-foreground leading-tight break-words line-clamp-2"
                      title={table.name}
                    >
                      {table.name}
                    </h3>
                    <span className="text-[11px] text-foreground/75 font-mono truncate block font-medium">
                      ID: {table.id.slice(0, 8)}
                    </span>
                  </div>
                </div>

                {/* Status Pill Badge */}
                <div className="shrink-0">
                  {table.status === 'EMPTY' && (
                    <Badge
                      variant="outline"
                      className="border-emerald-300 bg-emerald-100/80 text-emerald-900 font-bold dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200 text-[11px]"
                    >
                      Trống
                    </Badge>
                  )}
                  {table.status === 'OCCUPIED' && (
                    <Badge
                      variant="outline"
                      className="border-amber-300 bg-amber-100/80 text-amber-900 font-bold dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200 text-[11px]"
                    >
                      Có khách
                    </Badge>
                  )}
                  {table.status === 'RESERVED' && (
                    <Badge
                      variant="outline"
                      className="border-purple-300 bg-purple-100/80 text-purple-900 font-bold dark:border-purple-700 dark:bg-purple-950/60 dark:text-purple-200 text-[11px]"
                    >
                      Đặt trước
                    </Badge>
                  )}
                </div>
              </div>

              {/* Card Middle: Active Session Details if OCCUPIED */}
              <div className="mt-3.5 space-y-2 border-t border-border/60 pt-3 text-xs">
                {table.status === 'OCCUPIED' && (
                  <div className="space-y-1.5 rounded-xl bg-amber-100/60 p-2.5 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/40">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 font-semibold text-amber-950 dark:text-amber-200">
                        <Clock className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                        Đã ngồi:
                      </span>
                      <span className="font-bold text-foreground">
                        {sessionDuration || 'Vừa vào'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 font-semibold text-amber-950 dark:text-amber-200">
                        <Users className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                        Số khách:
                      </span>
                      <span className="font-bold text-foreground">
                        {activeSession?.guestCount ? `${activeSession.guestCount} người` : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 font-semibold text-amber-950 dark:text-amber-200">
                        <UtensilsCrossed className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                        Số món:
                      </span>
                      <span className="font-bold text-amber-900 dark:text-amber-300">
                        {orderItemsCount} món
                      </span>
                    </div>
                  </div>
                )}

                {table.status === 'EMPTY' && (
                  <div className="flex items-center gap-1.5 py-2 font-semibold text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Sẵn sàng đón tiếp khách mới</span>
                  </div>
                )}

                {table.status === 'RESERVED' && (
                  <div className="flex items-center gap-1.5 py-2 font-semibold text-purple-900 dark:text-purple-200">
                    <Calendar className="h-4 w-4 shrink-0 text-purple-700" />
                    <span>Đã được giữ chỗ theo lịch</span>
                  </div>
                )}
              </div>
            </div>

            {/* Card Bottom Actions */}
            <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-3">
              {/* Primary Workflow Button */}
              {table.status === 'OCCUPIED' && activeSession && canAccessPos && (
                <Button
                  size="sm"
                  onClick={() => navigate(`/staff/pos/sessions/${activeSession.id}`)}
                  className="w-full gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs h-8"
                >
                  <UtensilsCrossed className="h-3.5 w-3.5" />
                  Vào đơn POS
                </Button>
              )}

              {table.status === 'EMPTY' && canAccessPos && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/staff/pos')}
                  className="w-full gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-300 dark:border-emerald-800 text-xs h-8"
                >
                  <Coffee className="h-3.5 w-3.5" />
                  Mở bàn tại POS
                </Button>
              )}

              {table.status === 'RESERVED' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/staff/reservations')}
                  className="w-full gap-1.5 text-purple-700 border-purple-300 hover:bg-purple-50 dark:text-purple-300 dark:border-purple-800 text-xs h-8"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Xem lịch đặt bàn
                </Button>
              )}

              {/* Secondary Table Management Actions */}
              <div className="flex items-center justify-between gap-1 pt-1">
                <div className="flex items-center gap-1">
                  {/* Edit Name */}
                  {canUpdate && (
                    <button
                      type="button"
                      onClick={() => onEdit(table)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Đổi tên bàn"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* Transfer Table (if occupied) */}
                  {table.status === 'OCCUPIED' && canTransfer && (
                    <button
                      type="button"
                      onClick={() => onTransfer(table)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-amber-100 hover:text-amber-800 dark:hover:bg-amber-950 transition-colors"
                      title="Chuyển bàn sang bàn khác"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* Clear Table (if occupied or reserved) */}
                  {table.status !== 'EMPTY' && canClear && (
                    <button
                      type="button"
                      onClick={() => onClear(table)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      title="Dọn / Giải phóng bàn"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Delete Table (Backend only permits deleting EMPTY tables) */}
                {canDelete && table.status === 'EMPTY' && (
                  <button
                    type="button"
                    onClick={() => onDelete(table)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    title="Xóa bàn"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
