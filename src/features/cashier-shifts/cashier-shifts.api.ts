import { z } from 'zod'
import { apiGet, apiMutate, ApiError } from '../../shared/api/client'
import { apiIdempotentMutate } from '../../shared/api/idempotency'
import { moneySchema } from '../menu/menu.api'
import { signedMoneySchema } from '../../shared/api/money'

// --- Funds Schemas ---

export const fundTypeSchema = z.enum(['CASH', 'BANK', 'OTHER'])
export type FundType = z.infer<typeof fundTypeSchema>

export const fundSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: fundTypeSchema,
  balance: moneySchema,
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  deletedAt: z.string().nullable().optional(),
  _count: z
    .object({
      shifts: z.number().int().optional(),
      cashTransactions: z.number().int().optional(),
    })
    .optional(),
})

export const fundsPageSchema = z.object({
  list: z.array(fundSchema),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  currentPage: z.number().int().positive(),
})

export type Fund = z.infer<typeof fundSchema>
export type FundsPage = z.infer<typeof fundsPageSchema>

// --- Shifts Schemas ---

export const shiftReconciliationSchema = z.object({
  paidInvoiceCount: z.number().int().nonnegative().optional(),
  cashSales: moneySchema.optional(),
  nonCashSales: moneySchema.optional(),
  totalSales: moneySchema.optional(),
  actualEndingCash: moneySchema.optional(),
  reportedEndingCash: moneySchema.nullable().optional(),
  difference: signedMoneySchema.nullable().optional(),
})

export const cashierShiftSchema = z.object({
  id: z.string(),
  openedAt: z.string(),
  closedAt: z.string().nullable().optional(),
  startingCash: moneySchema,
  expectedStartingCash: moneySchema.optional(),
  openingDifference: signedMoneySchema.optional(),
  difference: signedMoneySchema.nullable().optional(),
  reportedEndingCash: moneySchema.nullable().optional(),
  actualEndingCash: moneySchema.nullable().optional(),
  closingNote: z.string().nullable().optional(),
  status: z.enum(['OPEN', 'CLOSED']),
  employeeId: z.string(),
  employee: z.object({
    id: z.string(),
    fullName: z.string(),
  }),
  fundId: z.string().nullable().optional(),
  fund: z
    .object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      balance: moneySchema,
    })
    .nullable()
    .optional(),
  reconciliation: shiftReconciliationSchema.optional(),
})

export const cashierShiftsPageSchema = z.object({
  list: z.array(cashierShiftSchema),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  currentPage: z.number().int().positive(),
})

export type CashierShift = z.infer<typeof cashierShiftSchema>
export type CashierShiftsPage = z.infer<typeof cashierShiftsPageSchema>

// --- Cash Handovers Schemas ---

export const cashHandoverStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
])
export type CashHandoverStatus = z.infer<typeof cashHandoverStatusSchema>

export const cashHandoverSettlementStatusSchema = z.enum(['PENDING', 'SETTLED'])
export type CashHandoverSettlementStatus = z.infer<
  typeof cashHandoverSettlementStatusSchema
>

export const cashHandoverSchema = z.object({
  id: z.string(),
  shiftId: z.string(),
  sourceFundId: z.string(),
  destinationFundId: z.string(),
  requestedById: z.string(),
  expectedCash: moneySchema,
  countedCash: moneySchema,
  varianceAmount: signedMoneySchema,
  retainedCash: moneySchema,
  transferAmount: moneySchema,
  status: cashHandoverStatusSchema,
  settlementStatus: cashHandoverSettlementStatusSchema,
  settlementDueAt: z.string().nullable().optional(),
  resolvedAt: z.string().nullable().optional(),
  resolutionNote: z.string().nullable().optional(),
  settledAt: z.string().nullable().optional(),
  bankReference: z.string().nullable().optional(),
  evidenceReference: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  requestedBy: z
    .object({
      id: z.string(),
      fullName: z.string(),
    })
    .optional(),
  resolvedBy: z
    .object({
      id: z.string(),
      fullName: z.string(),
    })
    .nullable()
    .optional(),
  settledBy: z
    .object({
      id: z.string(),
      fullName: z.string(),
    })
    .nullable()
    .optional(),
  shift: z
    .object({
      id: z.string(),
      openedAt: z.string().optional(),
      closedAt: z.string().nullable().optional(),
      reportedEndingCash: moneySchema.nullable().optional(),
      actualEndingCash: moneySchema.nullable().optional(),
    })
    .optional(),
  sourceFund: z
    .object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
    })
    .optional(),
  destinationFund: z
    .object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
    })
    .optional(),
})

