import { useTranslation } from 'react-i18next'
import type { PublicFeedback } from '../feedback'
import { formatStoreDateTime } from '../../../shared/lib/store-time'

export function FeedbackResponse({ feedback }: { feedback: PublicFeedback }) {
  const { t } = useTranslation()
  return (
    <section
      aria-label={t('feedback.title')}
      className="space-y-2 border-t border-border py-4 text-sm"
    >
      <h3 className="font-semibold">{t('feedback.title')}</h3>
      <p>{t('feedback.rating', { rating: feedback.rating })}</p>
      {feedback.comment && <p className="break-words whitespace-pre-wrap">{feedback.comment}</p>}
      <p>
        {t(
          feedback.resolvedAt
            ? 'feedback.resolved'
            : feedback.rating <= 2
              ? 'feedback.pending'
              : 'takeaway.feedbackThanks',
        )}
      </p>
      {feedback.resolvedAt && (
        <>
          <p className="text-xs text-muted-foreground">
            {formatStoreDateTime(feedback.resolvedAt)}
          </p>
          {feedback.customerReply && (
            <blockquote className="break-words whitespace-pre-wrap border-l-2 border-primary pl-3">
              {feedback.customerReply}
            </blockquote>
          )}
        </>
      )}
    </section>
  )
}
