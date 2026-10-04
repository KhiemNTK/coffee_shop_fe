import { z } from 'zod'
import { apiGet } from '../../shared/api/client'
import { itemSchema, type MenuItem } from '../menu/menu.api'

export const posRecommendationsResponseSchema = z.object({
  recommendations: z.array(itemSchema),
})

export async function getPosRecommendations(
  sessionId: string,
  signal?: AbortSignal,
): Promise<MenuItem[]> {
  const result = await apiGet(
    `/recommendations/pos/${sessionId}`,
    posRecommendationsResponseSchema,
    signal ?? new AbortController().signal,
    true,
  )
  return result.recommendations
}
