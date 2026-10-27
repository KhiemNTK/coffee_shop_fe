import type { PaymentAttemptStatus, PaymentProvider } from './invoices.api'

export const paymentProviderNames: Record<PaymentProvider, string> = {
  VNPAY: 'VNPay',
  MOMO: 'MoMo',
  PAYOS: 'payOS',
}

export function isUnresolvedPayment(status: PaymentAttemptStatus) {
  return status === 'PENDING' || status === 'EXPIRED' || status === 'REQUIRES_REVIEW'
}
