import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Eye, Plus, RefreshCw, Ticket } from 'lucide-react'
import type { Session } from '@/features/auth/session'
import { Badge, Button } from '@/shared/ui'
import { Pagination } from '@/shared/ui/pagination'
import { getCampaigns, voucherKeys, type VoucherCampaign } from './vouchers.api'
import { VoucherReadState, VoucherTerms } from './voucher-ui'
import { VoucherCampaignDialog } from './voucher-campaign-dialog'

export function StaffVouchersTab() {
  const { t } = useTranslation()
  const session = useOutletContext<Session>()
  const employeeId = session.employee.id
  const client = useQueryClient()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<VoucherCampaign['status'] | ''>('')
  const [target, setTarget] = useState<string | null | undefined>(undefined)
  const query = useQuery({
    queryKey: [...voucherKeys.campaigns(employeeId), status, page],
    queryFn: ({ signal }) => getCampaigns({ page, itemPerPage: 12, status: status || undefined }, signal),
    retry: false, enabled: session.access.has('/vouchers_read'),
  })
  function invalidate() {
    void client.invalidateQueries({ queryKey: voucherKeys.staff(employeeId) })
    void client.invalidateQueries({ queryKey: voucherKeys.public })
  }
  if (!session.access.has('/vouchers_read')) return null
  return <section className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="flex items-center gap-2 text-2xl font-semibold"><Ticket aria-hidden="true" />{t('voucher.campaigns')}</h1>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw size={16} aria-hidden="true" />{t('voucher.refresh')}</Button>
        {session.access.has('/vouchers_manage') && <Button size="sm" onClick={() => setTarget(null)}><Plus size={16} aria-hidden="true" />{t('voucher.create')}</Button>}
      </div>
    </header>
    <label className="inline-flex max-w-full flex-col gap-1 text-sm">{t('voucher.campaignStatus')}
      <select className="min-h-10 rounded-md border border-input bg-background px-3" value={status} onChange={event => { setStatus(event.target.value as typeof status); setPage(1) }}>
        <option value="">{t('voucher.all')}</option>
        {(['DRAFT', 'ACTIVE', 'PAUSED'] as const).map(value => <option key={value} value={value}>{t(`voucher.campaignStatus.${value}`)}</option>)}
      </select>
    </label>
    <VoucherReadState pending={query.isPending} error={query.error} empty={!query.data?.list.length} emptyMessage={t('voucher.emptyCampaigns')} onRetry={() => void query.refetch()} />
    {!query.isError && query.data && <>
      <p className="text-sm text-muted-foreground">{t('voucher.total', { count: query.data.totalItems })}</p>
      <ul className="divide-y divide-border">{query.data.list.map(campaign => <li key={campaign.id} className="space-y-3 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="min-w-0 break-words font-semibold">{campaign.name}</h2><Badge variant="secondary">{t(`voucher.campaignStatus.${campaign.status}`)}</Badge></div>
        <VoucherTerms campaign={campaign} />
        <p className="text-sm">{t(campaign.isPublic ? 'voucher.public' : 'voucher.private')} · {t('voucher.issued', { issued: campaign.issuedCount, limit: campaign.issuanceLimit })}</p>
        <Button variant="outline" size="sm" onClick={() => setTarget(campaign.id)}><Eye size={16} aria-hidden="true" />{t('voucher.details')}</Button>
      </li>)}</ul>
      <Pagination page={page} totalPages={query.data.totalPages} onPage={setPage} disabled={query.isFetching} />
    </>}
    {target !== undefined && <VoucherCampaignDialog key={target ?? 'new'} campaignId={target} session={session}
      onClose={() => setTarget(undefined)} onChanged={invalidate} />}
  </section>
}
