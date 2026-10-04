import { z } from 'zod'
import { apiGet, apiMutate } from '../../shared/api/client'
import { moneySchema } from './menu.api'

// --- Categories ---
export const adminCategorySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
})

export const adminCategoriesResponseSchema = z.object({
  list: z.array(adminCategorySchema),
  totalPages: z.number().int().nonnegative(),
  currentPage: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
})

export type AdminCategory = z.infer<typeof adminCategorySchema>
export type AdminCategoriesResponse = z.infer<typeof adminCategoriesResponseSchema>

export function getAdminCategories(
  params: { page?: number; itemPerPage?: number; keyword?: string },
  signal?: AbortSignal,
) {
  const q = new URLSearchParams({
    page: String(params.page ?? 1),
    itemPerPage: String(params.itemPerPage ?? 50),
  })
  if (params.keyword?.trim()) q.set('keyword', params.keyword.trim())
  return apiGet(`/menu/categories?${q}`, adminCategoriesResponseSchema, signal, true)
}

export function createCategory(data: { name: string; description?: string | null }) {
  return apiMutate('/menu/categories', 'POST', adminCategorySchema, data)
}

export function updateCategory(
  id: string,
  data: { name?: string; description?: string | null },
) {
  return apiMutate(`/menu/categories/${id}`, 'PATCH', adminCategorySchema, data)
}

export function deleteCategory(id: string) {
  return apiMutate(
    `/menu/categories/${id}`,
    'DELETE',
    z.object({ success: z.boolean(), message: z.string().optional() }),
    {},
  )
}

// --- Menu Items ---
export const adminMenuItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: moneySchema,
  isAvailable: z.boolean(),
  categoryId: z.string().optional(),
  kitchenStationId: z.string().nullable().optional(),
  category: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
  kitchenStation: z
    .object({
      id: z.string(),
      code: z.string(),
      name: z.string(),
    })
    .nullable()
    .optional(),
})

export const adminMenuItemsResponseSchema = z.object({
  list: z.array(adminMenuItemSchema),
  totalPages: z.number().int().nonnegative(),
  currentPage: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
})

export type AdminMenuItem = z.infer<typeof adminMenuItemSchema>
export type AdminMenuItemsResponse = z.infer<typeof adminMenuItemsResponseSchema>

export function getAdminItems(
  params: {
    page?: number
    itemPerPage?: number
    keyword?: string
    categoryId?: string
    isAvailable?: boolean
  },
  signal?: AbortSignal,
) {
  const q = new URLSearchParams({
    page: String(params.page ?? 1),
    itemPerPage: String(params.itemPerPage ?? 20),
  })
  if (params.keyword?.trim()) q.set('keyword', params.keyword.trim())
  if (params.categoryId) q.set('categoryId', params.categoryId)
  if (params.isAvailable !== undefined) q.set('isAvailable', String(params.isAvailable))
  return apiGet(`/menu/items?${q}`, adminMenuItemsResponseSchema, signal, true)
}

export function createMenuItem(data: {
  name: string
  price: string | number
  categoryId: string
  kitchenStationId?: string | null
}) {
  return apiMutate('/menu/items', 'POST', adminMenuItemSchema, data)
}

export function updateMenuItem(
  id: string,
  data: {
    name?: string
    price?: string | number
    categoryId?: string
    kitchenStationId?: string | null
  },
) {
  return apiMutate(`/menu/items/${id}`, 'PATCH', adminMenuItemSchema, data)
}

export function updateMenuItemAvailability(id: string, isAvailable: boolean) {
  return apiMutate(
    `/menu/items/${id}/availability`,
    'PATCH',
    adminMenuItemSchema,
    { isAvailable },
  )
}

export function deleteMenuItem(id: string) {
  return apiMutate(
    `/menu/items/${id}`,
    'DELETE',
    z.object({ success: z.boolean(), message: z.string().optional() }),
    {},
  )
}

// --- Stock Status ---
export const itemStockStatusSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  isAvailable: z.boolean(),
  stockStatus: z.enum(['UNTRACKED', 'INSUFFICIENT', 'LOW', 'OK']),
  atRiskIngredients: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
    }),
  ),
})

