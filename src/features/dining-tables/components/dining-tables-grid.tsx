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
            className={`group relative flex flex-col justify-between rounded-2xl border bg-card p-4 transition-all duration-200 hover:shadow-md ${
              table.status === 'OCCUPIED'
                ? 'border-amber-300 dark:border-amber-800/80 shadow-xs'
                : table.status === 'RESERVED'
                  ? 'border-purple-300 dark:border-purple-800/80'
                  : 'border-border/80 hover:border-emerald-300 dark:hover:border-emerald-800'
            }`}
          >
            {/* Card Top: Name & Status */}
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold text-sm ${
                      table.status === 'OCCUPIED'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : table.status === 'RESERVED'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}
                  >
                    <Armchair className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-foreground leading-tight">
                      {table.name}
                    </h3>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      ID: {table.id.slice(0, 8)}
                    </span>
                  </div>
                </div>

                {/* Status Pill Badge */}
                <div>
                  {table.status === 'EMPTY' && (
                    <Badge
                      variant="outline"
                      className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-[11px]"
                    >
                      Trống
                    </Badge>
                  )}
                  {table.status === 'OCCUPIED' && (
                    <Badge
                      variant="outline"
                      className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-[11px]"
                    >
                      Có khách
                    </Badge>
                  )}
                  {table.status === 'RESERVED' && (
                    <Badge
                      variant="outline"
                      className="border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 text-[11px]"
                    >
                      Đặt trước
                    </Badge>
                  )}
                </div>
              </div>

              {/* Card Middle: Active Session Details if OCCUPIED */}
              <div className="mt-3.5 space-y-2 border-t border-border/50 pt-3 text-xs">
                {table.status === 'OCCUPIED' && (
                  <div className="space-y-1.5 rounded-xl bg-amber-50/50 p-2.5 dark:bg-amber-950/20">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        Đã ngồi:
                      </span>
                      <span className="font-medium text-foreground">
                        {sessionDuration || 'Vừa vào'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        Số khách:
                      </span>
                      <span className="font-medium text-foreground">
                        {activeSession?.guestCount ? `${activeSession.guestCount} người` : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <UtensilsCrossed className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        Số món:
                      </span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">
                        {orderItemsCount} món
                      </span>
                    </div>
                  </div>
                )}

                {table.status === 'EMPTY' && (
                  <div className="flex items-center gap-1.5 py-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Sẵn sàng đón tiếp khách mới</span>
                  </div>
                )}

                {table.status === 'RESERVED' && (
                  <div className="flex items-center gap-1.5 py-2 text-purple-700 dark:text-purple-300">
                    <Calendar className="h-4 w-4" />
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
