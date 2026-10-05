import { ArrowDownToLine, ArrowUpFromLine, RefreshCw } from 'lucide-react'
import { type InventoryTransactionsResponse } from '../inventory.api'
import { formatPrice } from '../../menu/menu.api'
import { formatQuantity } from '../quantity'
import { Badge, Card, CardContent, cn } from '../../../shared/ui'

interface InventoryTransactionsTabProps {
  data?: InventoryTransactionsResponse
  isLoading: boolean
}

export function InventoryTransactionsTab({
  data,
  isLoading,
}: InventoryTransactionsTabProps) {
  return (
    <Card className="border-border/80 shadow-xs overflow-hidden">
      <CardContent className="p-0">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <RefreshCw className="h-6 w-6 animate-spin text-brand-700" />
            <p className="text-sm">Đang tải lịch sử xuất nhập…</p>
          </div>
        )}

        {data && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-stone-50 border-b border-border text-xs uppercase text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Thời gian</th>
                  <th className="py-3.5 px-4">Loại biến động</th>
                  <th className="py-3.5 px-4">Nguyên vật liệu</th>
                  <th className="py-3.5 px-4 text-right">Số lượng</th>
                  <th className="py-3.5 px-4 text-right">Đơn giá nhập</th>
                  <th className="py-3.5 px-4 sm:px-6">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.list.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      Chưa có lịch sử biến động kho.
                    </td>
                  </tr>
                ) : (
                  data.list.map((tx) => (
                    <tr key={tx.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6 text-xs text-muted-foreground">
                        {new Date(tx.transactionDate).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        •{' '}
                        {new Date(tx.transactionDate).toLocaleDateString([], {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-4">
                        {tx.type === 'IMPORT' ? (
                          <Badge variant="success" className="gap-1 text-xs">
                            <ArrowDownToLine className="h-3 w-3" /> Nhập kho
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="gap-1 text-xs text-amber-800 bg-amber-50 border-amber-200"
                          >
                            <ArrowUpFromLine className="h-3 w-3" /> Xuất kho
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-foreground">
                        {tx.inventoryItem?.name ?? 'Nguyên liệu'}
                      </td>
                      <td
                        className={cn(
                          'py-3.5 px-4 text-right font-bold text-sm',
                          tx.type === 'IMPORT' ? 'text-emerald-700' : 'text-amber-800',
                        )}
                      >
                        {tx.type === 'IMPORT' ? '+' : '-'}
                        {formatQuantity(tx.quantity)}{' '}
                        {tx.inventoryItem?.unit?.name}
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs text-muted-foreground">
                        {tx.unitPrice ? formatPrice(String(tx.unitPrice)) : '—'}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-xs text-muted-foreground">
                        {tx.note}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
