import { z } from 'zod'
import { apiGet, apiMutate } from '../../shared/api/client'
import { selectedOptionsSchema } from '../../shared/api/order-options'

export const kitchenStationSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  prepSlaSeconds: z.number().int(),
  isActive: z.boolean(),
  printDeviceId: z.string().nullable().optional(),
})

export const kitchenStationsResponseSchema = z.object({
  list: z.array(kitchenStationSchema),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative().default(0),
  currentPage: z.number().int().positive().default(1),
})

export const kitchenTicketItemSchema = z.object({
  id: z.uuid(),
  orderItemId: z.uuid(),
  itemName: z.string(),
  quantity: z.number().int().positive(),
  note: z.string().nullable().optional(),
  selectedOptions: selectedOptionsSchema,
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
  const stations: KitchenStation[] = []
  let page = 1
  let total = 0
  do {
    const result = await apiGet(
      `/kitchen/stations?page=${page}&itemPerPage=100&isActive=true`,
      kitchenStationsResponseSchema,
      signal,
      true,
    )
    stations.push(...result.list)
    total = result.totalItems
    page++
    if (!result.list.length) break
  } while (stations.length < total)
  return stations
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
  page = 1,
) {
  const params = new URLSearchParams({
    itemPerPage: '100',
    includeCompleted: includeCompleted ? 'true' : 'false',
    page: String(page),
  })
  if (stationId) params.set('stationId', stationId)

  const result = await apiGet(
    `/kitchen/tickets?${params.toString()}`,
    kitchenTicketsResponseSchema,
    signal || new AbortController().signal,
    true,
  )
  return result
}

export async function updateOrderItemStatus(
  orderItemId: string,
  status: 'COOKING' | 'READY' | 'SERVED',
): Promise<unknown> {
  return apiMutate(
    `/orders/items/${orderItemId}/status`,
    'PATCH',
    z.object({
      id: z.uuid(),
      serveStatus: z.enum(['COOKING', 'READY', 'SERVED']),
    }),
    { serveStatus: status },
  )
}

export function getStationPage(page: number, signal?: AbortSignal) {
  return apiGet(
    `/kitchen/stations?page=${page}&itemPerPage=20`,
    kitchenStationsResponseSchema,
    signal,
    true,
  )
}
export type StationInput = {
  code: string
  name: string
  prepSlaSeconds: number
  printDeviceId: string | null
  isActive?: boolean
}
export function saveStation(id: string | undefined, input: StationInput) {
  return apiMutate(
    id ? `/kitchen/stations/${id}` : '/kitchen/stations',
    id ? 'PATCH' : 'POST',
    kitchenStationSchema,
    input,
  )
}
export function deleteStation(id: string) {
  return apiMutate(
    `/kitchen/stations/${id}`,
    'DELETE',
    z.object({ success: z.boolean() }),
  )
}
