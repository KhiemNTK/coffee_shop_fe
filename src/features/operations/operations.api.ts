import { z } from 'zod'
import { apiGet } from '@/shared/api/client'

export const ManagementExceptionKindSchema = z.enum([
  'PAYMENT',
  'CASH_EXPENSE',
  'CASH_HANDOVER',
  'FEEDBACK',
  'KITCHEN_OVERDUE',
  'ONLINE_PICKUP_LATE',
])
export type ManagementExceptionKind = z.infer<
  typeof ManagementExceptionKindSchema
>

export const ManagementExceptionsSummarySchema = z.object({
  asOf: z.string().datetime(),
  counts: z.object({
    PAYMENT: z.number().int().nonnegative(),
    CASH_EXPENSE: z.number().int().nonnegative(),
    CASH_HANDOVER: z.number().int().nonnegative(),
    FEEDBACK: z.number().int().nonnegative(),
    KITCHEN_OVERDUE: z.number().int().nonnegative(),
    ONLINE_PICKUP_LATE: z.number().int().nonnegative(),
  }),
  total: z.number().int().nonnegative(),
})
export type ManagementExceptionsSummary = z.infer<
  typeof ManagementExceptionsSummarySchema
>

export const ManagementExceptionItemSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  title: z.string().optional(),
  detectedAt: z.string().optional(),
  paymentAttemptId: z.string().nullable().optional(),
  paymentRefundId: z.string().nullable().optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  description: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  requestedById: z.string().nullable().optional(),
  shiftId: z.string().nullable().optional(),
  status: z.string().optional(),
  settlementStatus: z.string().nullable().optional(),
  varianceAmount: z.union([z.string(), z.number()]).optional(),
  transferAmount: z.union([z.string(), z.number()]).optional(),
  settlementDueAt: z.string().nullable().optional(),
  rating: z.number().optional(),
  comment: z.string().nullable().optional(),
  invoiceId: z.string().nullable().optional(),
  stationId: z.string().optional(),
  station: z.object({ code: z.string(), name: z.string() }).optional(),
  sequence: z.number().int().optional(),
  dueAt: z.string().datetime().optional(),
  pickupAt: z.string().datetime().nullable().optional(),
  orderSessionId: z.string().nullable().optional(),
})
export type ManagementExceptionItem = z.infer<
  typeof ManagementExceptionItemSchema
>

export const ManagementExceptionsListResponseSchema = z.object({
  kind: ManagementExceptionKindSchema,
  list: z.array(ManagementExceptionItemSchema),
  totalPages: z.number(),
  totalItems: z.number(),
  currentPage: z.number(),
})
export type ManagementExceptionsListResponse = z.infer<
  typeof ManagementExceptionsListResponseSchema
>

export const operationsApi = {
  // Management Exceptions
  getManagementExceptionsSummary: (
    signal?: AbortSignal,
  ): Promise<ManagementExceptionsSummary> =>
    apiGet(
      '/management/exceptions/summary',
      ManagementExceptionsSummarySchema,
      signal,
      true,
    ),

  getManagementExceptions: (
    query: {
      kind: ManagementExceptionKind
      page?: number
      itemPerPage?: number
    },
    signal?: AbortSignal,
  ): Promise<ManagementExceptionsListResponse> => {
    const params = new URLSearchParams()
    params.set('kind', query.kind)
    if (query.page) params.set('page', String(query.page))
    if (query.itemPerPage) params.set('itemPerPage', String(query.itemPerPage))
    return apiGet(
      `/management/exceptions?${params.toString()}`,
      ManagementExceptionsListResponseSchema,
      signal,
      true,
    )
  },
}
