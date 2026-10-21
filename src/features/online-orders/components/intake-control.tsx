import { useId, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Pause, Play, RefreshCw } from 'lucide-react'
import { getOnlineIntake, onlineOrderKeys, updateOnlineIntake } from '../online-orders.api'
import { errorMessage } from '../../../shared/api/client'
import { Button, Input } from '../../../shared/ui'
import { formatStoreDateTime } from '../../../shared/lib/store-time'

export function IntakeControl({ employeeId }: { employeeId: string }) {
  const { t } = useTranslation()
  const id = useId()
  const client = useQueryClient()
  const flight = useRef(false)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const [reason, setReason] = useState('')
  const [minutes, setMinutes] = useState('30')
  const [reviewRequired, setReviewRequired] = useState(false)
  const [saved, setSaved] = useState(false)
  const queryKey = [...onlineOrderKeys.all(employeeId), 'intake']
  const status = useQuery({
    queryKey,
    queryFn: ({ signal }) => getOnlineIntake(signal),
    retry: false,
    staleTime: 0,
  })
  const mutation = useMutation({
    mutationFn: updateOnlineIntake,
    retry: false,
    onSuccess: (data) => {
      client.setQueryData(queryKey, data)
      void client.invalidateQueries({ queryKey: ['online-availability'] })
      void client.invalidateQueries({ queryKey: ['pickup-slots'] })
      setReason('')
      setSaved(true)
    },
    onError: () => {
      setReviewRequired(true)
      requestAnimationFrame(() => errorRef.current?.focus())
    },
    onSettled: () => {
      flight.current = false
    },
  })
  const blocked =
    !status.isSuccess || status.isError || status.isFetching || mutation.isPending || reviewRequired
  async function refresh() {
    if (flight.current) return
    const result = await status.refetch()
    if (result.isSuccess) {
      setReviewRequired(false)
      setSaved(false)
      mutation.reset()
    }
  }
  function submit(pause: boolean) {
    if (flight.current || blocked || !status.data) return
    const duration = Number(minutes)
    if (pause && (!reason.trim() || !Number.isInteger(duration) || duration < 1 || duration > 1440))
      return
    flight.current = true
    setSaved(false)
    mutation.mutate({
      expectedVersion: status.data.version,
      pausedUntil: pause ? new Date(Date.now() + duration * 60000).toISOString() : null,
      reason: pause ? reason.trim() : null,
    })
  }
  return (
    <section aria-label={t('intake.title')} className="space-y-3 border-y border-border py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{t('intake.title')}</h2>
        <Button
          variant="ghost"
          size="sm"
          disabled={status.isFetching || mutation.isPending}
          onClick={() => void refresh()}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {t('common.refresh')}
        </Button>
      </div>
      {status.isPending ? (
        <p role="status" className="text-sm">
          {t('common.loading')}
        </p>
      ) : status.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(status.error)}
        </p>
      ) : (
        <>
          <p className="text-sm font-medium">
            {t(status.data.acceptingOrders ? 'intake.open' : 'takeaway.intakePaused')}
          </p>
          {!status.data.acceptingOrders && (
            <p className="break-words text-sm text-muted-foreground">
              {status.data.reason} ·{' '}
              {t('intake.until', { time: formatStoreDateTime(status.data.pausedUntil!) })}
            </p>
          )}
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              submit(true)
            }}
          >
            <label htmlFor={`${id}-reason`} className="min-w-0 flex-1 basis-56 space-y-1 text-sm">
              <span>{t('intake.reason')}</span>
              <Input
                id={`${id}-reason`}
                required
                maxLength={255}
                value={reason}
                disabled={blocked}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <label htmlFor={`${id}-minutes`} className="w-28 space-y-1 text-sm">
              <span>{t('intake.minutes')}</span>
              <Input
                id={`${id}-minutes`}
                type="number"
                min={1}
                max={1440}
                step={1}
                required
                value={minutes}
                disabled={blocked}
                onChange={(event) => setMinutes(event.target.value)}
              />
            </label>
            <Button type="submit" variant="outline" disabled={blocked || !reason.trim()}>
              <Pause size={16} aria-hidden="true" />
              {t('intake.pause')}
            </Button>
            {!status.data.acceptingOrders && (
              <Button type="button" disabled={blocked} onClick={() => submit(false)}>
                <Play size={16} aria-hidden="true" />
                {t('intake.resume')}
              </Button>
            )}
          </form>
        </>
      )}
      {mutation.error && (
        <p ref={errorRef} tabIndex={-1} role="alert" className="text-sm text-destructive">
          {errorMessage(mutation.error)} {t('intake.refreshRequired')}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm">
          {t('intake.saved')}
        </p>
      )}
    </section>
  )
}
