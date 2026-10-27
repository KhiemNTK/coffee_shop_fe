import { CreditCard, QrCode, Wallet } from 'lucide-react'
import type { PaymentProvider } from '../invoices.api'

const tones = {
  VNPAY: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  MOMO: 'bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300',
  PAYOS: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
}

export function PaymentProviderMark({ provider }: { provider: PaymentProvider }) {
  const Icon = provider === 'VNPAY' ? CreditCard : provider === 'MOMO' ? Wallet : QrCode
  return (
    <span
      aria-hidden="true"
      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-md ${tones[provider]}`}
    >
      <Icon size={19} />
    </span>
  )
}
