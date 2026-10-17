import { AlertTriangle, FileText, PackageCheck } from 'lucide-react'
import { OperationsSummary } from '../../../shared/ui'

export function InventoryKpis({
  totalItems,
  alertCount,
  categoriesCount,
}: {
  totalItems?: number
  alertCount?: number
  categoriesCount?: number
}) {
  return (
    <OperationsSummary
      label="Tổng quan tồn kho"
      variant="cards"
      metrics={[
        { label: 'Nguyên liệu khớp bộ lọc', value: totalItems ?? '—', icon: PackageCheck },
        {
          label: 'Cần nhập hàng (Sắp hết)',
          value: alertCount == null ? '—' : alertCount + ' mặt hàng',
          icon: AlertTriangle,
          tone: alertCount ? 'warning' : undefined,
        },
        {
          label: 'Danh mục kho',
          value: categoriesCount == null ? '—' : categoriesCount + ' nhóm',
          icon: FileText,
        },
      ]}
    />
  )
}
