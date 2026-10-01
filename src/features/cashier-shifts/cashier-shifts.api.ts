import { z } from 'zod'
import { apiGet, apiMutate, ApiError } from '../../shared/api/client'
import { moneySchema } from '../menu/menu.api'

export const fundSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: z.enum(['CASH', 'BANK', 'OTHER']),
  balance: moneySchema,
})

export const fundsPageSchema = z.object({
  list: z.array(fundSchema),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  currentPage: z.number().int().positive(),
})

export const shiftReconciliationSchema = z.object({
  paidInvoiceCount: z.number().int().nonnegative().optional(),
  cashSales: moneySchema.optional(),
  nonCashSales: moneySchema.optional(),
  totalSales: moneySchema.optional(),
  actualEndingCash: moneySchema.optional(),
  reportedEndingCash: moneySchema.nullable().optional(),
  difference: moneySchema.nullable().optional(),
})

export const cashierShiftSchema = z.object({
  id: z.uuid(),
  openedAt: z.string(),
  closedAt: z.string().nullable().optional(),
  startingCash: moneySchema,
  expectedStartingCash: moneySchema.optional(),
  openingDifference: moneySchema.optional(),
  reportedEndingCash: moneySchema.nullable().optional(),
  actualEndingCash: moneySchema.nullable().optional(),
  closingNote: z.string().nullable().optional(),
  status: z.enum(['OPEN', 'CLOSED']),
  employeeId: z.uuid(),
  employee: z.object({
    id: z.uuid(),
    fullName: z.string(),
  }),
  fundId: z.uuid().nullable().optional(),
  fund: z
    .object({
      id: z.uuid(),
      name: z.string(),
      type: z.string(),
      balance: moneySchema,
    })
    .nullable()
    .optional(),
  reconciliation: shiftReconciliationSchema.optional(),
})

export type Fund = z.infer<typeof fundSchema>
export type CashierShift = z.infer<typeof cashierShiftSchema>

export async function getCurrentShift(
  signal: AbortSignal,
): Promise<CashierShift | null> {
  try {
    return await apiGet('/cashier-shifts/current', cashierShiftSchema, signal, true)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }
    throw error
  }
}

export async function getCashFunds(signal: AbortSignal): Promise<Fund[]> {
  const result = await apiGet('/funds?type=CASH&itemPerPage=50', fundsPageSchema, signal, true)
  return result.list
}

export async function openCashierShift(
  fundId: string,
  startingCash: string,
  idempotencyKey?: string,
): Promise<CashierShift> {
  return apiMutate(
    '/cashier-shifts/open',
    'POST',
    cashierShiftSchema,
    {
      fundId,
      startingCash,
      idempotencyKey: idempotencyKey || crypto.randomUUID(),
    },
  )
}

export async function closeCashierShift(
  reportedEndingCash: string,
  closingNote?: string,
  idempotencyKey?: string,
): Promise<CashierShift> {
  return apiMutate(
    '/cashier-shifts/current/close',
    'POST',
    cashierShiftSchema,
    {
      reportedEndingCash,
      closingNote: closingNote?.trim() || undefined,
      idempotencyKey: idempotencyKey || crypto.randomUUID(),
    },
  )
}

export async function addCashMovement(
  type: 'INCOME' | 'EXPENSE',
  amount: string,
  description: string,
): Promise<unknown> {
  return apiMutate(
    '/cashier-shifts/current/transactions',
    'POST',
    z.any(),
    {
      type,
      amount,
      description,
      idempotencyKey: crypto.randomUUID(),
    },
  )
}
