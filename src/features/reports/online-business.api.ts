import { z } from 'zod'
import { apiGet } from '../../shared/api/client'
import { moneySchema } from '../menu/menu.api'

const count = z.number().int().nonnegative()
const percent = z.string().nullable()
const journeyMetrics = z.object({
  submittedCount: count, acceptedCount: count, readyCount: count, paidCount: count, collectedCount: count,
  rejectedCount: count, expiredCount: count, noShowCount: count, pendingCount: count,
  cancelledBeforeReviewCount: count, cancelledAfterAcceptanceCount: count,
  quotedDemand: moneySchema, netReceipts: moneySchema, collectedNetReceipts: moneySchema,
  requestToCollectionRatePercent: percent, acceptanceToCollectionRatePercent: percent, noShowRatePercent: percent,
  averageReviewSeconds: z.number().nullable(), averagePrepSeconds: z.number().nullable(),
})
const onlineJourneySchema = z.object({
  period: z.object({ from: z.string(), to: z.string(), timeZone: z.string(), cohort: z.literal('requestCreatedAt') }),
  summary: journeyMetrics, trend: z.array(journeyMetrics.extend({ bucket: z.string() })),
})
const experimentSchema = z.object({ from: z.string(), to: z.string(), variants: z.array(z.object({
  variant: z.enum(['CONTROL', 'TREATMENT']), assignments: count, offersWithCandidates: count, requests: count, paidOrders: count, attachedOrders: count,
  revenue: moneySchema, paidConversionRate: z.number(), attachedPaidOrderRate: z.number(), revenuePerAssignment: moneySchema, averageOrderValue: moneySchema,
})) })
export function getOnlineJourney(from: string, to: string, signal?: AbortSignal) {
  return apiGet('/reports/online-orders?' + new URLSearchParams({ from, to }), onlineJourneySchema, signal, true)
}
export function getRecommendationExperiment(from: string, to: string, signal?: AbortSignal) {
  return apiGet('/recommendations/experiment?' + new URLSearchParams({ from, to }), experimentSchema, signal, true)
}
