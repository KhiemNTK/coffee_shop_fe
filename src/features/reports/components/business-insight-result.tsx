import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { currentLanguage } from '../../../shared/i18n'
import { Badge } from '../../../shared/ui'
import type { BusinessInsight } from '../business-insights.api'
import { insightTime as time, insightMetricLabel as metricLabel, insightMetricValue as metricValue } from '../business-insight-format'
import { CopyBusinessInsight } from './copy-business-insight'

export function BusinessInsightResult({ job }: { job: BusinessInsight }) {
  const { t } = useTranslation()
  const [metricGroup, setMetricGroup] = useState('overview')
  const snapshot = job.snapshot
  const analysis = job.status === 'COMPLETED' ? job.analysis : null
  const metrics = new Map(snapshot?.metrics.map(metric => [metric.key, metric]))
  const hasBreakdown = snapshot?.metrics.some(metric => metric.key.startsWith('item.') || metric.key.startsWith('category.')) ?? false
  const displayedMetrics = snapshot?.metrics.filter(metric => {
    const group = metric.key.startsWith('item.') ? 'item' : metric.key.startsWith('category.') ? 'category' : 'overview'
    return group === (hasBreakdown ? metricGroup : 'overview')
  }) ?? []
  const zeroCost = metrics.get('zeroCostSnapshotCount')
  const sold = metrics.get('soldItemCount')
  const costed = metrics.get('itemsWithCostSnapshot')
  const missingCosts = sold?.unit === 'COUNT' && costed?.unit === 'COUNT' && (
    BigInt(costed.value) < BigInt(sold.value) || BigInt(costed.previousValue) < BigInt(sold.previousValue)
  )

  return <div className="min-w-0 space-y-5">
    <dl className="text-sm">
      <dt className="text-muted-foreground">{t('insights.savedPeriod')}</dt>
      <dd>{time(job.period.from)} - {time(job.period.to)}</dd>
    </dl>
    {snapshot && <p className="text-xs text-muted-foreground">{t('insights.snapshotAt', { time: time(snapshot.asOf) })}</p>}
    {job.status === 'FAILED' && <p role="alert" className="text-sm text-destructive">{t('insights.failed')}</p>}
    {job.errorCode === 'AI_OUTCOME_UNKNOWN' && <p className="text-sm text-muted-foreground">{t('insights.outcomeUnknown')}</p>}
    {zeroCost && (!/^0(?:\.0+)?$/.test(zeroCost.value) || !/^0(?:\.0+)?$/.test(zeroCost.previousValue)) &&
      <p role="status" className="flex items-start gap-2 text-sm">
        <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />{t('insights.zeroCosts')}
      </p>}
    {missingCosts && <p role="status" className="text-sm">{t('insights.missingCosts')}</p>}
    {analysis && <section className="space-y-4" aria-label={t('insights.findings')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{t('insights.findings')}</h3>
        <CopyBusinessInsight job={job} />
      </div>
      {currentLanguage() === 'en' && <p className="text-xs text-muted-foreground">{t('insights.originalLanguage')}</p>}
      <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{analysis.summary}</p>
      <ol className="divide-y divide-border">{analysis.findings.map((finding, index) => <li key={index} className="space-y-3 py-4 first:pt-0">
        <div className="flex flex-wrap items-start gap-2">
          <h4 className="min-w-0 whitespace-pre-wrap break-words text-sm font-semibold [overflow-wrap:anywhere]">{finding.title}</h4>
          <Badge variant={finding.kind === 'HYPOTHESIS' ? 'warning' : 'outline'} className="whitespace-normal">
            {t(finding.kind === 'HYPOTHESIS' ? 'insights.hypothesis' : 'insights.observation')}
          </Badge>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{finding.detail}</p>
        <div className="space-y-1 text-sm">
          <p className="font-medium">{t('insights.evidence')}</p>
          <ul className="space-y-1">{finding.metricKeys.map(key => {
            const metric = metrics.get(key)!
            return <li key={key} className="break-words [overflow-wrap:anywhere]">
              {t('insights.metricEvidence', { label: metricLabel(metric), value: metricValue(metric.value, metric.unit), previous: metricValue(metric.previousValue, metric.unit) })}
            </li>
          })}</ul>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]"><span className="font-medium">{t('insights.action')}: </span>{finding.action}</p>
      </li>)}</ol>
      {!!analysis.limitations.length && <div className="space-y-2 border-t border-border pt-4">
        <h4 className="text-sm font-semibold">{t('insights.limits')}</h4>
        <ul className="list-inside list-disc space-y-1 text-sm">{analysis.limitations.map((limit, index) =>
          <li key={index} className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{limit}</li>)}</ul>
      </div>}
    </section>}
    {snapshot ? <details open={!analysis} className="border-y border-border py-3">
      <summary className="min-h-11 cursor-pointer rounded-md py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring">
        {t('insights.systemMetrics')}
      </summary>
      <section className="space-y-3 py-3" aria-label={t('insights.systemMetrics')}>
        <p className="text-sm">{t('insights.comparisonPeriod', { from: time(snapshot.comparisonPeriod.from), to: time(snapshot.comparisonPeriod.to) })}</p>
        <p className="text-sm">{t(snapshot.comparisonBasis === 'PREVIOUS_DAY_SAME_WINDOW' ? 'insights.sameWindow' : 'insights.previousWindow')}</p>
        <p className="text-sm text-muted-foreground">{t('insights.accountingBasis')}</p>
        {hasBreakdown && <p className="text-sm text-muted-foreground">{t('insights.breakdownNotice')}</p>}
        {hasBreakdown && <label className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {t('insights.metricGroup')}
          <select value={metricGroup} onChange={event => setMetricGroup(event.target.value)}
            className="min-h-11 max-w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring">
            <option value="overview">{t('insights.overview')}</option>
            <option value="item">{t('insights.items')}</option>
            <option value="category">{t('insights.categories')}</option>
          </select>
        </label>}
        {!snapshot.metrics.length && <p role="status">{t('insights.dataEmpty')}</p>}
        {!!snapshot.metrics.length && <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <caption className="sr-only">{t('insights.tableCaption')}</caption>
            <thead><tr className="border-b border-border">
              <th scope="col" className="p-2">{t('insights.metric')}</th>
              <th scope="col" className="p-2 text-right">{t('insights.current')}</th>
              <th scope="col" className="p-2 text-right">{t('insights.previous')}</th>
            </tr></thead>
            <tbody>{displayedMetrics.map(metric => <tr key={metric.key} className="border-b border-border">
              <th scope="row" className="max-w-64 break-words p-2 font-medium [overflow-wrap:anywhere]">{metricLabel(metric)}</th>
              <td className="whitespace-nowrap p-2 text-right tabular-nums">{metricValue(metric.value, metric.unit)}</td>
              <td className="whitespace-nowrap p-2 text-right tabular-nums">{metricValue(metric.previousValue, metric.unit)}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </section>
    </details> : <p className="text-sm text-muted-foreground">{t('insights.noSnapshot')}</p>}
    <details className="border-b border-border pb-3">
      <summary className="min-h-11 cursor-pointer rounded-md py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">{t('insights.technical')}</summary>
      <dl className="grid gap-3 py-3 text-sm sm:grid-cols-2">
        <div className="min-w-0"><dt className="text-muted-foreground">{t('insights.requestedAt')}</dt><dd>{time(job.requestedAt)}</dd></div>
        <div className="min-w-0"><dt className="text-muted-foreground">{t('insights.model')}</dt><dd className="break-words [overflow-wrap:anywhere]">{job.model} / {job.promptVersion}</dd></div>
      </dl>
    </details>
  </div>
}
