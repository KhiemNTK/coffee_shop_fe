import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Download, RefreshCw, Ticket } from 'lucide-react'
import { SiteHeader } from '@/features/storefront/site-header'
import { customerKey, useCustomer } from '@/features/customers/customers.api'
import { CustomerSignIn } from '@/features/customers/customer-sign-in'
import { ApiError, errorMessage } from '@/shared/api/client'
import { Badge, Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui'
import { Pagination } from '@/shared/ui/pagination'
import { formatStoreDateTime } from '@/shared/lib/store-time'
import { claimVoucher, getCustomerVouchers, getPublicCampaigns, isUncertainVoucherWrite, voucherKeys, voucherStatuses, voucherStatusSchema, type VoucherStatus } from './vouchers.api'
import { VoucherReadState, VoucherTerms } from './voucher-ui'

export default function VoucherWalletPage() {
  const { t } = useTranslation()
  const customer = useCustomer()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'wallet' ? 'wallet' : 'discover'
  const returnTo = `/account/vouchers?${params}`
  return <div className="min-h-screen bg-background">
    <SiteHeader />
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6">
      <Link to="/account" className="inline-flex min-h-11 items-center gap-2 text-sm text-primary dark:text-foreground"><ArrowLeft size={16} aria-hidden="true" />{t('voucher.account')}</Link>
      <h1 className="flex items-center gap-2 text-2xl font-semibold"><Ticket aria-hidden="true" />{t('voucher.wallet')}</h1>
      <Tabs value={tab} onValueChange={value => setParams({ tab: value })}>
        <TabsList aria-label={t('voucher.wallet')}>
          <TabsTrigger value="discover">{t('voucher.discover')}</TabsTrigger>
          <TabsTrigger value="wallet">{t('voucher.own')}</TabsTrigger>
        </TabsList>
        <TabsContent value="discover">
          <VoucherDiscovery key={customer.data?.id ?? 'guest'} customerId={!customer.isError ? customer.data?.id : undefined} returnTo={returnTo} />
        </TabsContent>
        <TabsContent value="wallet">
          <VoucherReadState pending={customer.isPending} error={customer.error} emptyMessage="" onRetry={() => void customer.refetch()} />
          {!customer.isError && customer.data && <OwnWallet key={customer.data.id} customerId={customer.data.id} />}
          {!customer.isPending && !customer.isError && !customer.data && <CustomerSignIn returnTo={returnTo} />}
        </TabsContent>
      </Tabs>
    </main>
  </div>
}

function VoucherDiscovery({ customerId, returnTo }: { customerId?: string; returnTo: string }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [page, setPage] = useState(1)
  const [signIn, setSignIn] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const flight = useRef(false)
  const query = useQuery({ queryKey: [...voucherKeys.public, page], queryFn: ({ signal }) => getPublicCampaigns(page, signal), retry: false })
  const claim = useMutation({
    mutationFn: (campaignId: string) => claimVoucher(campaignId, customerId!), retry: false,
    onError: error => {
      setUncertain(isUncertainVoucherWrite(error))
      if (error instanceof ApiError && (error.status === 401 || error.code === 'CUSTOMER_SESSION_CHANGED'))
        void client.invalidateQueries({ queryKey: customerKey })
    },
    onSettled: () => {
      flight.current = false
      void client.invalidateQueries({ queryKey: voucherKeys.wallet(customerId ?? '') })
      void client.invalidateQueries({ queryKey: voucherKeys.public })
    },
  })
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">{t('voucher.discover')}</h2>
      <Button variant="ghost" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw size={16} aria-hidden="true" />{t('voucher.refresh')}</Button>
    </div>
    {signIn && !customerId && <CustomerSignIn returnTo={returnTo} />}
    {claim.error && <p role="alert" className="break-words text-sm text-destructive">{errorMessage(claim.error)}</p>}
    {uncertain && <p role="status" className="text-sm">{t('voucher.claimUncertain')} <Link to="/account/vouchers?tab=wallet" className="underline">{t('voucher.own')}</Link></p>}
    {claim.isSuccess && <p role="status" className="text-sm">{t('voucher.claimed')} <Link to="/account/vouchers?tab=wallet" className="underline">{t('voucher.own')}</Link></p>}
    <VoucherReadState pending={query.isPending} error={query.error} empty={!query.data?.list.length} emptyMessage={t('voucher.emptyPublic')} onRetry={() => void query.refetch()} />
    {!query.isError && query.data && <>
      <ul className="divide-y divide-border">
        {query.data.list.map(campaign => <li key={campaign.id} className="space-y-3 py-5">
          <h3 className="break-words font-semibold">{campaign.name}</h3>
          <VoucherTerms campaign={campaign} />
          <Button disabled={claim.isPending || uncertain || (claim.isSuccess && claim.variables === campaign.id)} onClick={() => {
            if (!customerId) { setSignIn(true); return }
            if (flight.current) return
            flight.current = true
            claim.mutate(campaign.id)
          }}><Download size={16} aria-hidden="true" />{t(customerId ? 'voucher.claim' : 'voucher.signInClaim')}</Button>
        </li>)}
      </ul>
      <Pagination page={page} totalPages={query.data.totalPages} onPage={setPage} disabled={query.isFetching} />
    </>}
  </section>
}

function OwnWallet({ customerId }: { customerId: string }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [params, setParams] = useSearchParams()
  const parsed = voucherStatusSchema.safeParse(params.get('status'))
  const status: VoucherStatus = parsed.success ? parsed.data : 'AVAILABLE'
  const page = Math.min(1000, Math.max(1, Math.trunc(Number(params.get('page'))) || 1))
  const query = useQuery({
    queryKey: [...voucherKeys.wallet(customerId), status, page], retry: false, staleTime: 0, gcTime: 60000,
    queryFn: async ({ signal }) => {
      const result = await getCustomerVouchers({ status, page, itemPerPage: 12 }, signal)
      if (result.customerId !== customerId) throw new ApiError(401, 'CUSTOMER_SESSION_CHANGED')
      return result
    },
  })
  useEffect(() => {
    if (query.error instanceof ApiError && (query.error.status === 401 || query.error.code === 'CUSTOMER_SESSION_CHANGED'))
      void client.invalidateQueries({ queryKey: customerKey })
  }, [client, query.error])
  return <section className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1 text-sm"><label htmlFor="wallet-voucher-status" className="block">{t('voucher.status')}</label>
        <select id="wallet-voucher-status" className="min-h-10 max-w-full rounded-md border border-input bg-background px-3" value={status}
          onChange={event => setParams({ tab: 'wallet', status: event.target.value })}>
          {voucherStatuses.map(value => <option key={value} value={value}>{t(`voucher.status.${value}`)}</option>)}
        </select>
      </div>
      <Button variant="ghost" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw size={16} aria-hidden="true" />{t('voucher.refresh')}</Button>
    </div>
    <VoucherReadState pending={query.isPending} error={query.error} empty={!query.data?.list.length}
      loadingMessage={t('voucher.loadingStatus', { status: t(`voucher.status.${status}`) })}
      errorLabel={t('voucher.errorStatus', { status: t(`voucher.status.${status}`) })}
      emptyMessage={t(`voucher.empty.${status}`)} onRetry={() => void query.refetch()} />
    {!query.isError && query.data && <>
      <ul className="divide-y divide-border">{query.data.list.map(voucher => <li key={voucher.id} className="space-y-3 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="min-w-0 break-words font-semibold">{voucher.campaign.name}</h2><Badge variant="secondary">{t(`voucher.status.${voucher.status}`)}</Badge></div>
        <VoucherTerms campaign={voucher.campaign} />
        <p className="text-sm">{t('voucher.expires', { date: formatStoreDateTime(voucher.expiresAt) })}</p>
        <p className="text-sm text-muted-foreground">{t(`voucher.source.${voucher.source}`)}</p>
        <p className="break-all font-mono text-xs text-muted-foreground">{voucher.id}</p>
        {voucher.orderId && <Link to={`/account/orders/${voucher.orderId}`} className="inline-flex min-h-11 items-center text-sm text-primary dark:text-foreground">{t('voucher.order')}</Link>}
      </li>)}</ul>
      <Pagination page={page} totalPages={query.data.totalPages} disabled={query.isFetching} onPage={value => setParams({ tab: 'wallet', status, page: String(value) })} />
    </>}
  </section>
}
