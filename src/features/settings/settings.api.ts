import { z } from 'zod'
import { apiGet, apiMutate } from '@/shared/api/client'

// ==========================================
// 1. EQUIPMENT SCHEMAS & TYPES
// ==========================================

export const EquipmentStatusSchema = z.enum(['IN_USE', 'MAINTENANCE', 'BROKEN', 'LIQUIDATED'])
export type EquipmentStatus = z.infer<typeof EquipmentStatusSchema>

export const EquipmentItemSchema = z.object({
  id: z.string(),
  assetCode: z.string(),
  serialNumber: z.string().nullable().optional(),
  name: z.string(),
  status: EquipmentStatusSchema,
  quantity: z.number(),
  unitPrice: z.union([z.string(), z.number()]),
  totalAmount: z.union([z.string(), z.number()]),
  purchaseDate: z.string(),
  warrantyExpiresAt: z.string().nullable().optional(),
  nextMaintenanceAt: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  employeeId: z.string().optional(),
  employee: z
    .object({
      id: z.string(),
      fullName: z.string(),
    })
    .nullable()
    .optional(),
  _count: z
    .object({
      lifecycleEvents: z.number().optional(),
    })
    .nullable()
    .optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export type EquipmentItem = z.infer<typeof EquipmentItemSchema>

export const EquipmentListResponseSchema = z.object({
  list: z.array(EquipmentItemSchema),
  totalPages: z.number(),
  totalItems: z.number(),
  currentPage: z.number(),
})
export type EquipmentListResponse = z.infer<typeof EquipmentListResponseSchema>

export const EquipmentLifecycleEventSchema = z.object({
  id: z.string(),
  equipmentId: z.string(),
  employeeId: z.string().optional(),
  employee: z
    .object({
      id: z.string(),
      fullName: z.string(),
    })
    .nullable()
    .optional(),
  fromStatus: EquipmentStatusSchema.nullable().optional(),
  toStatus: EquipmentStatusSchema,
  reason: z.string(),
  cost: z.union([z.string(), z.number()]).nullable().optional(),
  occurredAt: z.string().optional(),
  nextMaintenanceAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
})
export type EquipmentLifecycleEvent = z.infer<typeof EquipmentLifecycleEventSchema>

export const EquipmentEventsResponseSchema = z.object({
  list: z.array(EquipmentLifecycleEventSchema),
  totalPages: z.number(),
  totalItems: z.number(),
  currentPage: z.number(),
})
export type EquipmentEventsResponse = z.infer<typeof EquipmentEventsResponseSchema>

export const TransitionEquipmentResponseSchema = z.object({
  equipment: EquipmentItemSchema,
  event: EquipmentLifecycleEventSchema,
})
export type TransitionEquipmentResponse = z.infer<typeof TransitionEquipmentResponseSchema>

export interface CreateEquipmentInput {
  assetCode: string
  serialNumber?: string | null
  name: string
  quantity: number
  unitPrice: string
  purchaseDate: string
  warrantyExpiresAt?: string | null
  nextMaintenanceAt?: string | null
  location?: string | null
  notes?: string | null
}

export interface UpdateEquipmentInput {
  name?: string
  serialNumber?: string | null
  quantity?: number
  unitPrice?: string
  purchaseDate?: string
  warrantyExpiresAt?: string | null
  nextMaintenanceAt?: string | null
  location?: string | null
  notes?: string | null
}

export interface TransitionEquipmentInput {
  status: EquipmentStatus
  reason: string
  cost?: string
  occurredAt?: string
  nextMaintenanceAt?: string | null
}

export interface GetEquipmentQuery {
  page?: number
  itemPerPage?: number
  keyword?: string
  status?: EquipmentStatus
  maintenanceDueBefore?: string
}

// ==========================================
// 2. SYSTEM SETTINGS SCHEMAS & TYPES
// ==========================================

export const SettingValueTypeSchema = z.enum(['STRING', 'NUMBER', 'BOOLEAN', 'JSON'])
export type SettingValueType = z.infer<typeof SettingValueTypeSchema>

export const SystemSettingItemSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.unknown(),
  valueType: SettingValueTypeSchema,
  description: z.string().nullable().optional(),
  isPublic: z.boolean().default(false),
  version: z.number(),
  updatedById: z.string().nullable().optional(),
  updatedBy: z
    .object({
      id: z.string(),
      fullName: z.string(),
    })
    .nullable()
    .optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export type SystemSettingItem = z.infer<typeof SystemSettingItemSchema>

export const SystemSettingsListResponseSchema = z.object({
  list: z.array(SystemSettingItemSchema),
  totalPages: z.number(),
  totalItems: z.number(),
  currentPage: z.number(),
})
export type SystemSettingsListResponse = z.infer<typeof SystemSettingsListResponseSchema>

export const SystemSettingRevisionSchema = z.object({
  id: z.string(),
  settingId: z.string(),
  employeeId: z.string().optional(),
  employee: z
    .object({
      id: z.string(),
      fullName: z.string(),
    })
    .nullable()
    .optional(),
  version: z.number(),
  value: z.unknown(),
  valueType: SettingValueTypeSchema,
  description: z.string().nullable().optional(),
  isPublic: z.boolean(),
  deletedAt: z.string().nullable().optional(),
  createdAt: z.string(),
})
export type SystemSettingRevision = z.infer<typeof SystemSettingRevisionSchema>

export const SystemSettingRevisionsResponseSchema = z.object({
  list: z.array(SystemSettingRevisionSchema),
  totalPages: z.number(),
  totalItems: z.number(),
  currentPage: z.number(),
})
export type SystemSettingRevisionsResponse = z.infer<typeof SystemSettingRevisionsResponseSchema>

export const DeleteSystemSettingResponseSchema = z.object({
  success: z.boolean(),
  key: z.string(),
  version: z.number(),
})
export type DeleteSystemSettingResponse = z.infer<typeof DeleteSystemSettingResponseSchema>

export interface CreateSystemSettingInput {
  key: string
  value: unknown
  valueType: SettingValueType
  description?: string | null
  isPublic?: boolean
}

export interface UpdateSystemSettingInput {
  expectedVersion: number
  value?: unknown
  description?: string | null
  isPublic?: boolean
}

export interface GetSystemSettingsQuery {
  page?: number
  itemPerPage?: number
  keyword?: string
  valueType?: SettingValueType
}

// ==========================================
// 3. MANAGEMENT EXCEPTIONS SCHEMAS & TYPES
// ==========================================

export const ManagementExceptionsSummarySchema = z.object({
  counts: z.object({
    PAYMENT: z.number().default(0),
    CASH_EXPENSE: z.number().default(0),
    CASH_HANDOVER: z.number().default(0),
    FEEDBACK: z.number().default(0),
  }),
  total: z.number().default(0),
})
export type ManagementExceptionsSummary = z.infer<typeof ManagementExceptionsSummarySchema>

export const ManagementExceptionItemSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  title: z.string().optional(),
  detectedAt: z.string().optional(),
  paymentAttemptId: z.string().nullable().optional(),
  paymentRefundId: z.string().nullable().optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  description: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  requestedById: z.string().nullable().optional(),
  shiftId: z.string().nullable().optional(),
  status: z.string().optional(),
  settlementStatus: z.string().nullable().optional(),
  varianceAmount: z.union([z.string(), z.number()]).optional(),
  transferAmount: z.union([z.string(), z.number()]).optional(),
  settlementDueAt: z.string().nullable().optional(),
  rating: z.number().optional(),
  comment: z.string().nullable().optional(),
  invoiceId: z.string().nullable().optional(),
})
export type ManagementExceptionItem = z.infer<typeof ManagementExceptionItemSchema>

