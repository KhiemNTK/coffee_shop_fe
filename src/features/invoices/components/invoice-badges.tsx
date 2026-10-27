import { Coins, CreditCard, QrCode } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { type PaymentMethod, type PaymentStatus } from '../invoices.api'
import { Badge } from '../../../shared/ui'

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { t } = useTranslation()
  if (status === 'PAID') {
    return <Badge variant="success">{t('payment.status.PAID')}</Badge>
  }
  if (status === 'UNPAID') {
    return <Badge variant="warning">{t('payment.status.UNPAID')}</Badge>
  }
  if (status === 'VOIDED') {
    return <Badge variant="destructive">{t('payment.status.VOIDED')}</Badge>
  }
  if (status === 'REFUNDED' || status === 'PARTIALLY_REFUNDED') {
    return (
      <Badge variant="secondary" className="border-sky-200 bg-sky-50 text-sky-800">
        {status === 'PARTIALLY_REFUNDED' ? t('payment.status.PARTIALLY_REFUNDED') : t('payment.status.REFUNDED')}
      </Badge>
    )
  }
  return <Badge variant="outline">{status}</Badge>
}

export function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  const { t } = useTranslation()
  if (method === 'CASH') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-700 bg-stone-100 px-2 py-0.5 rounded">
        <Coins className="h-3 w-3 text-amber-700" /> {t('payment.method.CASH')}
      </span>
    )
  }
  if (method === 'TRANSFER') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
        <QrCode className="h-3 w-3 text-sky-600" /> {t('payment.method.TRANSFER')}
      </span>
    )
  }
  if (method === 'CARD') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
        <CreditCard className="h-3 w-3 text-indigo-600" /> {t('payment.method.CARD')}
      </span>
    )
  }
  return <span className="text-xs text-muted-foreground">{method}</span>
}

export function AttemptStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  if (status === 'SUCCEEDED') {
    return <Badge variant="success">{t('payment.attempt.SUCCEEDED')}</Badge>
  }
  if (status === 'PENDING') {
    return <Badge variant="warning">{t('payment.attempt.PENDING')}</Badge>
  }
  if (status === 'FAILED') {
    return <Badge variant="destructive">{t('payment.attempt.FAILED')}</Badge>
  }
  if (status === 'REQUIRES_REVIEW') return <Badge variant="warning">{t('payment.attempt.REQUIRES_REVIEW')}</Badge>
  if (status === 'EXPIRED') {
    return <Badge variant="secondary">{t('payment.attempt.EXPIRED')}</Badge>
  }
  return <Badge variant="outline">{status}</Badge>
}
