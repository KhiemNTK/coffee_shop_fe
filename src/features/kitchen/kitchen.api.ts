import { z } from 'zod'
import { apiGet, apiMutate } from '../../shared/api/client'

export const kitchenStationSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  prepSlaSeconds: z.number().int(),
  isActive: z.boolean(),
})

export const kitchenStationsResponseSchema = z.object({
  list: z.array(kitchenStationSchema),
  totalItems: z.number().int().nonnegative(),
})

export const kitchenTicketItemSchema = z.object({
  id: z.uuid(),
  orderItemId: z.uuid(),
  itemName: z.string(),
  quantity: z.number().int().positive(),
  note: z.string().nullable().optional(),
  selectedOptions: z.any().optional(),
  serveStatus: z.enum(['PENDING', 'COOKING', 'READY', 'SERVED', 'CANCELLED']),
  currentTable: z
    .object({
      id: z.uuid(),
      name: z.string(),
    })
    .nullable()
    .optional(),
})

export const kitchenTicketSchema = z.object({
  id: z.uuid(),
  sequence: z.number().int(),
  ticketNumber: z.string(),
  state: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  isOverdue: z.boolean(),
  dueAt: z.string(),
  createdAt: z.string(),
  station: z.object({
    id: z.uuid(),
    code: z.string(),
    name: z.string(),
  }),
  orderSessionId: z.uuid(),
  table: z
    .object({
      id: z.uuid(),
      name: z.string(),
    })
    .nullable(),
  items: z.array(kitchenTicketItemSchema),
})

export const kitchenTicketsResponseSchema = z.object({
  list: z.array(kitchenTicketSchema),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  currentPage: z.number().int().positive(),
})

export const kitchenWorkloadStationSchema = z.object({
  stationId: z.uuid(),
  stationCode: z.string(),
  stationName: z.string(),
  isActive: z.boolean(),
  openTicketCount: z.number().int().nonnegative(),
  openUnitCount: z.number().int().nonnegative(),
  overdueTicketCount: z.number().int().nonnegative(),
  dueSoonTicketCount: z.number().int().nonnegative(),
  oldestOpenAt: z.string().nullable().optional(),
  nextDueAt: z.string().nullable().optional(),
})

export const kitchenWorkloadSchema = z.object({
  asOf: z.string(),
  dueSoonWindowSeconds: z.number().nonnegative(),
  stations: z.array(kitchenWorkloadStationSchema),
})

export type KitchenStation = z.infer<typeof kitchenStationSchema>
export type KitchenTicket = z.infer<typeof kitchenTicketSchema>
export type KitchenTicketItem = z.infer<typeof kitchenTicketItemSchema>
export type KitchenWorkload = z.infer<typeof kitchenWorkloadSchema>

export async function getKitchenStations(
  signal: AbortSignal,
): Promise<KitchenStation[]> {
  const result = await apiGet(
    '/kitchen/stations?itemPerPage=50&isActive=true',
    kitchenStationsResponseSchema,
    signal,
    true,
  )
  return result.list
}

export async function getKitchenWorkload(
  signal: AbortSignal,
): Promise<KitchenWorkload> {
  return apiGet('/kitchen/workload', kitchenWorkloadSchema, signal, true)
}

export async function getKitchenTickets(
  stationId?: string,
  includeCompleted = false,
  signal?: AbortSignal,
): Promise<KitchenTicket[]> {
  const params = new URLSearchParams({
    itemPerPage: '100',
    includeCompleted: includeCompleted ? 'true' : 'false',
  })
  if (stationId) params.set('stationId', stationId)

  const result = await apiGet(
    `/kitchen/tickets?${params.toString()}`,
    kitchenTicketsResponseSchema,
    signal || new AbortController().signal,
    true,
  )
  return result.list
}

export async function updateOrderItemStatus(
  orderItemId: string,
  status: 'COOKING' | 'READY' | 'SERVED' | 'CANCELLED',
): Promise<unknown> {
  return apiMutate(
    `/orders/items/${orderItemId}/status`,
    'PATCH',
    z.any(),
    { status },
  )
}
