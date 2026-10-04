import { z } from 'zod'
import { apiGet, apiMutate } from '../../shared/api/client'
import { apiIdempotentMutate } from '../../shared/api/idempotency'
import { moneySchema } from '../menu/menu.api'

export const diningTableSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  status: z.enum(['EMPTY', 'OCCUPIED', 'RESERVED']),
})

export const activeSessionSchema = z.object({
  id: z.uuid(),
  sessionStatus: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']),
  guestCount: z.number().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  table: z
    .object({
      id: z.uuid(),
      name: z.string(),
      status: z.string(),
    })
    .nullable(),
  employee: z
    .object({
      id: z.uuid(),
      fullName: z.string(),
    })
    .nullable(),
  _count: z.object({
    orderItems: z.number().int(),
  }),
})

export const sessionItemSchema = z.object({
  id: z.uuid(),
  quantity: z.number().int().positive(),
  priceAtTime: moneySchema,
  note: z.string().nullable().optional(),
  selectedOptions: z.any().optional(),
  serveStatus: z.enum(['PENDING', 'COOKING', 'READY', 'SERVED', 'CANCELLED']),
  isPaid: z.boolean(),
  menuItem: z.object({
    id: z.uuid(),
    name: z.string(),
    price: moneySchema,
  }),
})

export const sessionDetailSchema = z.object({
  id: z.uuid(),
  sessionStatus: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']),
  guestCount: z.number().nullable().optional(),
  createdAt: z.string(),
  table: z
    .object({
      id: z.uuid(),
      name: z.string(),
      status: z.string(),
    })
    .nullable(),
  employee: z.object({
    id: z.uuid(),
    fullName: z.string(),
  }),
  orderItems: z.array(sessionItemSchema),
})

export const invoiceSchema = z.object({
  id: z.uuid(),
  invoiceNumber: z.string(),
  subTotal: moneySchema,
  discountAmount: moneySchema,
  totalAmount: moneySchema,
  amountTendered: moneySchema.nullable().optional(),
  changeAmount: moneySchema.nullable().optional(),
  paymentMethod: z.string(),
  paymentStatus: z.string(),
})

export type DiningTable = z.infer<typeof diningTableSchema>
export type ActiveSession = z.infer<typeof activeSessionSchema>
export type SessionDetail = z.infer<typeof sessionDetailSchema>
export type SessionItem = z.infer<typeof sessionItemSchema>
export type Invoice = z.infer<typeof invoiceSchema>

export async function getDiningTables(signal: AbortSignal): Promise<DiningTable[]> {
  return apiGet('/dining-tables', z.array(diningTableSchema), signal, true)
}

export async function getActiveSessions(signal: AbortSignal): Promise<ActiveSession[]> {
  return apiGet('/orders/sessions', z.array(activeSessionSchema), signal, true)
}

export async function getSessionDetail(
  id: string,
  signal: AbortSignal,
): Promise<SessionDetail> {
  return apiGet(`/orders/sessions/${id}`, sessionDetailSchema, signal, true)
}

export async function openOrderSession(
  tableId: string | null,
  guestCount?: number,
): Promise<SessionDetail> {
  return apiMutate(
    '/orders/sessions',
    'POST',
    sessionDetailSchema,
    {
      tableId: tableId ?? null,
      guestCount: guestCount && guestCount > 0 ? guestCount : undefined,
    },
  )
}

export type AddOrderItemPayload = {
  menuItemId: string
  quantity: number
  note?: string
  optionIds?: string[]
}

export async function addOrderItems(
  sessionId: string,
  items: AddOrderItemPayload[],
): Promise<unknown> {
  return apiMutate(
    `/orders/sessions/${sessionId}/items`,
    'POST',
    z.any(),
    { items },
  )
}

export async function cancelOrderItem(
  itemId: string,
  reason?: string,
): Promise<unknown> {
  return apiMutate(
    `/orders/items/${itemId}/cancel`,
    'PATCH',
    z.any(),
    { reason: reason?.trim() || undefined },
  )
}

export async function transferTable(
  fromTableId: string,
  toTableId: string,
): Promise<unknown> {
  return apiMutate(
    '/orders/sessions/transfer-table',
    'POST',
    z.any(),
    { fromTableId, toTableId },
  )
}

export type CheckoutInput = {
  orderSessionId: string
  paymentMethod?: 'CASH' | 'CARD'
  amountTendered?: string
  closeSessionAfterPayment?: boolean
  idempotencyKey?: string
}

export async function checkoutInvoice(
  input: CheckoutInput,
): Promise<Invoice> {
  return apiIdempotentMutate(
    '/invoices/checkout',
    invoiceSchema,
    {
      orderSessionId: input.orderSessionId,
      paymentMethod: input.paymentMethod ?? 'CASH',
      amountTendered: input.amountTendered?.trim() || undefined,
      closeSessionAfterPayment: input.closeSessionAfterPayment ?? true,
      idempotencyKey: input.idempotencyKey,
    },
  )
}
