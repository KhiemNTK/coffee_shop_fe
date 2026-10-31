import { formatDateTime, formatVnd } from '@/shared/lib/format'
import { currentLanguage, i18n, type TranslationKey } from '../../shared/i18n'
import type { BusinessInsight } from './business-insights.api'

const labels: Record<string, TranslationKey> = {
  paidInvoiceCount: 'insights.metric.paidInvoiceCount', grossSales: 'insights.metric.grossSales',
  discountAmount: 'insights.metric.discountAmount', refundCount: 'insights.metric.refundCount', refundAmount: 'insights.metric.refundAmount',
  netReceipts: 'insights.metric.netReceipts', estimatedNetSalesExTax: 'insights.metric.estimatedNetSalesExTax',
  ingredientCost: 'insights.metric.ingredientCost', wasteCost: 'insights.metric.wasteCost',
  estimatedGrossProfit: 'insights.metric.estimatedGrossProfit', soldItemCount: 'insights.metric.soldItemCount',
  itemsWithCostSnapshot: 'insights.metric.itemsWithCostSnapshot', zeroCostSnapshotCount: 'insights.metric.zeroCostSnapshotCount',
}
const countFormats = { vi: new Intl.NumberFormat('vi-VN'), en: new Intl.NumberFormat('en-GB') }
export const insightTime = (iso: string) => formatDateTime(iso, { seconds: true })
export function insightMetricLabel(metric: { key: string; label: string }): string {
  const key = Object.hasOwn(labels, metric.key) ? labels[metric.key] : undefined
  return key ? i18n.t(key) : metric.label
}
export const insightMetricValue = (value: string, unit: 'VND' | 'COUNT') => unit === 'VND' ? formatVnd(value) : countFormats[currentLanguage()].format(BigInt(value))

export function formatBusinessInsightText(job: BusinessInsight) {
  if (job.status !== 'COMPLETED' || !job.snapshot || !job.analysis) throw new Error('Insight is not complete')
  const snapshot = job.snapshot
  const metrics = new Map(snapshot.metrics.map(metric => [metric.key, metric]))
  return [
    i18n.t('insights.copyTitle'),
    i18n.t('insights.period', { from: insightTime(job.period.from), to: insightTime(job.period.to) }),
    i18n.t('insights.snapshotAt', { time: insightTime(snapshot.asOf) }),
    i18n.t('insights.comparisonPeriod', { from: insightTime(snapshot.comparisonPeriod.from), to: insightTime(snapshot.comparisonPeriod.to) }),
    i18n.t('insights.copyModel', { model: job.model, version: job.promptVersion }),
    i18n.t('insights.notice'),
    i18n.t('insights.accountingBasis'),
    i18n.t('insights.breakdownNotice'),
    ...(currentLanguage() === 'en' ? [i18n.t('insights.originalLanguage')] : []),
    '', job.analysis.summary, '',
    ...job.analysis.findings.flatMap((finding, index) => [
      `${index + 1}. ${i18n.t(finding.kind === 'HYPOTHESIS' ? 'insights.hypothesis' : 'insights.observation')}: ${finding.title}`,
      finding.detail,
      ...finding.metricKeys.map(key => {
        const metric = metrics.get(key)!
        return i18n.t('insights.metricEvidence', { label: insightMetricLabel(metric), value: insightMetricValue(metric.value, metric.unit), previous: insightMetricValue(metric.previousValue, metric.unit) })
      }),
      `${i18n.t('insights.action')}: ${finding.action}`, '',
    ]),
    i18n.t('insights.limits') + ':', ...job.analysis.limitations.map(limit => '- ' + limit),
  ].join('\n')
}