export const cashHandoversPageSchema = z.object({
  list: z.array(cashHandoverSchema),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  currentPage: z.number().int().positive(),
})

export type CashHandover = z.infer<typeof cashHandoverSchema>
export type CashHandoversPage = z.infer<typeof cashHandoversPageSchema>

// --- Cash Expense Requests Schemas ---

export const cashExpenseRequestStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
])
export type CashExpenseRequestStatus = z.infer<
  typeof cashExpenseRequestStatusSchema
>

export const cashExpenseRequestSchema = z.object({
  id: z.string(),
  amount: moneySchema,
  description: z.string(),
  status: cashExpenseRequestStatusSchema,
  requestedById: z.string(),
  shiftId: z.string(),
  fundId: z.string(),
  reviewedById: z.string().nullable().optional(),
  reviewedAt: z.string().nullable().optional(),
  reviewNote: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  requestedBy: z
    .object({
      id: z.string(),
      fullName: z.string(),
    })
    .optional(),
  reviewedBy: z
    .object({
      id: z.string(),
      fullName: z.string(),
    })
    .nullable()
    .optional(),
  shift: z
    .object({
      id: z.string(),
      openedAt: z.string().optional(),
      closedAt: z.string().nullable().optional(),
    })
    .optional(),
  fund: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
})

export const cashExpenseRequestsPageSchema = z.object({
  list: z.array(cashExpenseRequestSchema),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  currentPage: z.number().int().positive(),
})

export type CashExpenseRequest = z.infer<typeof cashExpenseRequestSchema>
export type CashExpenseRequestsPage = z.infer<
  typeof cashExpenseRequestsPageSchema
>

// --- API Functions: Current Shift ---

export async function getCurrentShift(
  signal?: AbortSignal,
): Promise<CashierShift | null> {
  try {
    return await apiGet(
      '/cashier-shifts/current',
      cashierShiftSchema,
      signal ?? new AbortController().signal,
      true,
    )
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }
    throw error
  }
}

export async function openCashierShift(
  fundId: string,
  startingCash: string,
  idempotencyKey?: string,
): Promise<CashierShift> {
  return apiIdempotentMutate('/cashier-shifts/open', cashierShiftSchema, {
    fundId,
    startingCash,
    idempotencyKey,
  })
}

export async function closeCashierShift(
  reportedEndingCash: string,
  closingNote?: string,
  idempotencyKey?: string,
): Promise<CashierShift> {
  return apiIdempotentMutate(
    '/cashier-shifts/current/close',
    cashierShiftSchema,
    {
      reportedEndingCash,
      closingNote: closingNote?.trim() || undefined,
      idempotencyKey,
    },
  )
}

export async function addCashMovement(
  type: 'INCOME' | 'EXPENSE',
  amount: string,
  description: string,
  idempotencyKey?: string,
) {
  return apiIdempotentMutate('/cashier-shifts/current/transactions', z.object({
    movement: z.object({ id: z.string().min(1), type: z.enum(['INCOME', 'EXPENSE']), amount: moneySchema }).nullable(),
    fundBalance: moneySchema,
    expenseRequest: cashExpenseRequestSchema.nullable(),
  }).refine(result => Boolean(result.movement) !== Boolean(result.expenseRequest)), {
    type,
    amount,
    description,
    idempotencyKey,
  })
}

// --- API Functions: Shifts History ---

export interface GetCashierShiftsParams {
  page?: number
  itemPerPage?: number
  status?: 'OPEN' | 'CLOSED'
  employeeId?: string
  fundId?: string
}

