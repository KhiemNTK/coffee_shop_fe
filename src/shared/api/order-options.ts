import { z } from 'zod'

export const selectedOptionsSchema = z
  .array(
    z.object({
      id: z.string(),
      groupName: z.string(),
      name: z.string(),
      priceDelta: z.string(),
    }),
  )
  .default([])
