import { z } from 'zod'
import { apiGet } from '../../shared/api/client'

const decimalSchema = z.string().regex(/^\d{1,16}(\.\d{1,2})?$/)

export const moneySchema = z.union([
  decimalSchema,
  z
    .number()
    .finite()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER / 100)
    .transform(String)
    .pipe(decimalSchema),
])
const categorySchema = z.object({ id: z.uuid(), name: z.string() })
export const itemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  price: moneySchema,
  category: categorySchema,
  optionGroups: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      minSelected: z.number().int().nonnegative(),
      maxSelected: z.number().int().nonnegative(),
      options: z.array(
        z.object({ id: z.uuid(), name: z.string(), priceDelta: moneySchema }),
      ),
    }),
  ),
})
const pageSchema = z.object({
  list: z.array(itemSchema),
  totalPages: z.number().int().nonnegative(),
  totalItems: z.number().int().nonnegative(),
  currentPage: z.number().int().positive(),
})

export type MenuItem = z.infer<typeof itemSchema>
export type MenuFilters = { keyword: string; categoryId: string; page: number }

export function getCategories(signal: AbortSignal) {
  return apiGet('/menu/public/categories', z.array(categorySchema), signal)
}

export function getMenu(filters: MenuFilters, signal: AbortSignal) {
  const params = new URLSearchParams({
    page: String(filters.page),
    itemPerPage: '12',
  })
  if (filters.keyword) params.set('keyword', filters.keyword)
  if (filters.categoryId) params.set('categoryId', filters.categoryId)
  return apiGet(`/menu/public/items?${params}`, pageSchema, signal)
}

export { formatPrice, formatVnd } from '@/shared/lib/format'
