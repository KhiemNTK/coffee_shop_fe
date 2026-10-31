import { moneySchema } from '@/shared/api/money'
import { minorAmount } from '@/shared/lib/money'
import { z } from 'zod'
import { apiGet, ApiError } from '../../shared/api/client'
import { apiIdempotentMutate } from '../../shared/api/idempotency'

export const reasonSchema = z.string().trim().min(3).max(500)
export const cashRefundInputSchema = z.object({
  amount: moneySchema.refine(value => minorAmount(value) > 0n, 'Nhập số tiền dương.'),
  reason: reasonSchema,
  // Older stored commands must remain visible, but cannot be sent without their reviewed shift.
  expectedShiftId: z.uuid().optional(),
})
export const remakeInputSchema = z.object({ itemId: z.string().min(1), reason: reasonSchema })
const cashRefundSchema = z.object({
  id: z.string(), invoiceId: z.string(), amount: moneySchema, reason: z.string(),
  completedAt: z.string(), idempotencyKey: z.string(), requestedById: z.string(),
  requestedBy: z.object({ id: z.string(), fullName: z.string() }),
  cashTransaction: z.object({ id: z.string(), shiftId: z.string().nullable(), fundId: z.string() }),
})
export type CashRefundInput = z.infer<typeof cashRefundInputSchema>
export type RemakeInput = z.infer<typeof remakeInputSchema>

export function getCashRefunds(invoiceId: string, page: number, signal: AbortSignal) {
  return apiGet(`/invoices/${invoiceId}/cash-refunds?page=${page}&itemPerPage=20`, z.object({
    list: z.array(cashRefundSchema), totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(), currentPage: z.number().int().positive(),
  }), signal, true)
}
export function createCashRefund(invoiceId: string, input: CashRefundInput, idempotencyKey: string) {
  if (!input.expectedShiftId) throw new ApiError(409, 'CASH_COMMAND_LEGACY')
  return apiIdempotentMutate(`/invoices/${invoiceId}/cash-refunds`, cashRefundSchema, { ...input, idempotencyKey })
}
export function remakeOrderItem({ itemId, reason }: RemakeInput, idempotencyKey: string) {
  return apiIdempotentMutate(`/orders/items/${itemId}/remake`, z.object({
    id: z.string(), originalItemId: z.string(), replacementItemId: z.string(), reason: z.string(),
    replacementItem: z.object({ id: z.string(), quantity: z.number().int().positive(),
      priceAtTime: moneySchema.refine(value => minorAmount(value) === 0n), isPaid: z.literal(true), invoiceId: z.null(),
      serveStatus: z.enum(['PENDING', 'COOKING', 'READY', 'SERVED', 'CANCELLED']) }),
  }), { reason, idempotencyKey })
}
