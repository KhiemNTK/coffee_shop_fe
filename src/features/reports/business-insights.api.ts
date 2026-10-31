import { z } from 'zod'
import { apiGet, apiMutate, ApiError, sessionEvents } from '../../shared/api/client.js'
import { i18n } from '../../shared/i18n/index.js'

const insightRoot = (employeeId: string) => ['private', employeeId, 'business-insights'] as const
export const businessInsightKeys = {
  all: insightRoot,
  config: (employeeId: string) => [...insightRoot(employeeId), 'config'] as const,
  history: (employeeId: string) => [...insightRoot(employeeId), 'history'] as const,
  job: (employeeId: string, id: string | null) => [...insightRoot(employeeId), 'job', id] as const,
}

const isoDate = z.iso.datetime({ offset: true })
const dateWindow = z.object({ from: isoDate, to: isoDate }).refine(
  period => Date.parse(period.from) < Date.parse(period.to),
)
const periodSchema = dateWindow.safeExtend({ timeZone: z.literal('Asia/Ho_Chi_Minh') })
const configSchema = z.object({
  enabled: z.boolean(), retentionDays: z.literal(7), maxRangeDays: z.literal(31),
})
const requestSchema = periodSchema.safeExtend({ clientRequestId: z.uuid() }).refine(
  period => !insightRangeError(period.from, period.to),
)
export const businessInsightRecoverySchema = z.strictObject({
  request: requestSchema,
  jobId: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
})
const metricKey = z.string().min(1).max(64)
const decimal = z.string().regex(/^-?\d+(?:\.\d+)?$/)
const count = z.string().regex(/^\d+$/)
const metricFields = { key: metricKey, label: z.string().min(1) }
const metricSchema = z.discriminatedUnion('unit', [
  z.object({ ...metricFields, unit: z.literal('VND'), value: decimal, previousValue: decimal }),
  z.object({ ...metricFields, unit: z.literal('COUNT'), value: count, previousValue: count }),
])
const viewSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum(['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED']),
  requestedAt: isoDate,
  model: z.string(),
  promptVersion: z.string(),
  period: periodSchema,
  snapshot: z.object({
    schemaVersion: z.literal(2),
    asOf: isoDate,
    currentPeriod: dateWindow,
    comparisonPeriod: dateWindow,
    timeZone: z.literal('Asia/Ho_Chi_Minh'),
    comparisonBasis: z.enum(['PREVIOUS_DAY_SAME_WINDOW', 'PREVIOUS_EQUAL_DURATION']),
    basis: z.object({
      sales: z.literal('INVOICE_CREATED_AT'),
      refunds: z.literal('COHORT_REFUNDS_AS_OF_SNAPSHOT'),
      waste: z.literal('WASTE_CREATED_AT'),
    }),
    metrics: z.array(metricSchema).max(64),
  }).nullable(),
  analysis: z.strictObject({
    summary: z.string().trim().min(1).max(600),
    findings: z.array(z.strictObject({
      title: z.string().trim().min(1).max(120), kind: z.enum(['OBSERVATION', 'HYPOTHESIS']),
      detail: z.string().trim().min(1).max(500),
      metricKeys: z.array(metricKey).min(1).max(5).refine(keys => new Set(keys).size === keys.length),
      action: z.string().trim().min(1).max(240),
    })).min(1).max(5),
    limitations: z.array(z.string().trim().min(1).max(240)).min(1).max(5),
  }).nullable(),
  errorCode: z.string().nullable(),
}).superRefine((view, context) => {
  const keys = new Set(view.snapshot?.metrics.map(metric => metric.key))
  if (keys.size !== (view.snapshot?.metrics.length ?? 0))
    context.addIssue({ code: 'custom', message: 'Duplicate metric keys' })
  if (view.status === 'COMPLETED' && (!view.snapshot || !view.analysis))
    context.addIssue({ code: 'custom', message: 'Incomplete completed job' })
  if (view.snapshot) {
    const snapshot = view.snapshot
    const duration = Date.parse(view.period.to) - Date.parse(view.period.from)
    const offset = duration < 86_400_000 ? 86_400_000 : duration
    if (Date.parse(snapshot.currentPeriod.from) !== Date.parse(view.period.from) ||
        Date.parse(snapshot.currentPeriod.to) !== Date.parse(view.period.to) ||
        snapshot.timeZone !== view.period.timeZone ||
        snapshot.comparisonBasis !== (duration < 86_400_000 ? 'PREVIOUS_DAY_SAME_WINDOW' : 'PREVIOUS_EQUAL_DURATION') ||
        Date.parse(snapshot.comparisonPeriod.from) !== Date.parse(view.period.from) - offset ||
        Date.parse(snapshot.comparisonPeriod.to) !== Date.parse(view.period.to) - offset)
      context.addIssue({ code: 'custom', message: 'Invalid snapshot period' })
  }
  if (view.analysis && (!view.snapshot || view.analysis.findings.some(
    finding => finding.metricKeys.some(key => !keys.has(key)),
  )))
    context.addIssue({ code: 'custom', message: 'Invalid finding evidence' })
})

