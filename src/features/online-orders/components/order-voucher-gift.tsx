import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Gift } from 'lucide-react'
import type { Session } from '@/features/auth/session'
import { VoucherGiftDialog } from '@/features/vouchers/voucher-gift-dialog'
import { Button } from '@/shared/ui'

export function OrderVoucherGift({ order }: { order: { id: string; hasCustomerAccount: boolean } }) {
  const { access } = useOutletContext<Session>()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  if (!order.hasCustomerAccount || !access.hasAll('/vouchers_read', '/vouchers_issue', '/online-orders_read'))
    return null
  return (
    <>
      <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(true)}>
        <Gift size={16} aria-hidden="true" />
        {t('onlineVoucher.giftOrder', { defaultValue: 'Gift voucher' })}
      </Button>
      {open && <VoucherGiftDialog sourceOrderId={order.id} onClose={() => setOpen(false)} />}
    </>
  )
}
