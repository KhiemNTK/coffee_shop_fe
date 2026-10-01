import { z } from 'zod'
import { apiGet, apiMutate } from '../../shared/api/client'
import { moneySchema } from '../menu/menu.api'

// --- Dashboard Report Schemas ---

export const reportPeriodSchema = z.object({
  from: z.string(),
  to: z.string(),
  timeZone: z.string().optional(),
  granularity: z.string().optional(),
})

export const summaryMetricsSchema = z.object({
  paidInvoiceCount: z.number().int().nonnegative(),
  grossSales: moneySchema,
  discountAmount: moneySchema,
  taxAmount: moneySchema,
  netRevenue: moneySchema,
  averageTicket: moneySchema,
  cancelledItemCount: z.number().int().nonnegative(),
  wasteEntryCount: z.number().int().nonnegative(),
  closedShiftCount: z.number().int().nonnegative(),
  discrepantShiftCount: z.number().int().nonnegative(),
  cashShortageAmount: moneySchema,
  cashOverageAmount: moneySchema,
})

export const profitabilityMetricsSchema = z.object({
  asOf: z.string(),
  paidInvoiceCount: z.number().int().nonnegative(),
  grossSales: moneySchema,
  discountAmount: moneySchema,
  taxAmount: moneySchema,
  refundCount: z.number().int().nonnegative(),
  refundAmount: moneySchema,
  netReceipts: moneySchema,
  estimatedNetSalesExTax: moneySchema,
  ingredientCost: moneySchema,
  wasteCost: moneySchema,
  estimatedGrossProfit: moneySchema,
  soldItemCount: z.number().int().nonnegative(),
  itemsWithCostSnapshot: z.number().int().nonnegative(),
  zeroCostSnapshotCount: z.number().int().nonnegative(),
})

export const salesTrendRowSchema = z.object({
  bucket: z.string(),
  paidInvoiceCount: z.number().int().nonnegative(),
  netRevenue: moneySchema,
})

export const paymentMethodRowSchema = z.object({
  paymentMethod: z.string(),
  paidInvoiceCount: z.number().int().nonnegative(),
  netRevenue: moneySchema,
})

export const topSellingItemSchema = z.object({
  menuItemId: z.string(),
  name: z.string(),
  categoryName: z.string(),
  quantitySold: z.number().int().nonnegative(),
  grossSales: moneySchema,
})

export const promotionUsageRowSchema = z.object({
  promotionId: z.string(),
  name: z.string(),
  usageCount: z.number().int().nonnegative(),
  discountAmount: moneySchema,
  netRevenue: moneySchema,
})

export const lowStockReportItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  stock: z.string(),
  unitName: z.string(),
})

export const cashRiskOverviewSchema = z.object({
  openingDiscrepantShiftCount: z.number().int().nonnegative().optional(),
  openingShortageAmount: moneySchema.optional(),
  openingOverageAmount: moneySchema.optional(),
  repeatShortageEmployeeCount: z.number().int().nonnegative().optional(),
})

export const dashboardReportSchema = z.object({
  period: reportPeriodSchema,
  summary: summaryMetricsSchema,
  profitability: profitabilityMetricsSchema,
  trend: z.array(salesTrendRowSchema),
  paymentMethods: z.array(paymentMethodRowSchema),
  topItems: z.array(topSellingItemSchema),
  promotions: z.array(promotionUsageRowSchema),
  lowStockItems: z.array(lowStockReportItemSchema),
  cashRisk: z.object({
    overview: cashRiskOverviewSchema.optional(),
    varianceTrend: z.array(z.record(z.string(), z.unknown())).optional(),
    employees: z.array(z.record(z.string(), z.unknown())).optional(),
  }),
})

export type DashboardReport = z.infer<typeof dashboardReportSchema>
export type SummaryMetrics = z.infer<typeof summaryMetricsSchema>
export type ProfitabilityMetrics = z.infer<typeof profitabilityMetricsSchema>
export type SalesTrendRow = z.infer<typeof salesTrendRowSchema>
export type PaymentMethodRow = z.infer<typeof paymentMethodRowSchema>
export type TopSellingItem = z.infer<typeof topSellingItemSchema>

// --- Kitchen SLA & Bottlenecks Schemas ---

export const kitchenSlaStationSchema = z.object({
  stationId: z.string().nullable().optional(),
  stationName: z.string(),
  totalTickets: z.number().int().nonnegative(),
  completedTickets: z.number().int().nonnegative(),
  breachedTickets: z.number().int().nonnegative(),
  breachRatePercent: z.number().nonnegative(),
  averageTicketToReadySeconds: z.number().nullable().optional(),
  p95TicketToReadySeconds: z.number().nullable().optional(),
})