export type BusinessInsightRequest = z.infer<typeof requestSchema>
export type BusinessInsight = z.infer<typeof viewSchema>

const historySchema = z.object({
  items: z.array(z.object({
    id: z.string().regex(/^[a-f0-9]{64}$/),
    status: z.enum(['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED']),
    requestedAt: isoDate, expiresAt: isoDate, period: periodSchema,
  })).max(50),
  nextCursor: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
})
export type BusinessInsightHistoryItem = z.infer<typeof historySchema>['items'][number]

export function getBusinessInsightHistory(cursor: string | null, signal?: AbortSignal) {
  const query = new URLSearchParams({ limit: '10' })
  if (cursor) query.set('cursor', cursor)
  return apiGet('/reports/insights?' + query, historySchema, signal, true)
}

export function insightRangeError(from: string, to: string, now = Date.now()) {
  if (!dateWindow.safeParse({ from, to }).success)
    return i18n.t('insights.rangeInvalid')
  if (Date.parse(to) > now)
    return i18n.t('insights.rangeFuture')
  if (Date.parse(to) - Date.parse(from) > 31 * 86_400_000)
    return i18n.t('insights.rangeTooLong')
  return null
}

function checkPeriod(view: BusinessInsight, period: z.infer<typeof periodSchema>) {
  if (Date.parse(view.period.from) !== Date.parse(period.from) ||
      Date.parse(view.period.to) !== Date.parse(period.to) || view.period.timeZone !== period.timeZone)
    throw new ApiError(502, 'CLIENT_RESPONSE_INVALID')
  return view
}

export function getBusinessInsightsConfig(signal?: AbortSignal) {
  return apiGet('/reports/insights/config', configSchema, signal, true)
}

export async function generateBusinessInsight(body: BusinessInsightRequest, signal: AbortSignal) {
  const request = requestSchema.parse(body)
  try {
    // Cookie auth and CSRF remain enabled; do not replay this POST after an implicit refresh.
    const view = await apiMutate('/reports/insights', 'POST', viewSchema, request, signal, false)
    return checkPeriod(view, request)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401)
      sessionEvents.dispatchEvent(new Event('expired'))
    if (error instanceof ApiError && error.status === 403)
      sessionEvents.dispatchEvent(new Event('forbidden'))
    throw error
  }
}

export async function getBusinessInsight(id: string, period: BusinessInsightRequest | null, signal?: AbortSignal) {
  const view = await apiGet('/reports/insights/' + id, viewSchema, signal, true)
  if (view.id !== id) throw new ApiError(502, 'CLIENT_RESPONSE_INVALID')
  return period ? checkPeriod(view, period) : view
}
