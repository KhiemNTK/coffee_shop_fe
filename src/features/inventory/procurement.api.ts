import { z } from 'zod'
import { apiGet, apiMutate } from '../../shared/api/client'
import { apiIdempotentMutate } from '../../shared/api/idempotency'
import { paginatedResponseSchema } from '../../shared/api/types'
import { moneySchema } from '../menu/menu.api'

const quantitySchema = z.union([z.string(), z.number().finite().transform(String)])
  .pipe(z.string().regex(/^-?\d{1,14}(\.\d{1,4})?$/))
const statusSchema = z.enum(['DRAFT', 'POSTED', 'CANCELLED'])
export const supplierSchema = z.object({
  id: z.string(), code: z.string(), name: z.string(),
  contactName: z.string().nullish(), phoneNumber: z.string().nullish(),
  email: z.string().nullish(), address: z.string().nullish(), taxCode: z.string().nullish(),
  notes: z.string().nullish(),
})
export const receiptSchema = z.object({
  id: z.string(), receiptNumber: z.string(), supplierId: z.string(),
  status: statusSchema, totalAmount: moneySchema, receivedAt: z.string(), note: z.string().nullish(),
})
export const receiptDetailSchema = receiptSchema.extend({
  supplier: supplierSchema,
  items: z.array(z.object({
    inventoryItemId: z.string(), inventoryItemName: z.string(), unitName: z.string(),
    quantity: quantitySchema, unitPrice: moneySchema, totalAmount: moneySchema,
  })),
})
export const stocktakeSchema = z.object({
  id: z.string(), stocktakeNumber: z.string(), status: statusSchema,
  note: z.string().nullish(), createdAt: z.string(),
})
export const stocktakeDetailSchema = stocktakeSchema.extend({
  items: z.array(z.object({
    inventoryItemId: z.string(), inventoryItemName: z.string(), unitName: z.string(),
    expectedQuantity: quantitySchema, countedQuantity: quantitySchema.nullable(),
    differenceQuantity: quantitySchema.nullable(),
  })),
})
export type Supplier = z.infer<typeof supplierSchema>
export type ReceiptDetail = z.infer<typeof receiptDetailSchema>
export type StocktakeDetail = z.infer<typeof stocktakeDetailSchema>
export type SupplierInput = { code: string; name: string; contactName?: string | null; phoneNumber?: string | null; email?: string | null; address?: string | null; taxCode?: string | null; notes?: string | null }
export type ReceiptInput = { supplierId: string; note?: string; items: { inventoryItemId: string; quantity: string; unitPrice: string }[] }

export function getSuppliers(page: number, keyword: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(page) })
  if (keyword.trim()) params.set('keyword', keyword.trim())
  return apiGet(`/inventory/suppliers?${params}`, paginatedResponseSchema(supplierSchema), signal, true)
}
export function saveSupplier(payload: SupplierInput, id?: string) {
  return apiMutate(id ? `/inventory/suppliers/${id}` : '/inventory/suppliers', id ? 'PATCH' : 'POST', supplierSchema, payload)
}
export function deleteSupplier(id: string) {
  return apiMutate(`/inventory/suppliers/${id}`, 'DELETE', z.unknown())
}
export function getReceipts(page: number, signal?: AbortSignal) {
  return apiGet(`/inventory/purchase-receipts?page=${page}`, paginatedResponseSchema(receiptSchema), signal, true)
}
export function getReceipt(id: string, signal?: AbortSignal) {
  return apiGet(`/inventory/purchase-receipts/${id}`, receiptDetailSchema, signal, true)
}
export function saveReceipt(payload: ReceiptInput, id?: string) {
  return id
    ? apiMutate(`/inventory/purchase-receipts/${id}`, 'PATCH', receiptDetailSchema, payload)
    : apiIdempotentMutate('/inventory/purchase-receipts', receiptDetailSchema, { ...payload })
}
export function getStocktakes(page: number, signal?: AbortSignal) {
  return apiGet(`/inventory/stocktakes?page=${page}`, paginatedResponseSchema(stocktakeSchema), signal, true)
}
export function getStocktake(id: string, signal?: AbortSignal) {
  return apiGet(`/inventory/stocktakes/${id}`, stocktakeDetailSchema, signal, true)
}
export function createStocktake(inventoryItemIds: string[], note?: string) {
  return apiIdempotentMutate('/inventory/stocktakes', stocktakeDetailSchema, { inventoryItemIds: [...inventoryItemIds].sort(), note })
}
export function saveCounts(id: string, items: { inventoryItemId: string; countedQuantity: string }[]) {
  return apiMutate(`/inventory/stocktakes/${id}/counts`, 'PUT', stocktakeDetailSchema, { items })
}
export function postDocument(kind: 'purchase-receipts' | 'stocktakes', id: string) {
  return apiIdempotentMutate(`/inventory/${kind}/${id}/post`, z.object({ id: z.string(), status: z.literal('POSTED') }), {})
}
export function cancelDocument(kind: 'purchase-receipts' | 'stocktakes', id: string, reason: string) {
  return apiMutate(`/inventory/${kind}/${id}/cancel`, 'POST', z.object({ id: z.string(), status: z.literal('CANCELLED') }), { reason })
}
