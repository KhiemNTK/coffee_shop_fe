import { moneySchema } from '@/shared/api/money'
import { z } from 'zod'
import { apiGet } from '@/shared/api/client'

export const storefrontPromotionKey = ['public', 'storefront-promotion'] as const
const responseSchema = z.object({
  promotion: z
    .object({
      id: z.uuid(),
      name: z.string().min(1),
      startDate: z.iso.datetime({ offset: true }),
      endDate: z.iso.datetime({ offset: true }),
      discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
      discountValue: moneySchema,
      maxDiscount: moneySchema.nullable(),
      storefrontDescription: z.string().nullable(),
    })
    .nullable(),
})
export type StorefrontPromotionRecord = NonNullable<z.infer<typeof responseSchema>['promotion']>

export function getStorefrontPromotion(signal?: AbortSignal) {
  return apiGet('/promotions/public/featured', responseSchema, signal)
}
