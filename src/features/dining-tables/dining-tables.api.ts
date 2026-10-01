import { z } from 'zod'
import { apiGet, apiMutate } from '../../shared/api/client'

export const tableStatusSchema = z.enum(['EMPTY', 'OCCUPIED', 'RESERVED'])
export type TableStatus = z.infer<typeof tableStatusSchema>

export const tableActiveOrderItemSchema = z.object({
  id: z.string(),
  quantity: z.number().int(),
  serveStatus: z.enum(['PENDING', 'COOKING', 'READY', 'SERVED', 'CANCELLED']),
  isPaid: z.boolean().optional(),
})

export const tableActiveSessionSchema = z.object({
  id: z.string(),
  sessionStatus: z.string(),
  guestCount: z.number().nullable().optional(),
  createdAt: z.string().optional(),
  orderItems: z.array(tableActiveOrderItemSchema).optional(),
})

export const diningTableAdminSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: tableStatusSchema,
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  orderSessions: z.array(tableActiveSessionSchema).optional(),
})

export type DiningTableAdmin = z.infer<typeof diningTableAdminSchema>

export const createDiningTableSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Tên bàn không được để trống')
    .max(50, 'Tên bàn tối đa 50 ký tự'),
})

export type CreateDiningTableInput = z.infer<typeof createDiningTableSchema>

export const updateDiningTableSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Tên bàn không được để trống')
    .max(50, 'Tên bàn tối đa 50 ký tự'),
})

export type UpdateDiningTableInput = z.infer<typeof updateDiningTableSchema>

export const tableActionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
})

export type TableActionResponse = z.infer<typeof tableActionResponseSchema>

export async function getDiningTablesAdmin(
  signal: AbortSignal,
): Promise<DiningTableAdmin[]> {
  return apiGet('/dining-tables', z.array(diningTableAdminSchema), signal, true)
}

export async function createDiningTable(
  payload: CreateDiningTableInput,
): Promise<DiningTableAdmin> {
  return apiMutate('/dining-tables', 'POST', diningTableAdminSchema, {
    name: payload.name.trim(),
  })
}

export async function updateDiningTable(
  id: string,
  payload: UpdateDiningTableInput,
): Promise<DiningTableAdmin> {
  return apiMutate(`/dining-tables/${id}`, 'PATCH', diningTableAdminSchema, {
    name: payload.name.trim(),
  })
}

export async function deleteDiningTable(
  id: string,
): Promise<TableActionResponse> {
  return apiMutate(
    `/dining-tables/${id}`,
    'DELETE',
    tableActionResponseSchema,
    undefined,
  )
}

export async function clearDiningTable(
  id: string,
): Promise<TableActionResponse> {
  return apiMutate(
    `/orders/tables/${id}/clear`,
    'POST',
    tableActionResponseSchema,
    {},
  )
}

export async function transferTable(
  fromTableId: string,
  toTableId: string,
): Promise<TableActionResponse> {
  return apiMutate(
    '/orders/sessions/transfer-table',
    'POST',
    tableActionResponseSchema,
    { fromTableId, toTableId },
  )
}

export async function mergeTables(
  sourceTableIds: string[],
  destinationTableId: string,
): Promise<TableActionResponse> {
  return apiMutate(
    '/orders/sessions/merge',
    'POST',
    tableActionResponseSchema,
    { sourceTableIds, destinationTableId },
  )
}
