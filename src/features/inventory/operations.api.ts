import { z } from 'zod'
import { apiGet } from '../../shared/api/client'
import { apiIdempotentMutate } from '../../shared/api/idempotency'
import { paginatedResponseSchema } from '../../shared/api/types'
import { moneySchema } from '../menu/menu.api'
import { quantitySchema as signedQuantitySchema } from './quantity'

const quantitySchema = signedQuantitySchema.refine(value => !value.startsWith('-'))

const movementItemSchema = z.object({
  inventoryItemId: z.uuid(),
  quantity: z.string().trim().regex(/^\d{1,14}(\.\d{1,4})?$/, 'Số lượng tối đa 4 chữ số thập phân').refine(value => /[1-9]/.test(value), 'Số lượng phải lớn hơn 0'),
  note: z.string().trim().min(3, 'Lý do cần ít nhất 3 ký tự').max(500),
})
const importItemSchema = movementItemSchema.extend({ unitPrice: z.string().trim().regex(/^\d{1,16}(\.\d{1,2})?$/, 'Đơn giá tối đa 2 chữ số thập phân') })
export const bulkMovementSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('IMPORT'), items: z.array(importItemSchema).min(1).max(100) }),
  z.object({ type: z.literal('EXPORT'), items: z.array(movementItemSchema).min(1).max(100) }),
]).refine(value => new Set(value.items.map(item => item.inventoryItemId.toLowerCase())).size === value.items.length, 'Không chọn trùng nguyên liệu')
export type BulkMovement = z.infer<typeof bulkMovementSchema>
const movementSchema = z.object({ inventoryItemId: z.string(), transactionId: z.string(), type: z.enum(['IMPORT', 'EXPORT']),
  quantity: quantitySchema, unitCost: moneySchema, totalAmount: moneySchema, stockAfter: quantitySchema, averageUnitCost: moneySchema })
export function bulkMoveStock(input: BulkMovement) {
  const parsed = bulkMovementSchema.parse(input)
  return apiIdempotentMutate('/inventory/' + (parsed.type === 'IMPORT' ? 'imports' : 'exports') + '/bulk', z.array(movementSchema), { items: parsed.items })
}
const wasteSchema = z.object({
  id: z.string(), orderItemId: z.string(), inventoryItemId: z.string(), quantity: quantitySchema, reason: z.string(), createdAt: z.string(),
  employee: z.object({ id: z.string(), fullName: z.string() }),
  snapshot: z.object({ inventoryItemName: z.string(), unitName: z.string(),
    orderItem: z.object({ id: z.string(), orderSessionId: z.string(), menuItem: z.object({ id: z.string(), name: z.string() }) }) }),
})
export function getInventoryWaste(page: number, orderItemId?: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(page), itemPerPage: '20' })
  if (orderItemId) params.set('orderItemId', z.uuid().parse(orderItemId))
  return apiGet('/inventory/waste?' + params, paginatedResponseSchema(wasteSchema), signal, true)
}
