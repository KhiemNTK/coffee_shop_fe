import { z } from 'zod'
import { apiGet } from '../../shared/api/client'
import { apiIdempotentMutate } from '../../shared/api/idempotency'
import { paginatedResponseSchema } from '../../shared/api/types'
import { moneySchema } from '../menu/menu.api'

export const refundSchema = z.object({
  id: z.string(), paymentAttemptId: z.string(), amount: moneySchema, reason: z.string(),
  status: z.enum(['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REJECTED', 'REQUIRES_REVIEW']),
  type: z.enum(['FULL', 'PARTIAL']), createdAt: z.string(),
})
export function getRefunds(attemptId: string, page: number, signal?: AbortSignal) {
  return apiGet(`/payment-attempts/${attemptId}/refunds?page=${page}`, paginatedResponseSchema(refundSchema), signal, true)
}
export function createRefund(attemptId: string, amount: string, reason: string) {
  return apiIdempotentMutate(`/payment-attempts/${attemptId}/refunds`, refundSchema, { amount, reason })
}