export const ManagementExceptionsListResponseSchema = z.object({
  kind: z.enum(['PAYMENT', 'CASH_EXPENSE', 'CASH_HANDOVER', 'FEEDBACK']),
  list: z.array(ManagementExceptionItemSchema),
  totalPages: z.number(),
  totalItems: z.number(),
  currentPage: z.number(),
})
export type ManagementExceptionsListResponse = z.infer<typeof ManagementExceptionsListResponseSchema>

// ==========================================
// 4. API CLIENT CALLS
// ==========================================

export const settingsApi = {
  // Equipment
  getEquipment: (query?: GetEquipmentQuery, signal?: AbortSignal): Promise<EquipmentListResponse> => {
    const params = new URLSearchParams()
    if (query?.page) params.set('page', String(query.page))
    if (query?.itemPerPage) params.set('itemPerPage', String(query.itemPerPage))
    if (query?.keyword) params.set('keyword', query.keyword)
    if (query?.status) params.set('status', query.status)
    if (query?.maintenanceDueBefore) params.set('maintenanceDueBefore', query.maintenanceDueBefore)
    const qs = params.toString()
    return apiGet(`/equipment${qs ? `?${qs}` : ''}`, EquipmentListResponseSchema, signal, true)
  },

  getEquipmentById: (id: string, signal?: AbortSignal): Promise<EquipmentItem> =>
    apiGet(`/equipment/${id}`, EquipmentItemSchema, signal, true),

  getEquipmentEvents: (
    id: string,
    query?: { page?: number; itemPerPage?: number },
    signal?: AbortSignal,
  ): Promise<EquipmentEventsResponse> => {
    const params = new URLSearchParams()
    if (query?.page) params.set('page', String(query.page))
    if (query?.itemPerPage) params.set('itemPerPage', String(query.itemPerPage))
    const qs = params.toString()
    return apiGet(`/equipment/${id}/events${qs ? `?${qs}` : ''}`, EquipmentEventsResponseSchema, signal, true)
  },

  createEquipment: (data: CreateEquipmentInput): Promise<EquipmentItem> =>
    apiMutate('/equipment', 'POST', EquipmentItemSchema, data),

  updateEquipment: (id: string, data: UpdateEquipmentInput): Promise<EquipmentItem> =>
    apiMutate(`/equipment/${id}`, 'PATCH', EquipmentItemSchema, data),

  transitionEquipment: (
    id: string,
    data: TransitionEquipmentInput,
  ): Promise<TransitionEquipmentResponse> =>
    apiMutate(`/equipment/${id}/transitions`, 'POST', TransitionEquipmentResponseSchema, data),

  // System Settings
  getSystemSettings: (
    query?: GetSystemSettingsQuery,
    signal?: AbortSignal,
  ): Promise<SystemSettingsListResponse> => {
    const params = new URLSearchParams()
    if (query?.page) params.set('page', String(query.page))
    if (query?.itemPerPage) params.set('itemPerPage', String(query.itemPerPage))
    if (query?.keyword) params.set('keyword', query.keyword)
    if (query?.valueType) params.set('valueType', query.valueType)
    const qs = params.toString()
    return apiGet(`/system-settings${qs ? `?${qs}` : ''}`, SystemSettingsListResponseSchema, signal, true)
  },

  getSystemSettingByKey: (key: string, signal?: AbortSignal): Promise<SystemSettingItem> =>
    apiGet(`/system-settings/${key}`, SystemSettingItemSchema, signal, true),

  getSystemSettingRevisions: (
    key: string,
    query?: { page?: number; itemPerPage?: number },
    signal?: AbortSignal,
  ): Promise<SystemSettingRevisionsResponse> => {
    const params = new URLSearchParams()
    if (query?.page) params.set('page', String(query.page))
    if (query?.itemPerPage) params.set('itemPerPage', String(query.itemPerPage))
    const qs = params.toString()
    return apiGet(
      `/system-settings/${key}/revisions${qs ? `?${qs}` : ''}`,
      SystemSettingRevisionsResponseSchema,
      signal,
      true,
    )
  },

  createSystemSetting: (data: CreateSystemSettingInput): Promise<SystemSettingItem> =>
    apiMutate('/system-settings', 'POST', SystemSettingItemSchema, data),

  updateSystemSetting: (key: string, data: UpdateSystemSettingInput): Promise<SystemSettingItem> =>
    apiMutate(`/system-settings/${key}`, 'PATCH', SystemSettingItemSchema, data),

  deleteSystemSetting: (
    key: string,
    expectedVersion: number,
  ): Promise<DeleteSystemSettingResponse> =>
    apiMutate(
      `/system-settings/${key}?expectedVersion=${expectedVersion}`,
      'DELETE',
      DeleteSystemSettingResponseSchema,
      undefined,
    ),

  // Management Exceptions
  getManagementExceptionsSummary: (signal?: AbortSignal): Promise<ManagementExceptionsSummary> =>
    apiGet('/management/exceptions/summary', ManagementExceptionsSummarySchema, signal, true),

  getManagementExceptions: (
    query: {
      kind: 'PAYMENT' | 'CASH_EXPENSE' | 'CASH_HANDOVER' | 'FEEDBACK'
      page?: number
      itemPerPage?: number
    },
    signal?: AbortSignal,
  ): Promise<ManagementExceptionsListResponse> => {
    const params = new URLSearchParams()
    params.set('kind', query.kind)
    if (query.page) params.set('page', String(query.page))
    if (query.itemPerPage) params.set('itemPerPage', String(query.itemPerPage))
    return apiGet(
      `/management/exceptions?${params.toString()}`,
      ManagementExceptionsListResponseSchema,
      signal,
      true,
    )
  },
}
