import { useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, Pause, Play, Save } from 'lucide-react'
import type { Session } from '@/features/auth/session'
import { ApiError, errorMessage } from '@/shared/api/client'
import { Button, Dialog, DialogFooter, DialogHeader, DialogTitle, Input } from '@/shared/ui'
import { fromStoreLocal, toStoreLocal } from '@/shared/lib/store-time'
import { campaignInputSchema, createCampaign, getCampaign, isUncertainVoucherWrite, pauseCampaign, publishCampaign, updateCampaign, voucherKeys, type CampaignInput, type VoucherCampaign } from './vouchers.api'
import { VoucherReadState, VoucherTerms } from './voucher-ui'
import { VoucherGrants } from './voucher-grants'

type Props = { campaignId: string | null; session: Session; onClose: () => void; onChanged: () => void }
export function VoucherCampaignDialog(props: Props) {
  const { t } = useTranslation()
  const [revision, setRevision] = useState(0)
  const query = useQuery({
    queryKey: voucherKeys.detail(props.session.employee.id, props.campaignId ?? ''),
    queryFn: ({ signal }) => getCampaign(props.campaignId!, signal),
    enabled: Boolean(props.campaignId), retry: false, staleTime: 0,
    refetchOnWindowFocus: false, refetchOnReconnect: false,
  })
  if (!props.campaignId) return <CampaignEditor {...props} />
  if (!query.data || query.isError) return <Dialog open onClose={props.onClose}>
    <DialogTitle>{t('voucher.details')}</DialogTitle>
    <VoucherReadState pending={query.isFetching} error={query.error} emptyMessage="" onRetry={() => void query.refetch()} />
  </Dialog>
  return <CampaignEditor {...props} key={`${query.data.updatedAt}:${revision}`} initial={query.data}
    stats={query.data.stats} onReload={() => { void query.refetch().then(result => { if (!result.error) setRevision(value => value + 1) }) }} />
}

