import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { formatDateTime, formatVnd } from '@/shared/lib/format'
import type { Incident } from '../reconciliation.api'

export function IncidentEvidence({
  incident,
  canReadInvoice,
}: {
  incident: Incident
  canReadInvoice: boolean
}) {
  const { t } = useTranslation()
  const attempt = incident.paymentAttempt
  const diagnostics = incident.diagnostics
  return (
    <section
      className="space-y-3 border-t border-border pt-4"
      aria-label={t('reconciliation.evidenceHeading')}
    >
      <h3 className="font-semibold">{t('reconciliation.evidenceHeading')}</h3>
      <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 text-sm [&>dd]:min-w-0 [&>dd]:[overflow-wrap:anywhere] [&>dd]:text-right">
        <dt>{t('reconciliation.provider')}</dt>
        <dd>{attempt.provider ?? '—'}</dd>
        <dt>{t('reconciliation.originalAmount')}</dt>
        <dd>{formatVnd(attempt.amount)}</dd>
        {incident.paymentRefundId && (
          <>
            <dt>{t('reconciliation.refundAmount')}</dt>
            <dd>{incident.paymentRefund ? formatVnd(incident.paymentRefund.amount) : '—'}</dd>
          </>
        )}
        {incident.paymentRefund && (
          <>
            <dt>{t('reconciliation.refundState')}</dt>
            <dd>{incident.paymentRefund.status}</dd>
          </>
        )}
        <dt>{t('reconciliation.lastCheck')}</dt>
        <dd>{attempt.lastReconciledAt ? formatDateTime(attempt.lastReconciledAt) : '—'}</dd>
        <dt>{t('reconciliation.nextCheck')}</dt>
        <dd>{attempt.nextReconcileAt ? formatDateTime(attempt.nextReconcileAt) : '—'}</dd>
        <dt>{t('reconciliation.queryCount')}</dt>
        <dd>{attempt.reconciliationAttempts ?? '—'}</dd>
        {diagnostics?.providerAmount != null && (
          <>
            <dt>{t('reconciliation.providerAmount')}</dt>
            <dd>{formatVnd(diagnostics.providerAmount)}</dd>
          </>
        )}
        {[
          diagnostics?.reasonCode,
          diagnostics?.failureCode,
          diagnostics?.responseCode,
          diagnostics?.transactionStatus,
        ].some(Boolean) && (
          <>
            <dt>{t('reconciliation.reasonCode')}</dt>
            <dd>
              <code>
                {[
                  diagnostics?.reasonCode,
                  diagnostics?.failureCode,
                  diagnostics?.responseCode,
                  diagnostics?.transactionStatus,
                ]
                  .filter(Boolean)
                  .join(' / ')}
              </code>
            </dd>
          </>
        )}
        {diagnostics?.verification && (
          <>
            <dt>{t('reconciliation.verification')}</dt>
            <dd>{diagnostics.verification}</dd>
          </>
        )}
      </dl>
      {canReadInvoice && (
        <Link
          className="inline-flex min-h-11 max-w-full items-center text-sm font-medium text-primary underline underline-offset-4 [overflow-wrap:anywhere]"
          to={`/staff/invoices?invoiceId=${encodeURIComponent(attempt.invoiceId)}`}
        >
          {t('reconciliation.openInvoice')} {attempt.invoice?.invoiceNumber ?? ''}
        </Link>
      )}
    </section>
  )
}
