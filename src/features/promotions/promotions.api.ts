import { z } from 'zod'
import { apiGet, apiMutate } from '../../shared/api/client'

export const discountTypeSchema = z.enum(['PERCENTAGE', 'FIXED_AMOUNT'])
export type DiscountType = z.infer<typeof discountTypeSchema>

export const promotionStatusSchema = z.enum([
  'ACTIVE',
  'UPCOMING',
  'EXPIRED',
  'DELETED',
])
export type PromotionStatus = z.infer<typeof promotionStatusSchema>

export const promotionDecimalSchema = z.union([
  z.number(),
  z.string().regex(/^\d+(\.\d{1,4})?$/),
])

export const promotionSchema = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  discountType: discountTypeSchema,
  discountValue: promotionDecimalSchema,
  maxDiscount: promotionDecimalSchema.nullable().optional(),
  status: promotionStatusSchema,
  usageCount: z.number().int().nonnegative().optional().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable().optional(),
  estimatedDiscountAmount: promotionDecimalSchema.optional(),
})
export type Promotion = z.infer<typeof promotionSchema>

export const paginatedPromotionsSchema = z.object({
  list: z.array(promotionSchema),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  currentPage: z.number().int().positive(),
})
export type PaginatedPromotions = z.infer<typeof paginatedPromotionsSchema>

export const activePromotionsResponseSchema = z.object({
  list: z.array(promotionSchema),
})
export type ActivePromotionsResponse = z.infer<typeof activePromotionsResponseSchema>

// ================= API CALLS =================

export interface SearchPromotionsQuery {
  page?: number
  itemPerPage?: number
  keyword?: string
  discountType?: DiscountType
  status?: PromotionStatus
  validAt?: string
  includeDeleted?: boolean
  sortBy?: 'name' | 'startDate' | 'endDate' | 'createdAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
}

export async function getPromotions(
  query: SearchPromotionsQuery = {},
  signal?: AbortSignal,
): Promise<PaginatedPromotions> {
  const params = new URLSearchParams()
  if (query.page) params.set('page', String(query.page))
  if (query.itemPerPage) params.set('itemPerPage', String(query.itemPerPage))
  if (query.keyword) params.set('keyword', query.keyword)
  if (query.discountType) params.set('discountType', query.discountType)
  if (query.status) params.set('status', query.status)
  if (query.validAt) params.set('validAt', query.validAt)
  if (query.includeDeleted !== undefined) params.set('includeDeleted', String(query.includeDeleted))
  if (query.sortBy) params.set('sortBy', query.sortBy)
  if (query.sortOrder) params.set('sortOrder', query.sortOrder)

  const qs = params.toString() ? `?${params.toString()}` : ''
  return apiGet(`/promotions${qs}`, paginatedPromotionsSchema, signal, true)
}

export interface GetActivePromotionsQuery {
  at?: string
  subTotal?: number | string
}

export async function getActivePromotions(
  query: GetActivePromotionsQuery = {},
  signal?: AbortSignal,
): Promise<ActivePromotionsResponse> {
  const params = new URLSearchParams()
  if (query.at) params.set('at', query.at)
  if (query.subTotal !== undefined) params.set('subTotal', String(query.subTotal))

  const qs = params.toString() ? `?${params.toString()}` : ''
  return apiGet(`/promotions/active${qs}`, activePromotionsResponseSchema, signal, true)
}

export async function getPromotionById(
  id: string,
  signal?: AbortSignal,
): Promise<Promotion> {
  return apiGet(`/promotions/${id}`, promotionSchema, signal, true)
}

export interface CreatePromotionPayload {
  name: string
  startDate: string
  endDate: string
  discountType: DiscountType
  discountValue: number | string
  maxDiscount?: number | string | null
}

export async function createPromotion(
  payload: CreatePromotionPayload,
): Promise<Promotion> {
  return apiMutate('/promotions', 'POST', promotionSchema, payload)
}

export interface UpdatePromotionPayload {
  name?: string
  startDate?: string
  endDate?: string
  discountType?: DiscountType
  discountValue?: number | string
  maxDiscount?: number | string | null
}

export async function updatePromotion(
  id: string,
  payload: UpdatePromotionPayload,
): Promise<Promotion> {
  return apiMutate(`/promotions/${id}`, 'PATCH', promotionSchema, payload)
}

export async function deletePromotion(
  id: string,
): Promise<{ success: boolean; message: string }> {
  return apiMutate(
    `/promotions/${id}`,
    'DELETE',
    z.object({ success: z.boolean(), message: z.string() }),
    undefined,
  )
}

export async function restorePromotion(
  id: string,
): Promise<Promotion> {
  return apiMutate(`/promotions/${id}/restore`, 'POST', promotionSchema, {})
}