function CampaignEditor({ initial, stats, onReload, ...props }: Props & {
  initial?: VoucherCampaign; stats?: { claimed: number; gifted: number; reserved: number; redeemed: number; revoked: number }; onReload?: () => void
}) {
  const { t } = useTranslation()
  const flight = useRef(false)
  const [validation, setValidation] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [command, setCommand] = useState<'publish' | 'ACTIVE' | 'PAUSED' | null>(null)
  const [startDefault] = useState(() => toStoreLocal(initial ? new Date(initial.startDate) : new Date()))
  const canManage = props.session.access.has('/vouchers_manage')
  const published = Boolean(initial?.publishedAt) || Boolean(initial && initial.status !== 'DRAFT')
  const mutation = useMutation({
    mutationFn: (action: { kind: 'save'; payload: CampaignInput } | { kind: 'publish' | 'ACTIVE' | 'PAUSED' }) => {
      if (action.kind === 'save') return initial
        ? updateCampaign(initial.id, { ...action.payload, expectedUpdatedAt: initial.updatedAt })
        : createCampaign(action.payload)
      if (!initial) throw new Error(t('voucher.invalidTerms'))
      return action.kind === 'PAUSED' ? pauseCampaign(initial.id, initial.updatedAt)
        : publishCampaign(initial.id, initial.updatedAt)
    }, retry: false,
    onSuccess: () => { props.onChanged(); props.onClose() },
    onError: error => {
      setBlocked(isUncertainVoucherWrite(error) || (error instanceof ApiError && error.status === 409))
      props.onChanged()
    },
    onSettled: () => { flight.current = false },
  })
  function send(action: Parameters<typeof mutation.mutate>[0]) {
    if (flight.current || blocked || !canManage) return
    flight.current = true
    mutation.mutate(action)
  }
  const locked = mutation.isPending || blocked || !canManage
  return <Dialog open maxWidth="lg" onClose={() => { if (!flight.current) props.onClose() }}>
    <DialogHeader><DialogTitle>{initial?.name ?? t('voucher.create')}</DialogTitle></DialogHeader>
    {mutation.error && <p role="alert" className="mb-3 break-words text-sm text-destructive">{errorMessage(mutation.error)}</p>}
    {blocked && <div className="mb-4 space-y-3"><p role="status" className="text-sm">{t(initial ? 'voucher.reviewChanged' : 'voucher.createUncertain')}</p>
      {onReload && <Button variant="outline" onClick={onReload}>{t('voucher.review')}</Button>}</div>}
    {validation && <p role="alert" className="mb-3 text-sm text-destructive">{validation}</p>}
    {published || !canManage ? initial && <VoucherTerms campaign={initial} /> : <form onSubmit={event => {
      event.preventDefault()
      if (locked) return
      const form = new FormData(event.currentTarget)
      const field = (name: string) => String(form.get(name) ?? '')
      try {
        const parsed = campaignInputSchema.safeParse({
          name: field('name'), description: field('description') || null, isPublic: form.has('isPublic'),
          discountType: field('discountType'), discountValue: field('discountValue'), maxDiscount: field('maxDiscount') || null,
          minSubtotal: field('minSubtotal'), issuanceLimit: Number(field('issuanceLimit')),
          startDate: fromStoreLocal(field('startDate')).toISOString(), endDate: fromStoreLocal(field('endDate')).toISOString(),
        })
        if (!parsed.success) { setValidation(t('voucher.invalidTerms')); return }
        setValidation('')
        send({ kind: 'save', payload: parsed.data })
      } catch { setValidation(t('voucher.invalidTerms')) }
    }} className="space-y-4">
      <fieldset disabled={locked} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="min-w-0 space-y-1 text-sm sm:col-span-2">{t('voucher.name')}<Input name="name" required maxLength={100} defaultValue={initial?.name ?? ''} /></label>
        <label className="min-w-0 space-y-1 text-sm sm:col-span-2">{t('voucher.description')}<textarea name="description" maxLength={500} defaultValue={initial?.description ?? ''} className="min-h-20 w-full rounded-md border border-input bg-background p-3" /></label>
        <label className="min-w-0 space-y-1 text-sm">{t('voucher.discountType')}<select name="discountType" defaultValue={initial?.discountType ?? 'PERCENTAGE'} className="min-h-10 w-full rounded-md border border-input bg-background px-3"><option value="PERCENTAGE">{t('voucher.percent')}</option><option value="FIXED_AMOUNT">{t('voucher.fixed')}</option></select></label>
        <label className="min-w-0 space-y-1 text-sm">{t('voucher.discountValue')}<Input name="discountValue" inputMode="decimal" required defaultValue={initial?.discountValue ?? ''} /></label>
        <label className="min-w-0 space-y-1 text-sm">{t('voucher.maxDiscount')}<Input name="maxDiscount" inputMode="decimal" defaultValue={initial?.maxDiscount ?? ''} /></label>
        <label className="min-w-0 space-y-1 text-sm">{t('voucher.minSubtotal')}<Input name="minSubtotal" inputMode="decimal" required defaultValue={initial?.minSubtotal ?? '0'} /></label>
        <label className="min-w-0 space-y-1 text-sm">{t('voucher.startDate')}<Input name="startDate" type="datetime-local" required defaultValue={startDefault} /></label>
        <label className="min-w-0 space-y-1 text-sm">{t('voucher.endDate')}<Input name="endDate" type="datetime-local" required defaultValue={initial ? toStoreLocal(new Date(initial.endDate)) : ''} /></label>
        <label className="min-w-0 space-y-1 text-sm">{t('voucher.issuanceLimit')}<Input name="issuanceLimit" type="number" min={1} max={2147483647} step={1} required defaultValue={initial?.issuanceLimit ?? ''} /></label>
        <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" name="isPublic" defaultChecked={initial?.isPublic ?? false} />{t('voucher.public')}</label>
      </fieldset>
      <Button type="submit" disabled={locked}><Save size={16} aria-hidden="true" />{t('voucher.save')}</Button>
    </form>}
    {published && <p className="mt-3 text-sm text-muted-foreground">{t('voucher.termsLocked')}</p>}
    {initial && stats && <dl className="my-5 grid grid-cols-2 gap-3 border-y border-border py-4 sm:grid-cols-5">
      {(['claimed', 'gifted', 'reserved', 'redeemed', 'revoked'] as const).map(key => <div key={key}><dt className="break-words text-xs text-muted-foreground">{t(`voucher.stats.${key}`)}</dt><dd className="font-semibold tabular-nums">{stats[key]}</dd></div>)}
    </dl>}
    {initial && canManage && <div className="my-4 space-y-3">
      {command ? <><p className="text-sm">{t(command === 'publish' ? 'voucher.publishConfirm' : 'voucher.statusConfirm')}</p><div className="flex flex-wrap gap-2"><Button disabled={locked} onClick={() => send({ kind: command })}><Check size={16} aria-hidden="true" />{t('voucher.confirm')}</Button><Button variant="outline" disabled={mutation.isPending} onClick={() => setCommand(null)}>{t('voucher.cancel')}</Button></div></>
        : <Button variant="outline" disabled={locked} onClick={() => setCommand(published ? initial.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED' : 'publish')}>
          {initial.status === 'ACTIVE' ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          {t(published ? initial.status === 'PAUSED' ? 'voucher.resume' : 'voucher.pause' : 'voucher.publish')}
        </Button>}
    </div>}
    {initial && <VoucherGrants campaignId={initial.id} session={props.session} onChanged={props.onChanged} />}
    <DialogFooter><Button variant="outline" disabled={mutation.isPending} onClick={props.onClose}>{t('voucher.close')}</Button></DialogFooter>
  </Dialog>
}
