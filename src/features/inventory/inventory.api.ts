import { z } from 'zod'
import { apiGet, apiMutate } from '../../shared/api/client'
import { apiIdempotentMutate } from '../../shared/api/idempotency'
import { moneySchema } from '../menu/menu.api'
import { paginatedResponseSchema } from '../../shared/api/types'
import { quantitySchema } from './quantity'

export const inventoryCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
})

export const unitSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
})

export const inventoryItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  stock: quantitySchema,
  reorderPoint: quantitySchema.nullable().optional(),
  averageUnitCost: moneySchema.nullable().optional(),
  categoryId: z.string(),
  unitId: z.string(),
  category: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
  unit: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export const inventoryItemsResponseSchema = z.object({
  list: z.array(inventoryItemSchema),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  currentPage: z.number().int().positive(),
})

export const reorderAlertRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  stock: quantitySchema,
  reorderPoint: quantitySchema,
  shortageQuantity: quantitySchema,
  averageUnitCost: moneySchema.nullable().optional(),
  unitName: z.string(),
  categoryName: z.string(),
})

export const reorderAlertsResponseSchema = z.object({
  list: z.array(reorderAlertRowSchema),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  currentPage: z.number().int().positive(),
})

export const inventoryTransactionSchema = z.object({
  id: z.string(),
  type: z.enum(['IMPORT', 'EXPORT']),
  quantity: quantitySchema,
  unitPrice: moneySchema.nullable().optional(),
  transactionDate: z.string(),
  note: z.string().nullable(),
  inventoryItemId: z.string(),
  inventoryItem: z
    .object({
      id: z.string(),
      name: z.string(),
      unit: z.object({ name: z.string() }).optional(),
    })
    .optional(),
})

export const inventoryTransactionsResponseSchema = z.object({
  list: z.array(inventoryTransactionSchema),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  currentPage: z.number().int().positive(),
})

export type InventoryCategory = z.infer<typeof inventoryCategorySchema>
export type Unit = z.infer<typeof unitSchema>
export type InventoryItem = z.infer<typeof inventoryItemSchema>
export type InventoryItemsResponse = z.infer<
  typeof inventoryItemsResponseSchema
>
export type ReorderAlertRow = z.infer<typeof reorderAlertRowSchema>
export type ReorderAlertsResponse = z.infer<typeof reorderAlertsResponseSchema>
export type InventoryTransaction = z.infer<typeof inventoryTransactionSchema>
export type InventoryTransactionsResponse = z.infer<
  typeof inventoryTransactionsResponseSchema
>

export interface GetInventoryItemsFilters {
  page?: number
  itemPerPage?: number
  keyword?: string
  categoryId?: string
  unitId?: string
  lowStockOnly?: boolean
}

export interface GetReorderAlertsFilters {
  page?: number
  itemPerPage?: number
  keyword?: string
  categoryId?: string
}

export interface GetInventoryTransactionsFilters {
  page?: number
  itemPerPage?: number
  inventoryItemId?: string
  type?: 'IMPORT' | 'EXPORT' | ''
}

export interface CreateInventoryItemPayload {
  name: string
  categoryId: string
  unitId: string
  stock?: number | string
  initialUnitCost?: number | string
  reorderPoint?: number | string
}

export interface UpdateInventoryItemPayload {
  name?: string
  categoryId?: string
  unitId?: string
  reorderPoint?: number | string
}

export interface InventoryImportPayload {
  quantity: number | string
  unitPrice: number | string
  note: string
  idempotencyKey?: string
}

export interface InventoryExportPayload {
  quantity: number | string
  note: string
  idempotencyKey?: string
}

export async function getInventoryItems(
  filters: GetInventoryItemsFilters = {},
  signal?: AbortSignal,
): Promise<InventoryItemsResponse> {
  const params = new URLSearchParams()
  if (filters.page) params.set('page', String(filters.page))
  if (filters.itemPerPage)
    params.set('itemPerPage', String(filters.itemPerPage))
  if (filters.keyword) params.set('keyword', filters.keyword)
  if (filters.categoryId) params.set('categoryId', filters.categoryId)
  if (filters.unitId) params.set('unitId', filters.unitId)
  if (filters.lowStockOnly) params.set('lowStockOnly', 'true')

  const query = params.toString()
  const path = query ? `/inventory/items?${query}` : '/inventory/items'
  return apiGet(
    path,
    inventoryItemsResponseSchema,
    signal ?? new AbortController().signal,
    true,
  )
}

