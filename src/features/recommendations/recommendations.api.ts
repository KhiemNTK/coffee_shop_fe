import { z } from 'zod'
import { apiGet, apiMutate } from '../../shared/api/client'
import { itemSchema, type MenuItem } from '../menu/menu.api'

const recommendationItemSchema = itemSchema.extend({ menuItemId: z.uuid() })
  .refine(item => item.id === item.menuItemId, 'Recommendation item identity mismatch')
  .transform(({ menuItemId: _menuItemId, ...item }) => item)

export const posRecommendationsResponseSchema = z.object({
  recommendations: z.array(recommendationItemSchema).max(3),
})

const onlineRecommendationsSchema = posRecommendationsResponseSchema.extend({
  variant: z.enum(['CONTROL', 'TREATMENT']),
}).refine(result => result.variant !== 'CONTROL' || result.recommendations.length === 0)

export function getOnlineRecommendations(clientRequestId: string, menuItemIds: string[]) {
  return apiMutate('/recommendations/online', 'POST', onlineRecommendationsSchema,
    { clientRequestId, menuItemIds }, undefined, false)
}

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
