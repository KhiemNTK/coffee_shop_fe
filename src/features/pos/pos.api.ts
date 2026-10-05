import { z } from 'zod'
import { apiGet, apiMutate } from '../../shared/api/client'
import { apiIdempotentMutate } from '../../shared/api/idempotency'
import { moneySchema } from '../menu/menu.api'
import { selectedOptionsSchema } from '../../shared/api/order-options'

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
  selectedOptions: selectedOptionsSchema,
  serveStatus: z.enum(['PENDING', 'COOKING', 'READY', 'SERVED', 'CANCELLED']),
  isPaid: z.boolean(),
  invoiceId: z.string().nullable().optional(),
  menuItem: z.object({
    id: z.uuid(),
    name: z.string(),
    price: moneySchema,
  }),
})

export const sessionDetailSchema = z.object({
  id: z.uuid(),
  onlineOrderRequest: z.object({ id: z.string() }).nullable().optional(),
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

export async function getDiningTables(
  signal: AbortSignal,
): Promise<DiningTable[]> {
  return apiGet('/dining-tables', z.array(diningTableSchema), signal, true)
}

export async function getActiveSessions(
  signal: AbortSignal,
): Promise<ActiveSession[]> {
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
  return apiMutate('/orders/sessions', 'POST', sessionDetailSchema, {
    tableId: tableId ?? null,
    guestCount: guestCount && guestCount > 0 ? guestCount : undefined,
  })
}

export type AddOrderItemPayload = {
  menuItemId: string
  quantity: number
  note?: string
  optionIds?: string[]
}

export function splitSession(payload: {
  sourceOrderSessionId: string
  destinationTableId: string
  itemsToMove: {
    orderItemId: string
    quantityToMove: number
    expectedOriginalQuantity: number
  }[]
}) {
  return apiMutate(
    '/orders/sessions/split',
    'POST',
    z.object({ success: z.boolean(), message: z.string() }),
    payload,
  )
}

export async function addOrderItems(
  sessionId: string,
  items: AddOrderItemPayload[],
): Promise<unknown> {
  return apiMutate(`/orders/sessions/${sessionId}/items`, 'POST', z.any(), {
    items,
  })
}

export async function cancelOrderItem(
  itemId: string,
  reason?: string,
): Promise<unknown> {
  return apiMutate(`/orders/items/${itemId}/cancel`, 'PATCH', z.any(), {
    reason: reason?.trim() || undefined,
  })
}

export async function transferTable(
  fromTableId: string,
  toTableId: string,
): Promise<unknown> {
  return apiMutate('/orders/sessions/transfer-table', 'POST', z.any(), {
    fromTableId,
    toTableId,
  })
}

export type CheckoutInput = {
  orderSessionId: string
  orderItemIds?: string[]
  promotionId?: string | null
  paymentMethod?: 'CASH' | 'CARD'
  amountTendered?: string
  closeSessionAfterPayment?: boolean
  idempotencyKey?: string
}

export async function checkoutInvoice(input: CheckoutInput): Promise<Invoice> {
  return apiIdempotentMutate('/invoices/checkout', invoiceSchema, {
    orderSessionId: input.orderSessionId,
    orderItemIds: input.orderItemIds,
    promotionId: input.promotionId,
    paymentMethod: input.paymentMethod ?? 'CASH',
    amountTendered: input.amountTendered?.trim() || undefined,
    closeSessionAfterPayment: input.closeSessionAfterPayment ?? true,
    idempotencyKey: input.idempotencyKey,
  })
}

export function quoteInvoice(
  input: Pick<CheckoutInput, 'orderSessionId' | 'orderItemIds' | 'promotionId'>,
) {
  return apiMutate(
    '/invoices/quote',
    'POST',
    z.object({
      orderItemIds: z.array(z.string()),
      subTotal: moneySchema,
      discountAmount: moneySchema,
      taxAmount: moneySchema,
      totalAmount: moneySchema,
    }),
    input,
  )
}

export function cancelSession(id: string) {
  return apiMutate(`/orders/sessions/${id}`, 'DELETE', z.unknown())
}

export function getHandoffQueue(page: number, signal?: AbortSignal) {
  return apiGet(
    `/orders/takeaway/handoff?page=${page}&itemPerPage=20`,
    z.object({
      list: z.array(
        z.object({
          id: z.string(),
          quantity: z.number(),
          readyAt: z.string().nullable(),
          orderSessionId: z.string(),
          menuItem: z.object({ name: z.string() }),
          ticketNumber: z.string().nullable(),
        }),
      ),
      totalPages: z.number(),
      totalItems: z.number(),
      currentPage: z.number(),
    }),
    signal,
    true,
  )
}

export function handoffItem(id: string) {
  return apiMutate(`/orders/items/${id}/handoff`, 'POST', z.unknown())
}
