import { formatSessionDuration, isSessionOver24h } from '@/shared/lib/format'
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
        const isOver24h = isSessionOver24h(activeSession?.createdAt)

        return (
          <div
            key={table.id}
            className={cn(
              'group relative flex flex-col justify-between rounded-2xl border bg-card p-4 transition-all duration-200 hover:shadow-md',
              table.status === 'OCCUPIED'
                ? 'border-amber-500/40 bg-card hover:border-amber-500/70 shadow-xs'
                : table.status === 'RESERVED'
                  ? 'border-purple-500/40 bg-card hover:border-purple-500/70 shadow-xs'
                  : 'border-border/80 bg-card hover:border-emerald-500/50 shadow-xs',
            )}
          >
            {/* Card Top: Name & Status */}
            <div>
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold text-sm shadow-xs transition-colors',
                      table.status === 'OCCUPIED'
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                        : table.status === 'RESERVED'
                          ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20'
                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
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
                    <span className="text-[11px] text-muted-foreground font-mono truncate block font-medium">
                      ID: {table.id.slice(0, 8)}
                    </span>
                  </div>
                </div>

                {/* Status Pill Badge */}
                <div className="shrink-0">
                  {table.status === 'EMPTY' && (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-semibold text-[11px] gap-1"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Trống
                    </Badge>
                  )}
                  {table.status === 'OCCUPIED' && (
                    <Badge
                      variant="outline"
                      className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 font-semibold text-[11px] gap-1"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Có khách
                    </Badge>
                  )}
                  {table.status === 'RESERVED' && (
                    <Badge
                      variant="outline"
                      className="border-purple-500/30 bg-purple-500/10 text-purple-800 dark:text-purple-300 font-semibold text-[11px] gap-1"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                      Đặt trước
                    </Badge>
                  )}
                </div>
              </div>

              {/* Card Middle: Active Session Details if OCCUPIED */}
              <div className="mt-3.5 space-y-2 border-t border-border/60 pt-3 text-xs">
                {table.status === 'OCCUPIED' && (
                  <div className="space-y-2 rounded-xl bg-muted/40 p-2.5 border border-border/60">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 font-medium text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        Đã ngồi:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground">
                          {sessionDuration || 'Vừa vào'}
                        </span>
                        {isOver24h && (
                          <span
                            className="inline-flex items-center rounded px-1 py-0.2 text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400"
                            title="Phiên phục vụ kéo dài trên 24 giờ. Cần kiểm tra hoặc dọn bàn."
                          >
                            &gt; 24h
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 font-medium text-muted-foreground">
                        <Users className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        Số khách:
                      </span>
                      <span className="font-bold text-foreground">
                        {activeSession?.guestCount ? `${activeSession.guestCount} người` : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 font-medium text-muted-foreground">
                        <UtensilsCrossed className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        Số món:
                      </span>
                      <span className="font-bold text-foreground">
                        {orderItemsCount} món
                      </span>
                    </div>
                  </div>
                )}

                {table.status === 'EMPTY' && (
                  <div className="flex items-center gap-2 py-2 font-medium text-xs text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Sẵn sàng đón tiếp khách mới</span>
                  </div>
                )}

                {table.status === 'RESERVED' && (
                  <div className="flex items-center gap-2 py-2 font-medium text-xs text-muted-foreground">
                    <Calendar className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
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
                  className="w-full gap-1.5 bg-[#E87800] hover:bg-[#d06b00] text-white text-xs h-8 shadow-xs font-semibold"
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
                  className="w-full gap-1.5 text-primary border-primary/40 hover:bg-primary/5 text-xs h-8 shadow-xs font-semibold"
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
                  className="w-full gap-1.5 text-purple-700 border-purple-500/30 hover:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/30 text-xs h-8 shadow-xs"
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
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
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
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
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
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
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
