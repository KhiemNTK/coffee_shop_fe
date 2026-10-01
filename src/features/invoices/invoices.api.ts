import { z } from 'zod'
import { apiGet, apiMutate } from '../../shared/api/client'
import { moneySchema } from '../menu/menu.api'

export const invoiceItemSchema = z.object({
  id: z.string(),
  quantity: z.number().int().positive(),
  price: moneySchema,
  subTotal: moneySchema,
  note: z.string().nullable().optional(),
  menuItem: z
    .object({
      id: z.string(),
      name: z.string(),
      price: moneySchema,
    })
    .optional(),
})

export const invoiceSchema = z.object({
  id: z.string(),
  invoiceNumber: z.string(),
  subTotal: moneySchema,
  discountAmount: moneySchema,
  taxAmount: moneySchema,
  taxRate: z.union([z.number(), z.string()]),
  totalAmount: moneySchema,
  amountTendered: moneySchema.nullable().optional(),
  changeAmount: moneySchema.nullable().optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER']),
  paymentStatus: z.enum([
    'UNPAID',
    'PAID',
    'VOIDED',
    'PARTIALLY_REFUNDED',
    'REFUNDED',
  ]),
  createdAt: z.string(),
  updatedAt: z.string(),
  orderSessionId: z.string(),
  orderSession: z
    .object({
      id: z.string(),
      sessionStatus: z.string(),
      tableId: z.string(),
      table: z
        .object({
          id: z.string(),
          name: z.string(),
          status: z.string(),
        })
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
  employeeId: z.string(),
  employee: z
    .object({
      id: z.string(),
      fullName: z.string(),
      email: z.string(),
    })
    .nullable()
    .optional(),
  shiftId: z.string().nullable().optional(),
  shift: z
    .object({
      id: z.string(),
      shiftStatus: z.string().optional(),
    })
    .nullable()
    .optional(),
  orderItems: z.array(invoiceItemSchema).default([]),
})

export const invoicesResponseSchema = z.object({
  list: z.array(invoiceSchema),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  currentPage: z.number().int().positive(),
})

export const paymentAttemptSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  provider: z.enum(['VNPAY', 'MOMO']),
  amount: moneySchema,
  merchantReference: z.string(),
  status: z.enum([
    'PENDING',
    'SUCCEEDED',
    'FAILED',
    'EXPIRED',
    'REQUIRES_REVIEW',
  ]),
  providerCreatedAt: z.string(),
  expiresAt: z.string(),
  paymentUrl: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const paymentAttemptsResponseSchema = z.object({
  list: z.array(paymentAttemptSchema),
  totalItems: z.number().int().nonnegative().optional().default(0),
  totalPages: z.number().int().nonnegative().optional().default(1),
})

export type PaymentStatus = z.infer<typeof invoiceSchema>['paymentStatus']
export type PaymentMethod = z.infer<typeof invoiceSchema>['paymentMethod']
export type PaymentProvider = z.infer<typeof paymentAttemptSchema>['provider']
export type PaymentAttemptStatus = z.infer<typeof paymentAttemptSchema>['status']
export type InvoiceItem = z.infer<typeof invoiceItemSchema>
export type Invoice = z.infer<typeof invoiceSchema>
export type InvoicesResponse = z.infer<typeof invoicesResponseSchema>
export type PaymentAttempt = z.infer<typeof paymentAttemptSchema>

export interface InvoicesFilters {
  page?: number
  itemPerPage?: number
  paymentStatus?: PaymentStatus | ''
  paymentMethod?: PaymentMethod | ''
  createdFrom?: string
  createdTo?: string
  orderSessionId?: string
  employeeId?: string
  shiftId?: string
}

export interface CreatePaymentAttemptPayload {
  idempotencyKey: string
  provider: PaymentProvider
  locale?: 'vn' | 'en'
  bankCode?: string
  closeSessionAfterPayment?: boolean
}

export interface UpdateInvoicePaymentPayload {
  paymentStatus: 'PAID'
  paymentMethod?: 'CASH' | 'CARD'
  amountTendered?: string
  closeSessionAfterPayment?: boolean
}

export async function getInvoices(
  filters: InvoicesFilters = {},
  signal?: AbortSignal,
): Promise<InvoicesResponse> {
  const params = new URLSearchParams()
  if (filters.page) params.set('page', String(filters.page))
  if (filters.itemPerPage) params.set('itemPerPage', String(filters.itemPerPage))
  if (filters.paymentStatus) params.set('paymentStatus', filters.paymentStatus)
  if (filters.paymentMethod) params.set('paymentMethod', filters.paymentMethod)
  if (filters.createdFrom) params.set('createdFrom', filters.createdFrom)
  if (filters.createdTo) params.set('createdTo', filters.createdTo)
  if (filters.orderSessionId) params.set('orderSessionId', filters.orderSessionId)
  if (filters.employeeId) params.set('employeeId', filters.employeeId)
  if (filters.shiftId) params.set('shiftId', filters.shiftId)

  const query = params.toString()
  const path = query ? `/invoices?${query}` : '/invoices'
  return apiGet(path, invoicesResponseSchema, signal ?? new AbortController().signal, true)
}

export async function getInvoiceById(
  id: string,
  signal?: AbortSignal,
): Promise<Invoice> {
  return apiGet(`/invoices/${id}`, invoiceSchema, signal ?? new AbortController().signal, true)
}

export async function voidInvoice(id: string): Promise<Invoice> {
  return apiMutate(`/invoices/${id}/void`, 'POST', invoiceSchema, {})
}

export async function updateInvoicePayment(
  id: string,
  payload: UpdateInvoicePaymentPayload,
): Promise<Invoice> {
  return apiMutate(`/invoices/${id}/payment`, 'PATCH', invoiceSchema, payload)
}

export async function createPaymentAttempt(
  invoiceId: string,
  payload: CreatePaymentAttemptPayload,
): Promise<PaymentAttempt> {
  return apiMutate(
    `/invoices/${invoiceId}/payment-attempts`,
    'POST',
    paymentAttemptSchema,
    payload,
  )
}

export async function getInvoicePaymentAttempts(
  invoiceId: string,
  signal?: AbortSignal,
): Promise<{ list: PaymentAttempt[]; totalItems: number; totalPages: number }> {
  return apiGet(
    `/invoices/${invoiceId}/payment-attempts`,
    paymentAttemptsResponseSchema,
    signal ?? new AbortController().signal,
    true,
  )
}

export async function reconcilePaymentAttempt(
  attemptId: string,
): Promise<PaymentAttempt> {
  return apiMutate(
    `/payment-attempts/${attemptId}/reconcile`,
    'POST',
    paymentAttemptSchema,
    {},
  )
}
