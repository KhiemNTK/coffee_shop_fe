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
      <main
        className="flex min-h-[300px] items-center justify-center p-8 text-muted-foreground"
        role="status"
      >
        <p className="animate-pulse">Đang tải danh sách vé bếp…</p>
      </main>
    )
  }

  if (isError) {
    return (
      <main className="space-y-3 py-6 text-center">
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
      <p role="status" className="py-8 text-center text-sm text-muted-foreground">
        Không có vé bếp trong bộ lọc hiện tại.
      </p>
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
