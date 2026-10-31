import { Link, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import type { Session } from '@/features/auth/session'
import { buttonVariants } from '@/shared/ui/index'

export function ShiftRequiredLink() {
  const { access } = useOutletContext<Session>()
  const { t } = useTranslation()
  if (
    !access.hasAll('/cashier-shifts_current', '/cashier-shifts_open', '/funds_read')
  )
    return null
  return (
    <Link to="/staff/shifts?tab=current" className={buttonVariants({ variant: 'outline' })}>
      <ArrowRight size={16} aria-hidden="true" />
      {t('pos.openShift')}
    </Link>
  )
}
