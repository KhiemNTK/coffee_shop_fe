import { useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Gift, RefreshCw } from 'lucide-react'
import { z } from 'zod'
import type { Session } from '@/features/auth/session'
import { errorMessage } from '@/shared/api/client'
import { isPendingIntentExpired, pendingIntentKey, readPendingIntent, writePendingIntent, type PendingIntent } from '@/shared/api/pending-intent'
import { Button, Dialog, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui'
import { Pagination } from '@/shared/ui/pagination'
import { getCampaignGrants, getCampaigns, isUncertainVoucherWrite, issueVoucher, issueVoucherSchema, voucherKeys } from './vouchers.api'
import { VoucherReadState, VoucherTerms } from './voucher-ui'

const giftIntentSchema = z.object({ campaignId: z.uuid(), request: issueVoucherSchema })
type GiftIntent = PendingIntent<z.infer<typeof giftIntentSchema>>
export type VoucherGiftDialogProps = { sourceOrderId: string; onClose: () => void; onSuccess?: () => void }

export function VoucherGiftDialog(props: VoucherGiftDialogProps) {
  const session = useOutletContext<Session>()
  const { t } = useTranslation()
  if (!session.access.hasAll('/vouchers_read', '/vouchers_issue', '/online-orders_read'))
    return <Dialog open onClose={props.onClose}><DialogTitle>{t('voucher.gift')}</DialogTitle><p role="alert">{t('voucher.giftForbidden')}</p></Dialog>
  return <GiftForm key={`${session.employee.id}:${props.sourceOrderId}`} {...props} employeeId={session.employee.id} />
}

function GiftForm({ employeeId, ...props }: VoucherGiftDialogProps & { employeeId: string }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const storageKey = pendingIntentKey(employeeId, `voucher-gift:${props.sourceOrderId}`)
  const [recovery] = useState(() => {
    try {
      const intent = readPendingIntent(storageKey, giftIntentSchema)
      if (intent && (intent.payload.request.sourceOrderId !== props.sourceOrderId || intent.idempotencyKey !== intent.payload.request.idempotencyKey))
        throw new Error('Invalid recovery data')
      return { intent, expired: Boolean(intent && isPendingIntentExpired(intent)), invalid: false }
    } catch { return { intent: null, expired: false, invalid: true } }
  })
  const [intent, setIntent] = useState<GiftIntent | null>(recovery.intent)
  const [storageError, setStorageError] = useState(recovery.invalid)
  const [page, setPage] = useState(1)
  const [campaignId, setCampaignId] = useState(recovery.intent?.payload.campaignId ?? '')
  const [reason, setReason] = useState(recovery.intent?.payload.request.reason ?? '')
  const [checked, setChecked] = useState(false)
  const [readError, setReadError] = useState<unknown>(null)
  const [reading, setReading] = useState(false)
  const [notice, setNotice] = useState('')
  const flight = useRef(false)
  const query = useQuery({
    queryKey: [...voucherKeys.campaigns(employeeId), 'gift', page],
    queryFn: ({ signal }) => getCampaigns({ page, itemPerPage: 12, status: 'ACTIVE' }, signal), retry: false,
  })
  function finish() {
    sessionStorage.removeItem(storageKey)
    void client.invalidateQueries({ queryKey: voucherKeys.staff(employeeId) })
    props.onSuccess?.()
    props.onClose()
  }
  const mutation = useMutation({
    mutationFn: ({ pending }: { pending: GiftIntent; replay: boolean }) => issueVoucher(pending.payload.campaignId, pending.payload.request),
    retry: false,
    onSuccess: () => {
      try { finish() } catch { setStorageError(true) }
    },
    onError: (error, variables) => {
      setChecked(false)
      if (!variables.replay && !isUncertainVoucherWrite(error)) {
        try { sessionStorage.removeItem(storageKey); setIntent(null) }
        catch { setStorageError(true) }
      }
    },
    onSettled: () => { flight.current = false },
  })
  async function reconcile() {
    if (!intent || flight.current) return
    flight.current = true
    setReading(true)
    setReadError(null)
    setChecked(false)
    try {
      const result = await getCampaignGrants(intent.payload.campaignId, { sourceOrderId: props.sourceOrderId, page: 1, itemPerPage: 1 })
      const existing = result.list.find(grant => grant.sourceOrderId === props.sourceOrderId && grant.campaignId === intent.payload.campaignId && grant.source === 'GIFT')
      if (existing) { finish(); return }
      setChecked(true)
      setNotice(t('voucher.giftNotFound'))
    } catch (error) { setReadError(error) }
    finally { flight.current = false; setReading(false) }
  }
  function submit() {
    if (flight.current || storageError || recovery.expired || (intent && !checked)) return
    let pending = intent
    try {
      if (pending && isPendingIntentExpired(pending)) { setNotice(t('voucher.recoveryExpired')); return }
      if (!pending) {
        const key = crypto.randomUUID()
        const parsed = giftIntentSchema.safeParse({ campaignId, request: { sourceOrderId: props.sourceOrderId, reason, idempotencyKey: key } })
        if (!parsed.success) { setNotice(t('voucher.giftInvalid')); return }
        pending = { payload: parsed.data, createdAt: Date.now(), idempotencyKey: key, uncertain: true }
        writePendingIntent(storageKey, pending)
        setIntent(pending)
      }
    } catch { setStorageError(true); return }
    flight.current = true
    setChecked(false)
    mutation.mutate({ pending, replay: Boolean(intent) })
  }
  const selected = query.data?.list.find(campaign => campaign.id === campaignId)
  const busy = mutation.isPending || reading
  return <Dialog open onClose={() => { if (!flight.current) props.onClose() }}>
    <DialogHeader><DialogTitle>{t('voucher.gift')}</DialogTitle></DialogHeader>
    <p className="mb-4 break-all text-sm">{t('voucher.sourceOrder')}: {props.sourceOrderId}</p>
    {storageError && <p role="alert" className="mb-4 text-sm text-destructive">{t('voucher.recoveryInvalid')}</p>}
    {recovery.expired && <p role="alert" className="mb-4 text-sm text-destructive">{t('voucher.recoveryExpired')}</p>}
    {intent && <p role="status" className="mb-4 text-sm">{t('voucher.giftPending')}</p>}
    {Boolean(mutation.error || readError) && <p role="alert" className="mb-4 break-words text-sm text-destructive">{errorMessage(readError ?? mutation.error)}</p>}
    {notice && <p role="status" className="mb-4 text-sm">{notice}</p>}
    {!intent && <VoucherReadState pending={query.isPending} error={query.error} empty={!query.data?.list.length} emptyMessage={t('voucher.emptyActive')} onRetry={() => void query.refetch()} />}
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); submit() }}>
      <fieldset disabled={busy || Boolean(intent) || storageError} className="min-w-0 space-y-4">
        <div className="min-w-0 space-y-1 text-sm"><label htmlFor="gift-voucher-campaign" className="block">{t('voucher.selectCampaign')}</label>
          <select id="gift-voucher-campaign" required value={campaignId} onChange={event => setCampaignId(event.target.value)} className="min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3">
            <option value="">{t('voucher.selectCampaign')}</option>
            {intent && !selected && <option value={intent.payload.campaignId}>{intent.payload.campaignId}</option>}
            {query.data?.list.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
          </select>
        </div>
        {!intent && query.data && <Pagination page={page} totalPages={query.data.totalPages} onPage={value => { setPage(value); setCampaignId('') }} disabled={query.isFetching} />}
        {selected && <VoucherTerms campaign={selected} />}
        <div className="space-y-1 text-sm"><label htmlFor="gift-voucher-reason" className="block">{t('voucher.reason')}</label><textarea id="gift-voucher-reason" required minLength={2} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} className="min-h-24 w-full rounded-md border border-input bg-background p-3" /></div>
      </fieldset>
      {intent && <Button type="button" variant="outline" disabled={busy || storageError} onClick={() => void reconcile()}><RefreshCw size={16} aria-hidden="true" />{t('voucher.checkGift')}</Button>}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={busy} onClick={props.onClose}>{t('voucher.close')}</Button>
        <Button type="submit" disabled={busy || storageError || recovery.expired || (intent ? !checked : !selected || query.isError || query.isFetching)}><Gift size={16} aria-hidden="true" />{t(intent ? 'voucher.retryOriginal' : 'voucher.confirmGift')}</Button>
      </DialogFooter>
    </form>
  </Dialog>
}
