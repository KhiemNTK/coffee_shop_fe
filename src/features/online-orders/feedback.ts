import { z } from 'zod'

export const publicFeedbackSchema = z.object({
  id: z.uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  resolvedAt: z.iso.datetime({ offset: true }).nullable(),
  customerReply: z.string().max(500).nullable(),
})
export type PublicFeedback = z.infer<typeof publicFeedbackSchema>
