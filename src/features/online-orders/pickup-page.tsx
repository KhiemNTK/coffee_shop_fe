import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { RefreshCw, Send } from 'lucide-react'
import { Button, Textarea } from '../../shared/ui'
import { errorMessage } from '../../shared/api/client'
import { getPickupStatus, parsePickupLink, submitPickupFeedback } from './pickup.api'
import { FeedbackResponse } from './components/feedback-response'
import { formatStoreDateTime } from '../../shared/lib/store-time.js'

const labels = {
  PREPARING: 'takeaway.preparingShort',
  PARTIALLY_READY: 'takeaway.partialPickup',
  READY: 'takeaway.readyAtStore',
  COLLECTED: 'takeaway.collectedItems',
} as const

export default function PickupPage() {
  const { t: translate } = useTranslation()
  const [credential] = useState(() => parsePickupLink(window.location.href))
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const status = useQuery({
    queryKey: ['pickup-status', credential?.invoiceId],
    enabled: Boolean(credential),
    gcTime: 0,
    staleTime: 0,
    queryFn: ({ signal }) => getPickupStatus(credential!, signal),
    refetchInterval: (query) =>
      query.state.error ||
      query.state.data?.status === 'COLLECTED' ||
      (query.state.data && Date.parse(query.state.data.expiresAt) <= Date.now())
        ? false
        : 15_000,
  })
  const feedback = useMutation({
    mutationFn: () => submitPickupFeedback(credential!, rating, comment),
    gcTime: 0,
    onSuccess: () => { void status.refetch() },
  })
  return (
    <main className="mx-auto min-h-dvh max-w-2xl space-y-6 px-4 py-8">
      <Link to="/" className="text-sm underline">
        {translate('nav.menu')}
      </Link>
      <h1 className="text-2xl font-bold">{translate('takeaway.pickupHeading')}</h1>
      {!credential ? (
        <p role="alert">{translate('takeaway.invalidPickupLink')}</p>
      ) : (
        <>
          {status.isPending && <p role="status">{translate('takeaway.checkingOrder')}</p>}
          {status.isError && <p role="alert">{errorMessage(status.error)}</p>}
          <Button
            variant="outline"
            disabled={status.isFetching}
            onClick={() => void status.refetch()}
          >
            <RefreshCw size={16} /> {translate('takeaway.refreshStatus')}
          </Button>
          {status.data && (
            <section className="space-y-3" aria-label={translate('takeaway.pickupStatus')}>
              <h2 className="text-lg font-semibold">{translate(labels[status.data.status])}</h2>
              {status.isError && (
                <p className="text-amber-800">{translate('takeaway.staleStatus')}</p>
              )}
              <ul className="divide-y divide-border">
                {status.data.items.map((item) => (
                  <li key={item.id} className="flex flex-wrap justify-between gap-2 py-3">
                    <span>
                      {item.quantity} × {item.name}
                    </span>
                    <span>
                      {item.serveStatus === 'SERVED'
                        ? translate('takeaway.received')
                        : item.serveStatus === 'READY'
                          ? translate('common.ready')
                          : translate('takeaway.preparingShort')}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground">
                {translate('takeaway.codeExpiry')} {formatStoreDateTime(status.data.expiresAt)}
              </p>
            </section>
          )}
          {status.data?.feedback && !status.isError && <FeedbackResponse feedback={status.data.feedback} />}
          {status.data?.status === 'COLLECTED' && !status.isError && !status.data.feedback && (
            <section className="space-y-3 border-t border-border pt-5">
              <h2 className="text-lg font-semibold">{translate('takeaway.feedbackHeading')}</h2>
              {feedback.isSuccess ? (
                <p role="status">{translate('takeaway.feedbackThanks')}</p>
              ) : (
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault()
                    feedback.mutate()
                  }}
                >
                  <fieldset disabled={feedback.isPending || feedback.isError} className="space-y-3">
                    <legend className="text-sm">{translate('takeaway.rating')}</legend>
                    <div className="flex flex-wrap gap-3">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <label key={value} className="flex min-h-11 items-center gap-1.5">
                          <input
                            type="radio"
                            name="rating"
                            value={value}
                            checked={rating === value}
                            onChange={() => setRating(value)}
                          />
                          {value}/5
                        </label>
                      ))}
                    </div>
                    <label className="block text-sm">
                      {translate('takeaway.comment')}
                      <Textarea
                        value={comment}
                        maxLength={500}
                        onChange={(event) => setComment(event.target.value)}
                      />
                    </label>
                  </fieldset>
                  {feedback.isError && (
                    <p role="alert">
                      {errorMessage(feedback.error)} {translate('takeaway.feedbackRetained')}
                    </p>
                  )}
                  <Button disabled={feedback.isPending} type="submit">
                    <Send size={16} />
                    {feedback.isError
                      ? translate('takeaway.resendFeedback')
                      : translate('takeaway.sendFeedback')}
                  </Button>
                </form>
              )}
            </section>
          )}
        </>
      )}
    </main>
  )
}
