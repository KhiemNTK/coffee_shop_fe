import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronDown, History, RefreshCw } from 'lucide-react'
import { Badge, Button } from '../../../shared/ui'
import { businessInsightKeys, getBusinessInsightHistory, type BusinessInsightHistoryItem } from '../business-insights.api'
import { insightTime } from '../business-insight-format'

export function BusinessInsightHistory({ employeeId, enabled, selectedId, onSelect }: {
  employeeId: string; enabled: boolean; selectedId: string | null
  onSelect: (item: BusinessInsightHistoryItem) => void
}) {
  const client = useQueryClient()
  const { t } = useTranslation()
  const key = businessInsightKeys.history(employeeId)
  const history = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam, signal }) => getBusinessInsightHistory(pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled, retry: false, staleTime: 30_000,
    refetchOnWindowFocus: false, refetchOnReconnect: false,
  })
  const rows = history.data?.pages.flatMap(page => page.items) ?? []
  return <section className="min-w-0 space-y-3 border-t border-border pt-4" aria-label={t('insights.history')}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-base font-semibold"><History size={16} aria-hidden="true" />{t('insights.history')}</h3>
      <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={t('insights.historyRefresh')} title={t('insights.historyRefresh')} disabled={!enabled || history.isFetching}
        onClick={() => void client.invalidateQueries({ queryKey: key })}>
        <RefreshCw size={16} aria-hidden="true" className={history.isFetching ? 'animate-spin motion-reduce:animate-none' : ''} />
      </Button>
    </div>
    <p className="text-sm text-muted-foreground">{t('insights.historyNotice')}</p>
    {history.isPending && <p role="status" className="text-sm">{t('insights.historyLoading')}</p>}
    {history.isError && <p role="alert" className="text-sm text-destructive">{t('insights.historyError')}</p>}
    {!history.isPending && !history.isError && !rows.length && <p className="text-sm text-muted-foreground">{t('insights.historyEmpty')}</p>}
    {!!rows.length && <ul className="divide-y divide-border">{rows.map(item => <li key={item.id}>
      <button type="button" disabled={!enabled} aria-pressed={selectedId === item.id}
        className="flex min-h-14 w-full flex-wrap items-center justify-between gap-2 rounded-md px-2 py-3 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:bg-muted"
        onClick={() => onSelect(item)}>
        <span className="min-w-0 flex-1 basis-48 break-words">
          <span className="block font-medium">{insightTime(item.period.from)} - {insightTime(item.period.to)}</span>
          <span className="text-xs text-muted-foreground">{t('insights.historyCreatedAt', { time: insightTime(item.requestedAt) })}</span>
        </span>
        <Badge variant={item.status === 'COMPLETED' ? 'outline' : 'warning'}>{t(`insights.status.${item.status}`)}</Badge>
      </button>
    </li>)}</ul>}
    {history.hasNextPage && <Button variant="outline" disabled={!enabled || history.isFetching} className="gap-2"
      onClick={() => void history.fetchNextPage()}><ChevronDown size={16} aria-hidden="true" />{t('insights.historyMore')}</Button>}
  </section>
}
