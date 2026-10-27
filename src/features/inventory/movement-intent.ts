import { z } from 'zod'
import { moneySchema } from '../menu/menu.api'
import {
  inventoryItemSchema,
  reorderAlertRowSchema,
  type InventoryItem,
  type ReorderAlertRow,
} from './inventory.api'
import { quantityDifference, quantitySchema } from './quantity'
import { pendingIntentKey } from '@/shared/api/pending-intent'

const quantity = quantitySchema.refine(
  (value) => !value.startsWith('-') && quantityDifference(value, '0') !== '0.0000',
)
const note = z.string().trim().min(3).max(500)
export const movementIntentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('IMPORT'),
    item: z.union([inventoryItemSchema, reorderAlertRowSchema]),
    quantity,
    unitPrice: moneySchema,
    note,
  }),
  z.object({ type: z.literal('EXPORT'), item: inventoryItemSchema, quantity, note }),
])
export type StockMovement = z.infer<typeof movementIntentSchema>
export type MovementTarget =
  | { type: 'IMPORT'; item: InventoryItem | ReorderAlertRow }
  | { type: 'EXPORT'; item: InventoryItem }
export const movementIntentKey = (employeeId: string) =>
  pendingIntentKey(employeeId, 'inventory.movement')
