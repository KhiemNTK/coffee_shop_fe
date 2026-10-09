import type { PaymentAttemptStatus } from './invoices.api'

export function isUnresolvedPayment(status: PaymentAttemptStatus) {
  return status === 'PENDING' || status === 'EXPIRED' || status === 'REQUIRES_REVIEW'
}
