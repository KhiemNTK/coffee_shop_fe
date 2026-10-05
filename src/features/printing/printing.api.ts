import { z } from 'zod'
import { apiGet, apiMutate } from '@/shared/api/client'
import { apiIdempotentMutate } from '@/shared/api/idempotency'
import { paginatedResponseSchema } from '@/shared/api/types'

export const PrintDeviceTypeSchema = z.enum(['RECEIPT', 'KITCHEN'])
export type PrintDeviceType = z.infer<typeof PrintDeviceTypeSchema>

export const PrintDeviceStatusSchema = z.enum(['READY', 'ERROR', 'PAUSED'])
export type PrintDeviceStatus = z.infer<typeof PrintDeviceStatusSchema>

export const PrintJobTypeSchema = z.enum(['RECEIPT', 'KITCHEN_TICKET'])
export type PrintJobType = z.infer<typeof PrintJobTypeSchema>

export const PrintJobStatusSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'PRINTED',
  'FAILED',
  'CANCELLED',
])
export type PrintJobStatus = z.infer<typeof PrintJobStatusSchema>

export const PrintDeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: PrintDeviceTypeSchema,
  paperSize: z.string(),
  isActive: z.boolean(),
  isDefault: z.boolean(),
  status: PrintDeviceStatusSchema,
  isOnline: z.boolean().optional().default(false),
  lastSeenAt: z.string().nullable().optional(),
  lastError: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type PrintDevice = z.infer<typeof PrintDeviceSchema>

export const PrintJobSchema = z.object({
  id: z.string(),
  type: PrintJobTypeSchema,
  status: PrintJobStatusSchema,
  copies: z.number(),
  attempts: z.number(),
  maxAttempts: z.number(),
  availableAt: z.string().nullable().optional(),
  leaseExpiresAt: z.string().nullable().optional(),
  printedAt: z.string().nullable().optional(),
  failedAt: z.string().nullable().optional(),
  lastError: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deviceId: z.string().nullable().optional(),
  device: z
    .object({
      id: z.string(),
      name: z.string(),
      type: PrintDeviceTypeSchema,
    })
    .nullable()
    .optional(),
  requestedById: z.string().nullable().optional(),
  requestedBy: z
    .object({
      id: z.string(),
      fullName: z.string(),
    })
    .nullable()
    .optional(),
  invoiceId: z.string().nullable().optional(),
  kitchenTicketId: z.string().nullable().optional(),
  reprintOfId: z.string().nullable().optional(),
})
export type PrintJob = z.infer<typeof PrintJobSchema>

export const PrintDevicesResponseSchema =
  paginatedResponseSchema(PrintDeviceSchema)
export type PrintDevicesResponse = z.infer<typeof PrintDevicesResponseSchema>

export const PrintJobsResponseSchema = paginatedResponseSchema(PrintJobSchema)
export type PrintJobsResponse = z.infer<typeof PrintJobsResponseSchema>

export const CreateDeviceResponseSchema = z.object({
  device: PrintDeviceSchema,
  apiKey: z.string(),
})
export type CreateDeviceResponse = z.infer<typeof CreateDeviceResponseSchema>

export const RotateKeyResponseSchema = z.object({
  printDeviceId: z.string(),
  apiKey: z.string(),
})
export type RotateKeyResponse = z.infer<typeof RotateKeyResponseSchema>

export const DeleteResponseSchema = z.object({
  success: z.boolean(),
})

export interface CreatePrintDeviceDto {
  name: string
  type: PrintDeviceType
  paperSize: string
  isDefault?: boolean
}

export interface UpdatePrintDeviceDto {
  name?: string
  type?: PrintDeviceType
  paperSize?: string
  isDefault?: boolean
  isActive?: boolean
  status?: PrintDeviceStatus
}

export interface GetPrintDevicesParams {
  keyword?: string
  page?: number
  itemPerPage?: number
  type?: PrintDeviceType
  isActive?: boolean
}

