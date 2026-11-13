import { useTranslation } from 'react-i18next'
import { formatPrice } from '@/shared/lib/format'
import type { VoucherSnapshot } from './online-orders.api'

export function OrderTotals({ quotedSubtotal, discountAmount, quotedTotal, voucher }: {
  quotedSubtotal: string
  discountAmount: string
  quotedTotal: string
  voucher: VoucherSnapshot | null
}) {
  const { t } = useTranslation()
  return (
    <dl className="space-y-2 text-sm" data-testid="order-totals">
      <div className="flex flex-wrap justify-between gap-2">
        <dt>{t('onlineVoucher.grossSubtotal', { defaultValue: 'Subtotal' })}</dt>
        <dd className="tabular-nums">{formatPrice(quotedSubtotal)}</dd>
      </div>
      <div className="flex flex-wrap justify-between gap-2">
        <dt className="min-w-0 break-words">
          {t('onlineVoucher.discountLabel', { defaultValue: 'Voucher discount' })}
          {voucher && <span className="block text-xs text-muted-foreground">{voucher.name}</span>}
        </dt>
        <dd className="tabular-nums">-{formatPrice(discountAmount)}</dd>
      </div>
      <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-2 font-semibold">
        <dt>{t('takeaway.quotedTotal')}</dt>
        <dd className="tabular-nums" data-testid="order-net-total">{formatPrice(quotedTotal)}</dd>
      </div>
    </dl>
  )
}
