import { z } from 'zod'
import { apiGet } from '@/shared/api/client'
import { paginatedResponseSchema } from '@/shared/api/types'

export const AuditLogItemSchema = z.object({
  id: z.string(),
  actionType: z.string(),
  createdAt: z.string(),
  requestId: z.string().nullable().optional(),
  details: z.unknown().optional(),
  employee: z
    .object({
      id: z.string(),
      fullName: z.string(),
    })
    .nullable()
    .optional(),
})

export type AuditLogItem = z.infer<typeof AuditLogItemSchema>

export const AuditLogsResponseSchema = paginatedResponseSchema(AuditLogItemSchema)
export type AuditLogsResponse = z.infer<typeof AuditLogsResponseSchema>

export interface GetAuditLogsQuery {
  page?: number
  itemPerPage?: number
  employeeId?: string
  actionType?: string
  requestId?: string
  from?: string
  to?: string
}

export const auditLogsApi = {
  getAuditLogs: (
    query?: GetAuditLogsQuery,
    signal?: AbortSignal,
  ): Promise<AuditLogsResponse> => {
    const params = new URLSearchParams()
    if (query?.page) params.set('page', String(query.page))
    if (query?.itemPerPage) params.set('itemPerPage', String(query.itemPerPage))
    if (query?.employeeId) params.set('employeeId', query.employeeId)
    if (query?.actionType) params.set('actionType', query.actionType)
    if (query?.requestId) params.set('requestId', query.requestId)
    if (query?.from) params.set('from', query.from)
    if (query?.to) params.set('to', query.to)
    const qs = params.toString()
    return apiGet(
      `/audit-logs${qs ? `?${qs}` : ''}`,
      AuditLogsResponseSchema,
      signal,
      true,
    )
  },
}
