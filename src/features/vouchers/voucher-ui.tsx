import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/shared/ui'
import { errorMessage } from '@/shared/api/client'
import { formatPrice } from '@/shared/lib/format'
import { formatStoreDateTime } from '@/shared/lib/store-time'
import type { WalletEntry } from './vouchers.api'

export function VoucherTerms({ campaign }: { campaign: WalletEntry['campaign'] }) {
  const { t } = useTranslation()
  return <div className="min-w-0 space-y-2 text-sm">
    <p className="font-semibold">{campaign.discountType === 'PERCENTAGE'
      ? t('voucher.percentage', { value: campaign.discountValue })
      : t('voucher.amount', { value: formatPrice(campaign.discountValue) })}</p>
    {campaign.description && <p className="whitespace-pre-wrap break-words text-muted-foreground">{campaign.description}</p>}
    <p>{t('voucher.minimum', { value: formatPrice(campaign.minSubtotal) })}</p>
    {campaign.maxDiscount != null && <p>{t('voucher.maximum', { value: formatPrice(campaign.maxDiscount) })}</p>}
    <p>{t('voucher.validity', { start: formatStoreDateTime(campaign.startDate), end: formatStoreDateTime(campaign.endDate) })}</p>
  </div>
}

export function VoucherReadState({ pending, error, empty, emptyMessage, loadingMessage, errorLabel, onRetry }: {
  pending: boolean; error: unknown; empty?: boolean; emptyMessage: string; loadingMessage?: string; errorLabel?: string; onRetry: () => void
}) {
  const { t } = useTranslation()
  if (error) return <div role="alert" className="space-y-3 break-words py-4 text-sm text-destructive">
    {errorLabel && <p>{errorLabel}</p>}
    <p>{errorMessage(error)}</p>
    <Button variant="outline" onClick={onRetry}><RefreshCw size={16} aria-hidden="true" />{t('voucher.retryRead')}</Button>
  </div>
  if (pending) return <p role="status" className="py-6 text-sm">{loadingMessage ?? t('voucher.loading')}</p>
  if (empty) return <p role="status" className="py-6 text-sm text-muted-foreground">{emptyMessage}</p>
  return null
}
