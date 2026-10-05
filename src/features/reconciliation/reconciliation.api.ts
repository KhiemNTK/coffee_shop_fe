import { z } from 'zod'
import { apiGet, apiMutate } from '@/shared/api/client'
import { paginatedResponseSchema } from '@/shared/api/types'
import { moneySchema } from '../menu/menu.api'

export const incidentSchema = z.object({
  id: z.string(), type: z.string(), status: z.enum(['OPEN', 'RESOLVED', 'IGNORED']),
  title: z.string(), detectedAt: z.string(), paymentAttemptId: z.string(),
  paymentRefundId: z.string().nullable(), resolutionNote: z.string().nullable(),
  paymentAttempt: z.object({ id: z.string(), status: z.string(), amount: moneySchema,
    invoiceId: z.string(), merchantReference: z.string() }),
})
export const bankEntrySchema = z.object({
  id: z.string(), externalId: z.string(), direction: z.enum(['CREDIT', 'DEBIT']),
  amount: moneySchema, transactionDate: z.string(), bankReference: z.string().nullable(),
  description: z.string().nullable(), matchStatus: z.enum(['UNMATCHED', 'MATCHED', 'MISMATCH', 'IGNORED']),
  mismatchReason: z.string().nullable(),
})
export const bankImportSchema = z.object({
  id: z.string(), sourceFileName: z.string(), statementFrom: z.string(), statementTo: z.string(),
  createdAt: z.string(), fundId: z.string(), fund: z.object({ id: z.string(), name: z.string() }),
})
export const bankInputSchema = z.object({
  fundId: z.uuid(), sourceFileName: z.string().trim().min(1).max(255),
  statementFrom: z.iso.datetime({ offset: true }), statementTo: z.iso.datetime({ offset: true }),
  entries: z.array(z.object({
    externalId: z.string().trim().min(1).max(120), direction: z.enum(['CREDIT', 'DEBIT']),
    amount: z.string().regex(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/).refine(v => Number(v) > 0),
    transactionDate: z.iso.datetime({ offset: true }),
    bankReference: z.string().min(3).max(100).regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/).optional(),
    description: z.string().trim().min(1).max(500).optional(),
  })).min(1).max(100),
}).superRefine((value, ctx) => {
  if (Date.parse(value.statementFrom) >= Date.parse(value.statementTo))
    ctx.addIssue({ code: 'custom', path: ['statementTo'], message: 'Ngày kết thúc phải sau ngày bắt đầu.' })
  const ids = value.entries.map(e => e.externalId.toUpperCase())
  if (new Set(ids).size !== ids.length)
    ctx.addIssue({ code: 'custom', path: ['entries'], message: 'Mã giao dịch bị trùng.' })
  value.entries.forEach((entry, i) => {
    if (Date.parse(entry.transactionDate) < Date.parse(value.statementFrom) ||
        Date.parse(entry.transactionDate) >= Date.parse(value.statementTo))
      ctx.addIssue({ code: 'custom', path: ['entries', i], message: 'Giao dịch nằm ngoài kỳ sao kê.' })
  })
})
export type BankInput = z.infer<typeof bankInputSchema>
export type Incident = z.infer<typeof incidentSchema>
export type BankEntry = z.infer<typeof bankEntrySchema>

export function getIncidents(page: number, status: string, signal?: AbortSignal) {
  return apiGet('/payment-reconciliation/incidents?' + new URLSearchParams({
    page: String(page), itemPerPage: '20', ...(status ? { status } : {}),
  }), paginatedResponseSchema(incidentSchema), signal, true)
}
export function closeIncident(id: string, action: 'RESOLVE' | 'IGNORE', resolutionNote: string) {
  return apiMutate('/payment-reconciliation/incidents/' + id + '/resolve', 'POST',
    z.object({ id: z.string(), status: z.string() }), { action, resolutionNote })
}
export function getBankImports(page: number, signal?: AbortSignal) {
  return apiGet('/bank-reconciliation/imports?page=' + page + '&itemPerPage=20',
    paginatedResponseSchema(bankImportSchema), signal, true)
}
export function getBankEntries(importId: string, page: number, signal?: AbortSignal) {
  return apiGet('/bank-reconciliation/entries?' + new URLSearchParams({
    importId, page: String(page), itemPerPage: '20',
  }), paginatedResponseSchema(bankEntrySchema), signal, true)
}
export function importBankStatement(input: BankInput) {
  return apiMutate('/bank-reconciliation/imports', 'POST',
    z.object({ statementImport: bankImportSchema, reconciliationPending: z.boolean().optional() }), input)
}
export function reconcileBank(id: string) {
  return apiMutate('/bank-reconciliation/imports/' + id + '/reconcile', 'POST',
    z.object({ UNMATCHED: z.object({ count: z.number(), amount: moneySchema }),
      MATCHED: z.object({ count: z.number(), amount: moneySchema }),
      MISMATCH: z.object({ count: z.number(), amount: moneySchema }),
      IGNORED: z.object({ count: z.number(), amount: moneySchema }) }), {})
}
export function ignoreBankEntry(id: string, reason: string) {
  return apiMutate('/bank-reconciliation/entries/' + id + '/ignore', 'POST', bankEntrySchema, { reason })
}
export function resolveFeedback(id: string, resolutionNote: string) {
  return apiMutate('/orders/takeaway/feedback/' + id + '/resolve', 'POST',
    z.object({ id: z.string(), resolvedAt: z.string().nullable() }), { resolutionNote })
}
