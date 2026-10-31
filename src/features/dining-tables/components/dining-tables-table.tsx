import { formatSessionDuration, isSessionOver24h } from '@/shared/lib/format'
import { useNavigate } from 'react-router-dom'
import {
  Armchair,
  ArrowRightLeft,
  Edit2,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { type DiningTableAdmin } from '../dining-tables.api'
import { Badge, Button, Card } from '../../../shared/ui'

interface DiningTablesTableProps {
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

export function DiningTablesTable({
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
}: DiningTablesTableProps) {
  const navigate = useNavigate()

  return (
    <Card className="border border-border/80 overflow-hidden shadow-xs">
      <div className="w-full max-w-full overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Tên bàn</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Phiên phục vụ</th>
              <th className="px-4 py-3">Thời lượng</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {tables.map((table) => {
              const activeSession = table.orderSessions?.[0]
              const duration = formatSessionDuration(activeSession?.createdAt)
              const isOver24h = isSessionOver24h(activeSession?.createdAt)

              return (
                <tr key={table.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3.5 max-w-[220px]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Armchair className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span
                          className="font-semibold text-foreground break-words line-clamp-1 block text-sm"
                          title={table.name}
                        >
                          {table.name}
                        </span>
                        <div className="text-[11px] font-mono text-muted-foreground truncate">
                          {table.id.slice(0, 8)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
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
                  </td>
                  <td className="px-4 py-3.5">
                    {activeSession ? (
                      <div className="space-y-0.5">
                        <span className="font-mono text-xs font-medium text-foreground">
                          #{activeSession.id.slice(0, 8)}
                        </span>
                        <div className="text-xs text-muted-foreground">
                          {activeSession.guestCount ? `${activeSession.guestCount} khách • ` : ''}
                          {activeSession.orderItems?.length || 0} món
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <span>{duration || '—'}</span>
                      {isOver24h && (
                        <span
                          className="inline-flex items-center rounded px-1 py-0.2 text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          title="Phiên phục vụ kéo dài trên 24 giờ. Cần kiểm tra hoặc dọn bàn."
                        >
                          &gt; 24h
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {table.status === 'OCCUPIED' && activeSession && canAccessPos && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/staff/pos/sessions/${activeSession.id}`)}
                          className="h-7 px-2.5 text-xs text-amber-700 border-amber-500/30 hover:bg-amber-500/10 dark:text-amber-300 font-medium shadow-xs"
                        >
                          Vào POS
                        </Button>
                      )}
                      {table.status === 'EMPTY' && canAccessPos && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate('/staff/pos')}
                          className="h-7 px-2.5 text-xs text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/10 dark:text-emerald-300 font-medium shadow-xs"
                        >
                          Mở POS
                        </Button>
                      )}
                      {canUpdate && (
                        <button
                          type="button"
                          onClick={() => onEdit(table)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="Đổi tên bàn"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                      {table.status === 'OCCUPIED' && canTransfer && (
                        <button
                          type="button"
                          onClick={() => onTransfer(table)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                          title="Chuyển bàn sang bàn khác"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </button>
                      )}
                      {table.status !== 'EMPTY' && canClear && (
                        <button
                          type="button"
                          onClick={() => onClear(table)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          title="Dọn / Giải phóng bàn"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && table.status === 'EMPTY' && (
                        <button
                          type="button"
                          onClick={() => onDelete(table)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          title="Xóa bàn"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
