import { useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ban, RefreshCw } from 'lucide-react'
import { z } from 'zod'
import type { Session } from '@/features/auth/session'
import { errorMessage } from '@/shared/api/client'
import { Badge, Button, Input } from '@/shared/ui'
import { Pagination } from '@/shared/ui/pagination'
import { getCampaignGrants, getVoucherGrant, isUncertainVoucherWrite, revokeVoucher, voucherGrantSchema, voucherKeys, type VoucherGrant } from './vouchers.api'
import { pendingIntentKey, readPendingIntent, writePendingIntent, isPendingIntentExpired } from '@/shared/api/pending-intent'
import { VoucherReadState } from './voucher-ui'

const revokeIntentSchema = z.object({ grant: voucherGrantSchema, request: z.object({
  reason: z.string().min(2).max(500), expectedUpdatedAt: z.iso.datetime({ offset: true }), idempotencyKey: z.uuid(),
}) })

export function VoucherGrants({ campaignId, session, onChanged }: { campaignId: string; session: Session; onChanged: () => void }) {
  const { t } = useTranslation()
  const canRevoke = session.access.has('/vouchers_revoke')
  const storageKey = pendingIntentKey(session.employee.id, `voucher-revoke:${campaignId}`)
  const [recovery] = useState(() => {
    try {
      const intent = readPendingIntent(storageKey, revokeIntentSchema)
      if (intent && (intent.payload.grant.campaignId !== campaignId || intent.idempotencyKey !== intent.payload.request.idempotencyKey)) throw new Error('Invalid recovery')
      return { intent, invalid: false }
    } catch { return { intent: null, invalid: true } }
  })
  const [storageError, setStorageError] = useState(recovery.invalid)
  const [reading, setReading] = useState(false)
  const [readError, setReadError] = useState<unknown>(null)
  const [canDismiss, setCanDismiss] = useState(false)
  const [page, setPage] = useState(1)
  const [target, setTarget] = useState<VoucherGrant | null>(recovery.intent?.payload.grant ?? null)
  const [reason, setReason] = useState(recovery.intent?.payload.request.reason ?? '')
  const [pending, setPending] = useState<Parameters<typeof revokeVoucher>[1] | null>(recovery.intent?.payload.request ?? null)
  const [blocked, setBlocked] = useState(Boolean(recovery.intent))
  const [notice, setNotice] = useState('')
  const flight = useRef(false)
  const query = useQuery({
    queryKey: [...voucherKeys.grants(session.employee.id, campaignId), page],
    queryFn: ({ signal }) => getCampaignGrants(campaignId, { page, itemPerPage: 12 }, signal), retry: false,
    enabled: session.access.has('/vouchers_read'),
  })
  function finish() {
    try { sessionStorage.removeItem(storageKey) }
    catch { setStorageError(true); return }
    setTarget(null); setPending(null); setCanDismiss(false); void query.refetch(); onChanged()
  }
  const mutation = useMutation({
    mutationFn: (payload: Parameters<typeof revokeVoucher>[1]) => revokeVoucher(target!.id, payload), retry: false,
    onSuccess: finish,
    onError: () => { setBlocked(true); onChanged() },
    onSettled: () => { flight.current = false },
  })
  async function review() {
    if (!target || flight.current) return
    flight.current = true; setReading(true); setReadError(null); setCanDismiss(false)
    try {
      const current = await getVoucherGrant(target.id)
      if (current.campaignId !== campaignId) throw new Error('Invalid voucher campaign')
      if (current.status === 'REVOKED') { finish(); return }
      const saved = readPendingIntent(storageKey, revokeIntentSchema)
      if (saved && isPendingIntentExpired(saved)) { setNotice(t('voucher.recoveryExpired')); return }
      if (pending && current.updatedAt === pending.expectedUpdatedAt && !['RESERVED', 'USED'].includes(current.status) && isUncertainVoucherWrite(mutation.error)) {
        setBlocked(false)
        setNotice(t('voucher.revokeNotFound'))
      } else { setCanDismiss(true); setNotice(t('voucher.reviewChanged')) }
      onChanged()
    } catch (error) { setReadError(error) }
    finally { flight.current = false; setReading(false) }
  }
  return <section className="space-y-3 border-t border-border pt-4">
    <h3 className="font-semibold">{t('voucher.grants')}</h3>
    {storageError && <p role="alert" className="text-sm text-destructive">{t('voucher.recoveryInvalid')}</p>}
    <VoucherReadState pending={query.isPending} error={query.error} empty={!query.data?.list.length} emptyMessage={t('voucher.emptyGrants')} onRetry={() => void query.refetch()} />
    {!query.isError && query.data && <>
      <ul className="divide-y divide-border">{query.data.list.map(grant => <li key={grant.id} className="space-y-2 py-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><code className="break-all">{grant.id}</code><Badge variant="secondary">{t(`voucher.status.${grant.status}`)}</Badge></div>
        <p className="break-all">{t('voucher.customerId')}: {grant.customerId}</p>
        {grant.sourceOrderId && <p className="break-all">{t('voucher.sourceOrder')}: {grant.sourceOrderId}</p>}
        {grant.reason && <p className="break-words">{grant.reason}</p>}
        {session.access.has('/vouchers_revoke') && !['RESERVED', 'USED', 'REVOKED'].includes(grant.status) && <Button variant="outline" size="sm" disabled={Boolean(target) || storageError} onClick={() => { setTarget(grant); setReason(''); setPending(null); setBlocked(false); setCanDismiss(false); setNotice(''); mutation.reset() }}><Ban size={16} aria-hidden="true" />{t('voucher.revoke')}</Button>}
      </li>)}</ul>
      <Pagination page={page} totalPages={query.data.totalPages} onPage={setPage} disabled={query.isFetching || Boolean(target)} />
    </>}
    {target && <form className="space-y-3 border-t border-border pt-3" onSubmit={event => {
      event.preventDefault()
      if (flight.current || blocked || storageError || !canRevoke || reason.trim().length < 2) return
      const payload = pending ?? { reason: reason.trim(), expectedUpdatedAt: target.updatedAt, idempotencyKey: crypto.randomUUID() }
      try {
        const saved = readPendingIntent(storageKey, revokeIntentSchema)
        if (saved && isPendingIntentExpired(saved)) { setBlocked(true); setNotice(t('voucher.recoveryExpired')); return }
        if (!pending) writePendingIntent(storageKey, { payload: { grant: target, request: payload }, createdAt: Date.now(), idempotencyKey: payload.idempotencyKey, uncertain: true })
      } catch { setStorageError(true); return }
      setPending(payload)
      flight.current = true
      mutation.mutate(payload)
    }}>
      <p className="break-all text-sm">{t('voucher.revoke')}: {target.id}</p>
      <label className="block text-sm">{t('voucher.reason')}<Input required minLength={2} maxLength={500} value={reason} disabled={Boolean(pending)} onChange={event => setReason(event.target.value)} /></label>
      {mutation.error && <p role="alert" className="break-words text-sm text-destructive">{errorMessage(mutation.error)}</p>}
      {Boolean(readError) && <p role="alert" className="break-words text-sm text-destructive">{errorMessage(readError)}</p>}
      {notice && <p role="status" className="text-sm">{notice}</p>}
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={!canRevoke || mutation.isPending || reading || storageError || blocked || query.isFetching}><Ban size={16} aria-hidden="true" />{t(pending ? 'voucher.retryOriginal' : 'voucher.confirmRevoke')}</Button>
        {blocked && <Button type="button" variant="outline" disabled={reading || query.isFetching} onClick={() => void review()}><RefreshCw size={16} aria-hidden="true" />{t('voucher.review')}</Button>}
        {(!pending || canDismiss) && <Button type="button" variant="outline" disabled={reading || mutation.isPending} onClick={finish}>{t('voucher.cancel')}</Button>}</div>
    </form>}
  </section>
}
