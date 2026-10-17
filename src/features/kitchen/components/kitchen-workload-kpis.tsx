import { useTranslation } from 'react-i18next'
import { AlertTriangle, Clock, Flame, Utensils } from 'lucide-react'
import { OperationsSummary } from '../../../shared/ui'
import type { KitchenWorkload } from '../kitchen.api'

export function KitchenWorkloadKpis({ workload }: { workload: KitchenWorkload }) {
  const { t: translate } = useTranslation()
  const total = (
    key: 'openTicketCount' | 'openUnitCount' | 'overdueTicketCount' | 'dueSoonTicketCount',
  ) => workload.stations.reduce((count, station) => count + station[key], 0)
  return (
    <OperationsSummary
      label={translate('ops.kitchen.workload')}
      metrics={[
        { label: translate('ops.kitchen.units'), value: total('openUnitCount'), icon: Utensils },
        { label: translate('ops.kitchen.tickets'), value: total('openTicketCount'), icon: Clock },
        {
          label: translate('ops.kitchen.overdue'),
          value: total('overdueTicketCount'),
          icon: AlertTriangle,
          tone: total('overdueTicketCount') ? 'danger' : undefined,
        },
        {
          label: translate('ops.kitchen.dueSoon'),
          value: total('dueSoonTicketCount'),
          icon: Flame,
          tone: total('dueSoonTicketCount') ? 'warning' : undefined,
        },
      ]}
    />
  )
}
