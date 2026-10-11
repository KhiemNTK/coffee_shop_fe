import { z } from 'zod'

export const originalRemakeSchema = z.object({
  id: z.string(), replacementItemId: z.string(), reason: z.string(),
})
export const replacementRemakeSchema = z.object({
  id: z.string(), originalItemId: z.string(), reason: z.string(),
})