export const kitchenSlaResponseSchema = z.object({
  period: z.object({ from: z.string(), to: z.string() }),
  stations: z.array(kitchenSlaStationSchema),
})

export const kitchenBottleneckSlotSchema = z.object({
  bucketStartAt: z.string(),
  stationId: z.string().nullable().optional(),
  stationName: z.string(),
  totalTickets: z.number().int().nonnegative(),
  completedTickets: z.number().int().nonnegative(),
  breachedTickets: z.number().int().nonnegative(),
  breachRatePercent: z.number().nonnegative(),
  averageTicketToReadySeconds: z.number().nullable().optional(),
  p95TicketToReadySeconds: z.number().nullable().optional(),
  orderedUnitCount: z.number().int().nonnegative().optional(),
  openNowCount: z.number().int().nonnegative().optional(),
})

export const kitchenBottlenecksResponseSchema = z.object({
  period: z.record(z.string(), z.unknown()),
  slots: z.array(kitchenBottleneckSlotSchema),
})

export type KitchenSlaStation = z.infer<typeof kitchenSlaStationSchema>
export type KitchenBottleneckSlot = z.infer<typeof kitchenBottleneckSlotSchema>

// --- Daily Sales Close Schemas ---

export const dailySalesCloseSchema = z.object({
  id: z.string(),
  businessDate: z.string(),
  closedAt: z.string(),
  closedByEmployeeId: z.string(),
  snapshot: z.record(z.string(), z.unknown()),
  refundDeltaSinceClose: z
    .object({
      count: z.number().int(),
      amount: moneySchema,
    })
    .optional(),
})

export type DailySalesClose = z.infer<typeof dailySalesCloseSchema>

// --- API Functions ---

export interface GetDashboardFilters {
  from?: string
  to?: string
  granularity?: 'day' | 'hour'
  topLimit?: number
  lowStockThreshold?: number
}

export function getDashboardReport(filters: GetDashboardFilters = {}, signal?: AbortSignal) {
  const q = new URLSearchParams()
  if (filters.from) q.set('from', filters.from)
  if (filters.to) q.set('to', filters.to)
  if (filters.granularity) q.set('granularity', filters.granularity)
  if (filters.topLimit) q.set('topLimit', String(filters.topLimit))
  if (filters.lowStockThreshold) q.set('lowStockThreshold', String(filters.lowStockThreshold))

  const query = q.toString()
  return apiGet(`/reports/dashboard${query ? `?${query}` : ''}`, dashboardReportSchema, signal, true)
}

export function getKitchenSlaReport(
  filters: { from?: string; to?: string; stationId?: string } = {},
  signal?: AbortSignal,
) {
  const q = new URLSearchParams()
  if (filters.from) q.set('from', filters.from)
  if (filters.to) q.set('to', filters.to)
  if (filters.stationId) q.set('stationId', filters.stationId)

  const query = q.toString()
  return apiGet(`/reports/kitchen-sla${query ? `?${query}` : ''}`, kitchenSlaResponseSchema, signal, true)
}

export function getKitchenBottlenecks(
  filters: { from?: string; to?: string; stationId?: string } = {},
  signal?: AbortSignal,
) {
  const q = new URLSearchParams()
  if (filters.from) q.set('from', filters.from)
  if (filters.to) q.set('to', filters.to)
  if (filters.stationId) q.set('stationId', filters.stationId)

  const query = q.toString()
  return apiGet(`/reports/kitchen-bottlenecks${query ? `?${query}` : ''}`, kitchenBottlenecksResponseSchema, signal, true)
}

export function getDailySalesClose(businessDate: string, signal?: AbortSignal) {
  return apiGet(`/reports/daily-closes/${businessDate}`, dailySalesCloseSchema, signal, true)
}

export function executeDailySalesClose(businessDate: string) {
  return apiMutate('/reports/daily-closes', 'POST', dailySalesCloseSchema, { businessDate })
}

export async function downloadDashboardExcel(filters: GetDashboardFilters = {}): Promise<Blob> {
  const q = new URLSearchParams()
  if (filters.from) q.set('from', filters.from)
  if (filters.to) q.set('to', filters.to)
  if (filters.granularity) q.set('granularity', filters.granularity)
  if (filters.topLimit) q.set('topLimit', String(filters.topLimit))
  if (filters.lowStockThreshold) q.set('lowStockThreshold', String(filters.lowStockThreshold))

  const query = q.toString()
  const res = await fetch(`/api/v1/reports/dashboard/export${query ? `?${query}` : ''}`, {
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(`Xuất báo cáo Excel thất bại (${res.status})`)
  }
  return res.blob()
}