export async function getReorderAlerts(
  filters: GetReorderAlertsFilters = {},
  signal?: AbortSignal,
): Promise<z.infer<typeof reorderAlertsResponseSchema>> {
  const params = new URLSearchParams()
  if (filters.page) params.set('page', String(filters.page))
  if (filters.itemPerPage)
    params.set('itemPerPage', String(filters.itemPerPage))
  if (filters.keyword) params.set('keyword', filters.keyword)
  if (filters.categoryId) params.set('categoryId', filters.categoryId)

  const query = params.toString()
  const path = query
    ? `/inventory/reorder-alerts?${query}`
    : '/inventory/reorder-alerts'
  return apiGet(
    path,
    reorderAlertsResponseSchema,
    signal ?? new AbortController().signal,
    true,
  )
}

async function getLookup<T>(
  path: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T[]> {
  const values: T[] = []
  let page = 1
  let totalPages = 1
  do {
    const result = await apiGet(
      `${path}?page=${page}&itemPerPage=100`,
      paginatedResponseSchema(schema),
      signal,
      true,
    )
    values.push(...result.list)
    totalPages = result.totalPages
    page++
  } while (page <= totalPages)
  return values
}

export async function getInventoryCategories(
  signal?: AbortSignal,
): Promise<InventoryCategory[]> {
  return getLookup(
    '/inventory/categories',
    inventoryCategorySchema,
    signal ?? new AbortController().signal,
  )
}

export async function getInventoryUnits(signal?: AbortSignal): Promise<Unit[]> {
  return getLookup(
    '/inventory/units',
    unitSchema,
    signal ?? new AbortController().signal,
  )
}

export async function getInventoryTransactions(
  filters: GetInventoryTransactionsFilters = {},
  signal?: AbortSignal,
): Promise<z.infer<typeof inventoryTransactionsResponseSchema>> {
  const params = new URLSearchParams()
  if (filters.page) params.set('page', String(filters.page))
  if (filters.itemPerPage)
    params.set('itemPerPage', String(filters.itemPerPage))
  if (filters.inventoryItemId)
    params.set('inventoryItemId', filters.inventoryItemId)
  if (filters.type) params.set('type', filters.type)

  const query = params.toString()
  const path = query
    ? `/inventory/transactions?${query}`
    : '/inventory/transactions'
  return apiGet(
    path,
    inventoryTransactionsResponseSchema,
    signal ?? new AbortController().signal,
    true,
  )
}

export async function importInventory(
  id: string,
  payload: InventoryImportPayload,
): Promise<unknown> {
  return apiIdempotentMutate(`/inventory/items/${id}/import`, z.unknown(), {
    ...payload,
  })
}

export async function exportInventory(
  id: string,
  payload: InventoryExportPayload,
): Promise<unknown> {
  return apiIdempotentMutate(`/inventory/items/${id}/export`, z.unknown(), {
    ...payload,
  })
}

export async function createInventoryItem(
  payload: CreateInventoryItemPayload,
): Promise<InventoryItem> {
  return apiMutate('/inventory/items', 'POST', inventoryItemSchema, payload)
}

export async function updateInventoryItem(
  id: string,
  payload: UpdateInventoryItemPayload,
): Promise<InventoryItem> {
  return apiMutate(
    `/inventory/items/${id}`,
    'PATCH',
    inventoryItemSchema,
    payload,
  )
}

export async function deleteInventoryItem(id: string): Promise<unknown> {
  return apiMutate(`/inventory/items/${id}`, 'DELETE', z.unknown(), undefined)
}

export function getTaxonomy(
  kind: 'categories' | 'units',
  page: number,
  signal?: AbortSignal,
) {
  return apiGet(
    `/inventory/${kind}?page=${page}&itemPerPage=20`,
    paginatedResponseSchema(inventoryCategorySchema),
    signal,
    true,
  )
}
export function saveTaxonomy(
  kind: 'categories' | 'units',
  id: string | undefined,
  input: { name: string; description?: string },
) {
  return apiMutate(
    id ? `/inventory/${kind}/${id}` : `/inventory/${kind}`,
    id ? 'PATCH' : 'POST',
    inventoryCategorySchema,
    input,
  )
}
export function deleteTaxonomy(kind: 'categories' | 'units', id: string) {
  return apiMutate(`/inventory/${kind}/${id}`, 'DELETE', z.unknown())
}
