import { Ban, Clock, Coins, FileText } from 'lucide-react'
import { formatPrice } from '../../menu/menu.api'

export function InvoicesKpis({ totalPaidAmount, totalItems, unpaidCount, voidedCount }: {
  totalPaidAmount: string; totalItems: number; unpaidCount: number; voidedCount: number
}) {
  const stats = [
    { label: 'Giá trị đã thu · trang này', value: formatPrice(totalPaidAmount), icon: Coins, color: 'text-primary' },
    { label: 'Hóa đơn theo bộ lọc', value: String(totalItems), icon: FileText, color: 'text-foreground' },
    { label: 'Chờ thanh toán · trang này', value: String(unpaidCount), icon: Clock, color: 'text-amber-800' },
    { label: 'Hủy / hoàn tiền · trang này', value: String(voidedCount), icon: Ban, color: 'text-rose-800' },
  ]
  return <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-border py-5 lg:grid-cols-4">
    {stats.map(({ label, value, icon: Icon, color }) => <div key={label} className="min-w-0">
      <dt className="flex items-center gap-2 text-xs text-muted-foreground"><Icon size={15} aria-hidden="true" />{label}</dt>
      <dd className={`mt-2 break-words text-xl font-semibold tabular-nums ${color}`}>{value}</dd>
    </div>)}
  </dl>
}