export async function getCashierShifts(
  params: GetCashierShiftsParams = {},
  signal?: AbortSignal,
): Promise<CashierShiftsPage> {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.itemPerPage) q.set('itemPerPage', String(params.itemPerPage))
  if (params.status) q.set('status', params.status)
  if (params.employeeId) q.set('employeeId', params.employeeId)
  if (params.fundId) q.set('fundId', params.fundId)

  const query = q.toString()
  return apiGet(
    `/cashier-shifts${query ? `?${query}` : ''}`,
    cashierShiftsPageSchema,
    signal ?? new AbortController().signal,
    true,
  )
}

// --- API Functions: Funds Management ---
export function getCashierShift(id: string, signal?: AbortSignal) {
  return apiGet(`/cashier-shifts/${id}`, cashierShiftSchema, signal, true)
}

export interface GetFundsParams {
  page?: number
  itemPerPage?: number
  keyword?: string
  type?: 'CASH' | 'BANK' | 'OTHER'
}

export async function getFunds(
  params: GetFundsParams = {},
  signal?: AbortSignal,
): Promise<FundsPage> {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.itemPerPage) q.set('itemPerPage', String(params.itemPerPage))
  if (params.keyword) q.set('keyword', params.keyword)
  if (params.type) q.set('type', params.type)

  const query = q.toString()
  return apiGet(
    `/funds${query ? `?${query}` : ''}`,
    fundsPageSchema,
    signal ?? new AbortController().signal,
    true,
  )
}

export async function getCashFunds(signal?: AbortSignal): Promise<Fund[]> {
  const result = await apiGet(
    '/funds?type=CASH&itemPerPage=100',
    fundsPageSchema,
    signal ?? new AbortController().signal,
    true,
  )
  return result.list
}

export async function createFund(payload: {
  name: string
  type: 'CASH' | 'BANK'
  openingBalance?: string
}): Promise<Fund> {
  return apiMutate('/funds', 'POST', fundSchema, {
    name: payload.name.trim(),
    type: payload.type,
    openingBalance: payload.openingBalance || '0',
  })
}

export async function updateFund(
  id: string,
  payload: { name?: string; type?: 'CASH' | 'BANK' },
): Promise<Fund> {
  return apiMutate(`/funds/${id}`, 'PATCH', fundSchema, payload)
}

export async function deleteFund(
  id: string,
): Promise<{ success: boolean; id: string }> {
  return apiMutate(
    `/funds/${id}`,
    'DELETE',
    z.object({ success: z.boolean(), id: z.string() }),
  )
}

// --- API Functions: Cash Handovers ---

export interface GetCashHandoversParams {
  page?: number
  itemPerPage?: number
  status?: CashHandoverStatus
  settlementStatus?: CashHandoverSettlementStatus
  shiftId?: string
  requestedById?: string
}

export async function getAllCashHandovers(
  params: GetCashHandoversParams = {},
  signal?: AbortSignal,
): Promise<CashHandoversPage> {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.itemPerPage) q.set('itemPerPage', String(params.itemPerPage))
  if (params.status) q.set('status', params.status)
  if (params.settlementStatus)
    q.set('settlementStatus', params.settlementStatus)
  if (params.shiftId) q.set('shiftId', params.shiftId)
  if (params.requestedById) q.set('requestedById', params.requestedById)

  const query = q.toString()
  return apiGet(
    `/cash-handovers${query ? `?${query}` : ''}`,
    cashHandoversPageSchema,
    signal ?? new AbortController().signal,
    true,
  )
}

export async function getMyCashHandovers(
  params: { page?: number; itemPerPage?: number } = {},
  signal?: AbortSignal,
): Promise<CashHandoversPage> {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.itemPerPage) q.set('itemPerPage', String(params.itemPerPage))

  const query = q.toString()
  return apiGet(
    `/cash-handovers/mine${query ? `?${query}` : ''}`,
    cashHandoversPageSchema,
    signal ?? new AbortController().signal,
    true,
  )
}

export async function getOverdueCashHandovers(
  params: { page?: number; itemPerPage?: number } = {},
  signal?: AbortSignal,
): Promise<CashHandoversPage> {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.itemPerPage) q.set('itemPerPage', String(params.itemPerPage))

  const query = q.toString()
  return apiGet(
    `/cash-handovers/overdue${query ? `?${query}` : ''}`,
    cashHandoversPageSchema,
    signal ?? new AbortController().signal,
    true,
  )
}