export interface GetPrintJobsParams {
  page?: number
  itemPerPage?: number
  type?: PrintJobType
  status?: PrintJobStatus
  deviceId?: string
  invoiceId?: string
}

export interface RetryPrintJobDto {
  deviceId?: string | null
}

export interface ReprintReceiptDto {
  reason: string
  copies?: number
  deviceId?: string
  idempotencyKey?: string
}

export const printingApi = {
  getDevices: (
    params?: GetPrintDevicesParams,
    signal?: AbortSignal,
  ): Promise<PrintDevicesResponse> => {
    const qs = new URLSearchParams()
    if (params?.keyword?.trim()) qs.set('keyword', params.keyword.trim())
    if (params?.page) qs.set('page', String(params.page))
    if (params?.itemPerPage) qs.set('itemPerPage', String(params.itemPerPage))
    if (params?.type) qs.set('type', params.type)
    if (params?.isActive !== undefined)
      qs.set('isActive', String(params.isActive))
    const query = qs.toString()
    return apiGet(
      `/printing/devices${query ? `?${query}` : ''}`,
      PrintDevicesResponseSchema,
      signal,
      true,
    )
  },

  getActiveDevices: async (signal?: AbortSignal): Promise<PrintDevice[]> => {
    const first = await printingApi.getDevices(
      { page: 1, itemPerPage: 100, isActive: true },
      signal,
    )
    const devices = [...first.list]
    for (let page = 2; page <= first.totalPages; page++) {
      const next = await printingApi.getDevices(
        { page, itemPerPage: 100, isActive: true },
        signal,
      )
      devices.push(...next.list)
    }
    return devices
  },

  getDevice: (id: string, signal?: AbortSignal): Promise<PrintDevice> =>
    apiGet(`/printing/devices/${id}`, PrintDeviceSchema, signal, true),

  createDevice: (dto: CreatePrintDeviceDto): Promise<CreateDeviceResponse> =>
    apiMutate('/printing/devices', 'POST', CreateDeviceResponseSchema, dto),

  updateDevice: (id: string, dto: UpdatePrintDeviceDto): Promise<PrintDevice> =>
    apiMutate(`/printing/devices/${id}`, 'PATCH', PrintDeviceSchema, dto),

  deleteDevice: (id: string): Promise<{ success: boolean }> =>
    apiMutate(`/printing/devices/${id}`, 'DELETE', DeleteResponseSchema),

  rotateKey: (id: string): Promise<RotateKeyResponse> =>
    apiMutate(
      `/printing/devices/${id}/rotate-key`,
      'POST',
      RotateKeyResponseSchema,
      {},
    ),

  getJobs: (
    params?: GetPrintJobsParams,
    signal?: AbortSignal,
  ): Promise<PrintJobsResponse> => {
    const qs = new URLSearchParams()
    if (params?.page) qs.set('page', String(params.page))
    if (params?.itemPerPage) qs.set('itemPerPage', String(params.itemPerPage))
    if (params?.type) qs.set('type', params.type)
    if (params?.status) qs.set('status', params.status)
    if (params?.deviceId) qs.set('deviceId', params.deviceId)
    if (params?.invoiceId) qs.set('invoiceId', params.invoiceId)
    const query = qs.toString()
    return apiGet(
      `/printing/jobs${query ? `?${query}` : ''}`,
      PrintJobsResponseSchema,
      signal,
      true,
    )
  },

  getJob: (id: string, signal?: AbortSignal): Promise<PrintJob> =>
    apiGet(`/printing/jobs/${id}`, PrintJobSchema, signal, true),

  retryJob: (id: string, dto: RetryPrintJobDto): Promise<PrintJob> =>
    apiMutate(`/printing/jobs/${id}/retry`, 'POST', PrintJobSchema, dto),

  reprintReceipt: (
    invoiceId: string,
    dto: ReprintReceiptDto,
  ): Promise<PrintJob> =>
    apiIdempotentMutate(
      `/printing/invoices/${invoiceId}/reprint`,
      PrintJobSchema,
      { ...dto },
    ),
}
