import { moneySchema } from '@/shared/api/money'
import { z } from 'zod'
import { apiGet, ApiError } from '../../shared/api/client'
import { TrackOrderResponseSchema, reorderTemplateSchema } from '../online-orders/online-orders.api'

const customerOrdersSchema = z.object({
  customerId: z.uuid(),
  currentPage: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  totalItems: z.number().int().nonnegative(),
  list: z.array(
    z.object({
      id: z.uuid(),
      status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED']),
      createdAt: z.string(),
      pickupAt: z.string().nullable(),
      quotedSubtotal: moneySchema,
    }),
  ),
})
const customerOrderSchema = TrackOrderResponseSchema.extend({
  customerId: z.uuid(),
  pickupAccessToken: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
  invoices: z.array(
    z.object({
      id: z.uuid(),
      invoiceNumber: z.string(),
      totalAmount: moneySchema,
      paymentStatus: z.string(),
      createdAt: z.string(),
    }),
  ),
})

async function readCustomerOrder<T extends { customerId: string }>(
  path: string,
  schema: z.ZodType<T>,
  customerId: string,
  signal?: AbortSignal,
) {
  const data = await apiGet(path, schema, signal)
  if (data.customerId !== customerId) throw new ApiError(409, 'CUSTOMER_SESSION_CHANGED')
  return data
}

export function getCustomerOrders(customerId: string, page: number, signal?: AbortSignal) {
  return readCustomerOrder(
    `/customers/orders?page=${page}&itemPerPage=10`,
    customerOrdersSchema,
    customerId,
    signal,
  )
}

export function getCustomerOrder(customerId: string, id: string, signal?: AbortSignal) {
  return readCustomerOrder(
    `/customers/orders/${encodeURIComponent(id)}`,
    customerOrderSchema,
    customerId,
    signal,
  )
}

export function getCustomerReorderTemplate(customerId: string, id: string, signal?: AbortSignal) {
  return readCustomerOrder(
    `/customers/orders/${encodeURIComponent(id)}/reorder-template`,
    reorderTemplateSchema.extend({ customerId: z.uuid() }),
    customerId,
    signal,
  )
}
