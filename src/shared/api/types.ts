import { z } from 'zod'

export function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    list: z.array(itemSchema),
    totalPages: z.number().int().nonnegative(),
    totalItems: z.number().int().nonnegative(),
    currentPage: z.number().int().nonnegative(),
  })
}

export type PaginatedResponse<T> = {
  list: T[]
  totalPages: number
  totalItems: number
  currentPage: number
}
