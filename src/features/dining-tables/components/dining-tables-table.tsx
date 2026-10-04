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
import { formatSessionDuration } from '../../../shared/lib/format'

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
          <tbody className="divide-y divide-border">
            {tables.map((table) => {
              const activeSession = table.orderSessions?.[0]
              const duration = formatSessionDuration(activeSession?.createdAt)

              return (
                <tr key={table.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <Armchair className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="font-semibold text-foreground">{table.name}</span>
                        <div className="text-[11px] font-mono text-muted-foreground">
                          {table.id.slice(0, 8)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    {table.status === 'EMPTY' && (
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      >
                        Trống
                      </Badge>
                    )}
                    {table.status === 'OCCUPIED' && (
                      <Badge
                        variant="outline"
                        className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                      >
                        Có khách
                      </Badge>
                    )}
                    {table.status === 'RESERVED' && (
                      <Badge
                        variant="outline"
                        className="border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                      >
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
                    {duration || '—'}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {table.status === 'OCCUPIED' && activeSession && canAccessPos && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/staff/pos/sessions/${activeSession.id}`)}
                          className="h-7 px-2.5 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                        >
                          Vào POS
                        </Button>
                      )}
                      {table.status === 'EMPTY' && canAccessPos && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate('/staff/pos')}
                          className="h-7 px-2.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                        >
                          Mở POS
                        </Button>
                      )}
                      {canUpdate && (
                        <button
                          type="button"
                          onClick={() => onEdit(table)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Sửa tên bàn"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                      {table.status === 'OCCUPIED' && canTransfer && (
                        <button
                          type="button"
                          onClick={() => onTransfer(table)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-amber-100 hover:text-amber-800"
                          title="Chuyển bàn"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </button>
                      )}
                      {table.status !== 'EMPTY' && canClear && (
                        <button
                          type="button"
                          onClick={() => onClear(table)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Dọn / Giải phóng bàn"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && table.status === 'EMPTY' && (
                        <button
                          type="button"
                          onClick={() => onDelete(table)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