export const itemStockStatusResponseSchema = z.object({
  list: z.array(itemStockStatusSchema),
  totalPages: z.number().int().nonnegative(),
  currentPage: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
})

export type ItemStockStatus = z.infer<typeof itemStockStatusSchema>
export type ItemStockStatusResponse = z.infer<typeof itemStockStatusResponseSchema>

export function getItemStockStatus(
  params: {
    page?: number
    itemPerPage?: number
    keyword?: string
    categoryId?: string
    isAvailable?: boolean
  },
  signal?: AbortSignal,
) {
  const q = new URLSearchParams({
    page: String(params.page ?? 1),
    itemPerPage: String(params.itemPerPage ?? 50),
  })
  if (params.keyword?.trim()) q.set('keyword', params.keyword.trim())
  if (params.categoryId) q.set('categoryId', params.categoryId)
  if (params.isAvailable !== undefined) q.set('isAvailable', String(params.isAvailable))
  return apiGet(`/menu/items/stock-status?${q}`, itemStockStatusResponseSchema, signal, true)
}

// --- Item Recipe ---
export const recipeIngredientDetailSchema = z.object({
  inventoryItemId: z.uuid(),
  quantity: moneySchema,
  inventoryItem: z.object({
    id: z.uuid(),
    name: z.string(),
    stock: moneySchema,
    unit: z.object({ id: z.uuid(), name: z.string() }).optional(),
    category: z.object({ id: z.uuid(), name: z.string() }).optional(),
  }),
})

export const itemRecipeSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  ingredients: z.array(recipeIngredientDetailSchema),
})

export type ItemRecipe = z.infer<typeof itemRecipeSchema>
export type RecipeIngredientDetail = z.infer<typeof recipeIngredientDetailSchema>

export function getItemRecipe(id: string, signal?: AbortSignal) {
  return apiGet(`/menu/items/${id}/recipe`, itemRecipeSchema, signal, true)
}

export function replaceItemRecipe(
  id: string,
  ingredients: Array<{ inventoryItemId: string; quantity: string | number }>,
) {
  return apiMutate(`/menu/items/${id}/recipe`, 'PUT', itemRecipeSchema, { ingredients })
}

// --- Item Options ---
export const optionIngredientSchema = z.object({
  id: z.uuid().optional(),
  inventoryItemId: z.uuid(),
  quantity: moneySchema,
})

export const optionItemSchema = z.object({
  id: z.uuid().optional(),
  name: z.string(),
  priceDelta: moneySchema,
  ingredients: z.array(optionIngredientSchema).optional().default([]),
})

export const optionGroupSchema = z.object({
  id: z.uuid().optional(),
  name: z.string(),
  minSelected: z.number().int().nonnegative(),
  maxSelected: z.number().int().positive(),
  options: z.array(optionItemSchema),
})

export const itemOptionsSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  optionGroups: z.array(optionGroupSchema),
})

export type ItemOptions = z.infer<typeof itemOptionsSchema>
export type OptionGroup = z.infer<typeof optionGroupSchema>

export function getItemOptions(id: string, signal?: AbortSignal) {
  return apiGet(`/menu/items/${id}/options`, itemOptionsSchema, signal, true)
}

export function replaceItemOptions(
  id: string,
  groups: Array<{
    name: string
    minSelected: number
    maxSelected: number
    options: Array<{
      name: string
      priceDelta: string | number
      ingredients: Array<{ inventoryItemId: string; quantity: string | number }>
    }>
  }>,
) {
  return apiMutate(`/menu/items/${id}/options`, 'PUT', itemOptionsSchema, { groups })
}

// --- Kitchen Stations Helper ---
export const kitchenStationBasicSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  isActive: z.boolean(),
})

export const kitchenStationsResponseSchema = z.object({
  list: z.array(kitchenStationBasicSchema),
  totalPages: z.number().int().nonnegative(),
  currentPage: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
})

export type KitchenStationBasic = z.infer<typeof kitchenStationBasicSchema>

export function getKitchenStationsList(signal?: AbortSignal) {
  return apiGet(
    '/kitchen/stations?page=1&itemPerPage=100',
    kitchenStationsResponseSchema,
    signal,
    true,
  )
}
