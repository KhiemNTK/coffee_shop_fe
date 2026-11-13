import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ClipboardCheck } from 'lucide-react'
import { ApiErrorAlert, Button, Input } from '@/shared/ui'
import { formatVnd } from '@/shared/lib/format'
import { reconcileRefund, type Incident, type RefundReview } from '../reconciliation.api'

export function RefundReviewForm({
  incident,
  employeeId,
  disabled,
  onUpdated,
  onUncertain,
  onBusyChange,
}: {
  incident: Incident
  employeeId: string
  disabled: boolean
  onUpdated: () => Promise<void>
  onUncertain: () => void
  onBusyChange: (busy: boolean) => void
}) {
  const { t } = useTranslation()
  const refund = incident.paymentRefund
  const [outcome, setOutcome] = useState<RefundReview['outcome']>('SUCCEEDED')
  const [reference, setReference] = useState('')
  const [evidence, setEvidence] = useState('')
  const [note, setNote] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const flight = useRef(false)
  const mutation = useMutation({
    retry: false,
    mutationFn: (input: RefundReview) => reconcileRefund(refund!.id, input),
    onSuccess: onUpdated,
    onError: onUncertain,
    onSettled: () => {
      flight.current = false
    },
  })
  useEffect(() => {
    onBusyChange(mutation.isPending)
    return () => onBusyChange(false)
  }, [mutation.isPending, onBusyChange])
  if (!refund || refund.status !== 'REQUIRES_REVIEW') return null
  if (refund.requestedById === employeeId)
    return (
      <p role="status" className="border-l-2 border-warning p-3 text-sm">
        {t('reconciliation.otherReviewer')}
      </p>
    )
  const blocked = disabled || mutation.isPending
  return (
    <form
      className="space-y-3 border-t border-border pt-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (flight.current || blocked || !confirmed) return
        flight.current = true
        mutation.mutate({
          expectedUpdatedAt: refund.updatedAt,
          expectedAmount: String(refund.amount),
          outcome,
          providerReference: reference.trim(),
          evidenceReference: evidence.trim(),
          resolutionNote: note.trim(),
        })
      }}
    >
      <h3 className="font-semibold">{t('reconciliation.verifyRefund')}</h3>
      <p className="text-sm text-muted-foreground">
        {t('reconciliation.reviewHint', { amount: formatVnd(refund.amount) })}
      </p>
      <p className="break-all text-xs">
        <span>{t('reconciliation.providerRequest')}: </span>
        <code>{refund.providerRequestId}</code>
      </p>
      <fieldset disabled={blocked} className="space-y-3">
        <legend className="sr-only">{t('reconciliation.refundOutcome')}</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {(['SUCCEEDED', 'FAILED'] as const).map((value) => (
            <label key={value} className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name="refund-outcome"
                checked={outcome === value}
                onChange={() => {
                  setOutcome(value)
                  setConfirmed(false)
                }}
              />
              {t(value === 'SUCCEEDED' ? 'reconciliation.refunded' : 'reconciliation.notRefunded')}
            </label>
          ))}
        </div>
        <label className="block space-y-1 text-sm">
          <span>{t('reconciliation.providerReference')}</span>
          <Input
            required
            minLength={3}
            maxLength={100}
            value={reference}
            onChange={(e) => {
              setReference(e.target.value)
              setConfirmed(false)
            }}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>{t('reconciliation.evidence')}</span>
          <Input
            required
            minLength={10}
            maxLength={500}
            value={evidence}
            onChange={(e) => {
              setEvidence(e.target.value)
              setConfirmed(false)
            }}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>{t('reconciliation.reviewNote')}</span>
          <Input
            required
            minLength={10}
            maxLength={500}
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
              setConfirmed(false)
            }}
          />
        </label>
        <label className="flex min-h-11 items-start gap-2 py-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            required
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>{t('reconciliation.evidenceConfirmed')}</span>
        </label>
      </fieldset>
      {mutation.isError && <ApiErrorAlert error={mutation.error} />}
      <Button type="submit" disabled={blocked || !confirmed} isLoading={mutation.isPending}>
        <ClipboardCheck className="size-4" />
        {t('reconciliation.saveReview')}
      </Button>
    </form>
  )
}
