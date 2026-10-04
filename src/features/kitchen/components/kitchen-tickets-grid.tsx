import { Sparkles } from 'lucide-react'
import { Button } from '../../../shared/ui/button'
import { errorMessage } from '../../../shared/api/client'
import type { KitchenTicket, KitchenTicketItem } from '../kitchen.api'
import { KitchenTicketCard } from './kitchen-ticket-card'

interface KitchenTicketsGridProps {
  tickets: KitchenTicket[]
  isLoading: boolean
  isError: boolean
  error: unknown
  onRetry: () => void
  nowMs: number
  onAdvanceItemStatus: (item: KitchenTicketItem) => void
  isUpdatingStatus?: boolean
}

export function KitchenTicketsGrid({
  tickets,
  isLoading,
  isError,
  error,
  onRetry,
  nowMs,
  onAdvanceItemStatus,
  isUpdatingStatus = false,
}: KitchenTicketsGridProps) {
  if (isLoading) {
    return (
      <main className="flex min-h-[300px] items-center justify-center p-8 text-muted-foreground" role="status">
        <p className="animate-pulse">Đang tải danh sách vé bếp…</p>
      </main>
    )
  }

  if (isError) {
    return (
      <main className="mx-auto my-12 max-w-md rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
        <p className="font-semibold text-destructive" role="alert">
          {errorMessage(error)}
        </p>
        <Button onClick={onRetry} className="mt-4 cursor-pointer">
          Thử lại
        </Button>
      </main>
    )
  }

  if (tickets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <Sparkles className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
        <h2 className="text-lg font-bold text-primary mb-1">
          Bếp đang rảnh rỗi!
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Không có món nào đang chờ chế biến. Các món mới khi order sẽ xuất hiện tức thì tại đây qua kết nối realtime.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {tickets.map((ticket) => (
        <KitchenTicketCard
          key={ticket.id}
          ticket={ticket}
          nowMs={nowMs}
          onAdvanceItemStatus={onAdvanceItemStatus}
          isUpdatingStatus={isUpdatingStatus}
        />
      ))}
    </div>
  )
}
