import {
  AlertTriangle,
  CreditCard,
  DollarSign,
  PackageX,
  Receipt,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DashboardReport } from '../reports.api'
import { formatPrice } from '../../menu/menu.api'
import { formatQuantity } from '../../inventory/quantity'
import { errorMessage } from '../../../shared/api/client'
import { AdminTable, Badge, Button, OperationsSummary, cn } from '../../../shared/ui'

interface FinancialOverviewTabProps {
  report?: DashboardReport
  isLoading: boolean
  isError: boolean
  error: unknown
  onRefetch: () => void
  granularity: 'day' | 'hour'
  setGranularity: (g: 'day' | 'hour') => void
}

export function FinancialOverviewTab({
  report,
  isLoading,
  isError,
  error,
  onRefetch,
  granularity,
  setGranularity,
}: FinancialOverviewTabProps) {
  const { t } = useTranslation()
  if (isError)
    return (
      <div role="alert" className="border-l-4 border-destructive p-5 text-sm">
        <p>{errorMessage(error)}</p>
        <Button variant="outline" onClick={onRefetch} className="mt-3">
          {t('common.retry')}
        </Button>
      </div>
    )
  if (isLoading || !report)
    return (
      <p role="status" className="py-12 text-center text-sm text-muted-foreground">
        {t('finance.loading')}
      </p>
    )
  const maxRevenue = Math.max(...report.trend.map((row) => Number(row.netRevenue)), 1)
  const paymentLabels: Record<string, string> = {
    CASH: t('pos.cash'),
    CARD: t('pos.card'),
    TRANSFER: t('pos.bankTransfer'),
  }
  return (
    <div className="admin-finance space-y-5">
      <OperationsSummary
        label={t('finance.overview')}
        variant="cards"
        metrics={[
          {
            label: t('finance.netRevenue'),
            value: formatPrice(report.summary.netRevenue),
            icon: DollarSign,
            note: t('finance.grossSales', { amount: formatPrice(report.summary.grossSales) }),
          },
          {
            label: t('finance.grossProfit'),
            value: formatPrice(report.profitability.estimatedGrossProfit),
            icon: TrendingUp,
            note: t('finance.afterCosts'),
          },
          {
            label: t('finance.paidOrders'),
            value: report.summary.paidInvoiceCount,
            icon: Receipt,
            note: t('finance.completedInvoices'),
          },
          {
            label: t('finance.averageTicket'),
            value: formatPrice(report.summary.averageTicket),
            icon: CreditCard,
            note: t('finance.perInvoice'),
          },
          {
            label: t('finance.ingredientCost'),
            value: formatPrice(report.profitability.ingredientCost),
            icon: PackageX,
            note: t('finance.wasteCost', { amount: formatPrice(report.profitability.wasteCost) }),
          },
          {
            label: t('finance.shiftDiscrepancy'),
            value:
              Number(report.summary.cashShortageAmount) > 0
                ? '-' + formatPrice(report.summary.cashShortageAmount)
                : formatPrice('0'),
            icon: Wallet,
            tone: Number(report.summary.cashShortageAmount) > 0 ? 'danger' : undefined,
            note: t('finance.discrepantShifts', { count: report.summary.discrepantShiftCount }),
          },
        ]}
      />
      {report.cashRisk.overview && (
        <section className="border-y border-border bg-card px-4 py-4">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold">
            <Wallet size={18} aria-hidden="true" />
            {t('finance.cashRisk')}
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 text-sm">
            {(
              [
                [t('finance.openingShortage'), report.cashRisk.overview.openingShortageAmount],
                [t('finance.pendingExpenses'), report.cashRisk.overview.currentPendingExpenseRequestAmount],
                [t('finance.pendingHandovers'), report.cashRisk.overview.currentPendingHandoverAmount],
                [t('finance.overdueSettlements'), report.cashRisk.overview.overdueBankSettlementAmount],
                [
                  t('finance.mismatchedStatements'),
                  report.cashRisk.overview.currentMismatchedBankStatementEntryAmount,
                ],
              ] as const
            ).map(([label, amount]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd
                  className={cn(
                    'mt-1 break-words font-semibold tabular-nums',
                    amount != null && Number(amount) > 0 && 'text-amber-800',
                  )}
                >
                  {amount == null ? '—' : formatPrice(amount)}
                </dd>
              </div>
            ))}
            <div>
              <dt className="text-xs text-muted-foreground">{t('finance.repeatedShortages')}</dt>
              <dd className="mt-1 font-semibold">
                {report.cashRisk.overview.repeatShortageEmployeeCount ?? '—'}
              </dd>
            </div>
          </dl>
          {Boolean(report.cashRisk.employees?.length) && (
            <div className="mt-4">
              <AdminTable label={t('finance.repeatedShortages')}>
                <thead>
                  <tr>
                    <th>{t('common.staff')}</th>
                    <th>{t('finance.shortageShifts')}</th>
                    <th className="text-right">{t('finance.totalShortage')}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.cashRisk.employees?.map((row) => (
                    <tr key={row.employeeId}>
                      <td>{row.employeeName}</td>
                      <td>
                        {row.shortageShiftCount} / {row.closedShiftCount}
                      </td>
                      <td className="text-right">{formatPrice(row.totalShortageAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </AdminTable>
            </div>
          )}
        </section>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <section className="min-w-0 border-y border-border bg-card p-4">
          <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold">{t('finance.revenueTrend')}</h2>
            <div className="flex rounded-md border border-border p-0.5">
              {(['day', 'hour'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={granularity === value}
                  onClick={() => setGranularity(value)}
                  className={cn(
                    'min-h-10 rounded px-3 text-xs font-medium',
                    granularity === value ? 'bg-primary text-white' : 'hover:bg-muted',
                  )}
                >
                  {t(value === 'day' ? 'finance.day' : 'finance.hour')}
                </button>
              ))}
            </div>
          </header>
          {!report.trend.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t('finance.noTransactions')}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <div
                  className="flex h-52 items-end gap-3 border-b border-border pt-8"
                  style={{ minWidth: Math.min(report.trend.length * 40, 1200) }}
                >
                  {report.trend.map((row) => (
                    <div
                      key={row.bucket}
                      tabIndex={0}
                      className="group relative flex h-full min-w-6 flex-1 flex-col items-center justify-end"
                      aria-label={
                        row.bucket +
                        ': ' +
                        formatPrice(row.netRevenue) +
                        ', ' +
                        t('finance.orders', { count: row.paidInvoiceCount })
                      }
                    >
                      <div className="absolute bottom-full z-10 hidden max-w-56 rounded-md bg-foreground p-2 text-xs text-white shadow-sm group-hover:block group-focus:block">
                        {row.bucket}
                        <br />
                        {formatPrice(row.netRevenue)} · {t('finance.orders', { count: row.paidInvoiceCount })}
                      </div>
                      <div
                        className="w-full max-w-9 rounded-t bg-primary"
                        style={{ height: (Number(row.netRevenue) / maxRevenue) * 100 + '%' }}
                      />
                      <span
                        className="mt-2 max-w-full truncate text-xs text-muted-foreground"
                        title={row.bucket}
                      >
                        {row.bucket.slice(-5)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <details className="mt-4 text-sm">
                <summary className="min-h-10 cursor-pointer text-primary">
                  {t('finance.revenueDetails')}
                </summary>
                <AdminTable label={t('finance.revenueDetails')}>
                  <thead>
                    <tr>
                      <th>{t('finance.period')}</th>
                      <th>{t('finance.orderCount')}</th>
                      <th className="text-right">{t('finance.netRevenue')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.trend.map((row) => (
                      <tr key={row.bucket}>
                        <td>{row.bucket}</td>
                        <td>{row.paidInvoiceCount}</td>
                        <td className="text-right">{formatPrice(row.netRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </AdminTable>
              </details>
            </>
          )}
        </section>
        <section className="min-w-0 border-y border-border bg-card p-4">
          <h2 className="mb-5 text-base font-bold">{t('finance.paymentMethods')}</h2>
          {!report.paymentMethods.length && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t('finance.noPayments')}
            </p>
          )}
          <div className="divide-y divide-border">
            {report.paymentMethods.map((pm) => {
              const total = Number(report.summary.netRevenue)
              const percentage =
                total > 0 ? Math.round((Number(pm.netRevenue) / total) * 100) : null
              return (
                <div key={pm.paymentMethod} className="space-y-2 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium">
                      {paymentLabels[pm.paymentMethod] ?? pm.paymentMethod}
                    </span>
                    <strong className="tabular-nums">{formatPrice(pm.netRevenue)}</strong>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{ width: Math.min(100, percentage ?? 0) + '%' }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs tabular-nums">
                      {percentage == null ? '—' : percentage + '%'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('finance.completedTransactions', { count: pm.paidInvoiceCount })}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="min-w-0">
          <h2 className="mb-3 text-base font-bold">{t('finance.topItems')}</h2>
          <AdminTable label={t('finance.bestSellers')}>
            <thead>
              <tr>
                <th>#</th>
                <th>{t('finance.itemName')}</th>
                <th>{t('finance.category')}</th>
                <th className="text-right">{t('finance.quantitySold')}</th>
                <th className="text-right">{t('finance.totalSales')}</th>
              </tr>
            </thead>
            <tbody>
              {report.topItems.map((item, index) => (
                <tr key={item.menuItemId}>
                  <td>{index + 1}</td>
                  <td className="min-w-40 font-semibold">{item.name}</td>
                  <td className="min-w-28">
                    <Badge variant="outline">{item.categoryName}</Badge>
                  </td>
                  <td className="text-right">{item.quantitySold}</td>
                  <td className="text-right font-semibold tabular-nums">
                    {formatPrice(item.grossSales)}
                  </td>
                </tr>
              ))}
              {!report.topItems.length && (
                <tr>
                  <td colSpan={5} className="text-center text-muted-foreground">
                    {t('finance.noSales')}
                  </td>
                </tr>
              )}
            </tbody>
          </AdminTable>
        </section>
        <section className="min-w-0">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
            <AlertTriangle size={18} aria-hidden="true" className="text-amber-700" />
            {t('finance.lowStock')}
          </h2>
          <AdminTable label={t('finance.stockAlerts')}>
            <thead>
              <tr>
                <th>{t('finance.ingredient')}</th>
                <th className="text-right">{t('finance.stock')}</th>
                <th className="text-right">{t('finance.reservedStock')}</th>
                <th className="text-right">{t('finance.availableStock')}</th>
              </tr>
            </thead>
            <tbody>
              {report.lowStockItems.map((item) => (
                <tr key={item.id}>
                  <td className="font-semibold">{item.name}</td>
                  <td className="text-right">
                    {formatQuantity(item.stock)} {item.unitName}
                  </td>
                  <td className="text-right">
                    {formatQuantity(item.reservedStock)} {item.unitName}
                  </td>
                  <td className="text-right">
                    <Badge variant="warning">
                      {formatQuantity(item.availableStock)} {item.unitName}
                    </Badge>
                  </td>
                </tr>
              ))}
              {!report.lowStockItems.length && (
                <tr>
                  <td colSpan={4} className="text-center text-muted-foreground">
                    {t('finance.noStockAlerts')}
                  </td>
                </tr>
              )}
            </tbody>
          </AdminTable>
        </section>
      </div>
    </div>
  )
}