export async function createCashHandover(payload: {
  shiftId: string
  destinationFundId: string
  retainedCash: string
  note?: string
}): Promise<CashHandover> {
  return apiMutate('/cash-handovers', 'POST', cashHandoverSchema, {
    shiftId: payload.shiftId,
    destinationFundId: payload.destinationFundId,
    retainedCash: payload.retainedCash,
    note: payload.note?.trim() || undefined,
  })
}

export async function approveCashHandover(
  id: string,
  note?: string,
): Promise<CashHandover> {
  return apiMutate(
    `/cash-handovers/${id}/approve`,
    'POST',
    cashHandoverSchema,
    {
      note: note?.trim() || undefined,
    },
  )
}

export async function rejectCashHandover(
  id: string,
  reason: string,
): Promise<CashHandover> {
  return apiMutate(`/cash-handovers/${id}/reject`, 'POST', cashHandoverSchema, {
    reason: reason.trim(),
  })
}

export async function settleCashHandover(
  id: string,
  payload: { bankReference: string; evidenceReference: string },
): Promise<CashHandover> {
  return apiMutate(`/cash-handovers/${id}/settle`, 'POST', cashHandoverSchema, {
    bankReference: payload.bankReference.trim(),
    evidenceReference: payload.evidenceReference.trim(),
  })
}

export async function registerBankDeposit(
  id: string,
  payload: { bankReference: string; evidenceReference: string },
): Promise<CashHandover> {
  return apiMutate(
    `/cash-handovers/${id}/register-deposit`,
    'POST',
    cashHandoverSchema,
    {
      bankReference: payload.bankReference.trim(),
      evidenceReference: payload.evidenceReference.trim(),
    },
  )
}

export async function cancelCashHandover(id: string): Promise<CashHandover> {
  return apiMutate(
    `/cash-handovers/${id}/cancel`,
    'POST',
    cashHandoverSchema,
    {},
  )
}

// --- API Functions: Cash Expense Requests ---

export interface GetExpenseRequestsParams {
  page?: number
  itemPerPage?: number
  status?: CashExpenseRequestStatus
  shiftId?: string
  requestedById?: string
}

export async function getExpenseRequests(
  params: GetExpenseRequestsParams = {},
  signal?: AbortSignal,
): Promise<CashExpenseRequestsPage> {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.itemPerPage) q.set('itemPerPage', String(params.itemPerPage))
  if (params.status) q.set('status', params.status)
  if (params.shiftId) q.set('shiftId', params.shiftId)
  if (params.requestedById) q.set('requestedById', params.requestedById)

  const query = q.toString()
  return apiGet(
    `/cashier-shifts/expense-requests${query ? `?${query}` : ''}`,
    cashExpenseRequestsPageSchema,
    signal ?? new AbortController().signal,
    true,
  )
}

export async function getCurrentShiftExpenseRequests(
  params: { page?: number; itemPerPage?: number } = {},
  signal?: AbortSignal,
): Promise<CashExpenseRequestsPage> {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.itemPerPage) q.set('itemPerPage', String(params.itemPerPage))

  const query = q.toString()
  return apiGet(
    `/cashier-shifts/current/expense-requests${query ? `?${query}` : ''}`,
    cashExpenseRequestsPageSchema,
    signal ?? new AbortController().signal,
    true,
  )
}

export async function approveExpenseRequest(
  id: string,
  note?: string,
): Promise<CashExpenseRequest> {
  return apiMutate(
    `/cashier-shifts/expense-requests/${id}/approve`,
    'POST',
    cashExpenseRequestSchema,
    { note: note?.trim() || undefined },
  )
}

export async function rejectExpenseRequest(
  id: string,
  reason: string,
): Promise<CashExpenseRequest> {
  return apiMutate(
    `/cashier-shifts/expense-requests/${id}/reject`,
    'POST',
    cashExpenseRequestSchema,
    { reason: reason.trim() },
  )
}

export async function cancelCurrentExpenseRequest(
  id: string,
): Promise<unknown> {
  return apiMutate(
    `/cashier-shifts/current/expense-requests/${id}/cancel`,
    'POST',
    z.any(),
    {},
  )
}
