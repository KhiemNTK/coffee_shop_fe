import { z } from 'zod'
import { apiGet, apiMutate } from '../../shared/api/client'

const reservationDateTimeSchema = z.iso.datetime({ offset: true })

export const reservationStatusSchema = z.enum(['PENDING', 'ARRIVED', 'CANCELLED', 'NO_SHOW'])
export type ReservationStatus = z.infer<typeof reservationStatusSchema>

export const reservationRequestStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
])
export type ReservationRequestStatus = z.infer<typeof reservationRequestStatusSchema>

export const reservationTableSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
})

export const reservationEmployeeSchema = z.object({
  id: z.string(),
  fullName: z.string(),
})

export const reservationOrderSessionSchema = z.object({
  id: z.string(),
  sessionStatus: z.string(),
  createdAt: reservationDateTimeSchema,
})

export const reservationSchema = z.object({
  id: z.number().int().positive(),
  customerName: z.string().nullable().optional(),
  phoneNumber: z.string(),
  startsAt: reservationDateTimeSchema,
  endsAt: reservationDateTimeSchema,
  guestCount: z.number().int().min(1).max(50),
  notes: z.string().nullable().optional(),
  checkedInAt: reservationDateTimeSchema.nullish(),
  cancelledAt: reservationDateTimeSchema.nullish(),
  cancellationReason: z.string().nullable().optional(),
  noShowAt: reservationDateTimeSchema.nullish(),
  status: reservationStatusSchema,
  tableId: z.string(),
  table: reservationTableSchema.optional(),
  employeeId: z.string().optional(),
  employee: reservationEmployeeSchema.optional(),
  orderSessionId: z.string().nullable().optional(),
  orderSession: reservationOrderSessionSchema.nullable().optional(),
  createdAt: reservationDateTimeSchema.optional(),
  updatedAt: reservationDateTimeSchema.optional(),
})
export type Reservation = z.infer<typeof reservationSchema>
const reservationDetailSchema = reservationSchema.extend({
  updatedAt: reservationDateTimeSchema,
  table: reservationTableSchema,
})

export const paginatedReservationsSchema = z.object({
  list: z.array(reservationSchema),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  currentPage: z.number().int().positive(),
})
export type PaginatedReservations = z.infer<typeof paginatedReservationsSchema>

export const reservationRequestSchema = z.object({
  id: z.string(),
  customerName: z.string(),
  phoneNumber: z.string(),
  startsAt: reservationDateTimeSchema,
  endsAt: reservationDateTimeSchema,
  guestCount: z.number().int().min(1).max(50),
  notes: z.string().nullable().optional(),
  status: reservationRequestStatusSchema,
  rejectionReason: z.string().nullable().optional(),
  cancelledAt: reservationDateTimeSchema.nullish(),
  createdAt: reservationDateTimeSchema,
  reviewedAt: reservationDateTimeSchema.nullish(),
  reviewedById: z.string().nullable().optional(),
  reservationId: z.number().int().positive().nullish(),
})
export type ReservationRequest = z.infer<typeof reservationRequestSchema>

export const paginatedReservationRequestsSchema = z.object({
  list: z.array(reservationRequestSchema),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  currentPage: z.number().int().positive(),
})
export type PaginatedReservationRequests = z.infer<typeof paginatedReservationRequestsSchema>

export const publicBookingResponseSchema = z.object({
  requestId: z.string(),
  status: reservationRequestStatusSchema,
  accessToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
})
export type PublicBookingResponse = z.infer<typeof publicBookingResponseSchema>

export const publicTrackResponseSchema = z.object({
  requestId: z.string(),
  status: reservationRequestStatusSchema,
  startsAt: reservationDateTimeSchema,
  endsAt: reservationDateTimeSchema,
  guestCount: z.number().int().min(1).max(50),
  reservationStatus: reservationStatusSchema.nullable().optional(),
})
export type PublicTrackResponse = z.infer<typeof publicTrackResponseSchema>

export const checkInResultSchema = z.object({
  reservation: z.object({
    id: z.number().int().positive(),
    status: z.literal('ARRIVED'),
    checkedInAt: reservationDateTimeSchema.optional(),
    orderSessionId: z.string().optional(),
  }),
  orderSession: z.object({
    id: z.string(),
    tableId: z.string(),
    sessionStatus: z.string(),
    createdAt: reservationDateTimeSchema,
  }),
})
export type CheckInResult = z.infer<typeof checkInResultSchema>

// ================= API CALLS =================

export interface GetReservationsQuery {
  page?: number
  itemPerPage?: number
  status?: ReservationStatus
  tableId?: string
  phoneNumber?: string
  startsFrom?: string
  startsTo?: string
}

export async function getReservations(
  query: GetReservationsQuery,
  signal?: AbortSignal,
): Promise<PaginatedReservations> {
  const params = new URLSearchParams()
  if (query.page) params.set('page', String(query.page))
  if (query.itemPerPage) params.set('itemPerPage', String(query.itemPerPage))
  if (query.status) params.set('status', query.status)
  if (query.tableId) params.set('tableId', query.tableId)
  if (query.phoneNumber) params.set('phoneNumber', query.phoneNumber)
  if (query.startsFrom) params.set('startsFrom', query.startsFrom)
  if (query.startsTo) params.set('startsTo', query.startsTo)

  const qs = params.toString() ? `?${params.toString()}` : ''
  return apiGet(`/reservations${qs}`, paginatedReservationsSchema, signal, true)
}

export interface GetReservationRequestsQuery {
  page?: number
  itemPerPage?: number
  status?: ReservationRequestStatus | 'ALL'
}

export async function getReservationRequests(
  query: GetReservationRequestsQuery,
  signal?: AbortSignal,
): Promise<PaginatedReservationRequests> {
  const params = new URLSearchParams()
  if (query.page) params.set('page', String(query.page))
  if (query.itemPerPage) params.set('itemPerPage', String(query.itemPerPage))
  if (query.status) params.set('status', query.status)

  const qs = params.toString() ? `?${params.toString()}` : ''
  return apiGet(`/reservations/requests${qs}`, paginatedReservationRequestsSchema, signal, true)
}

export async function getReservationById(id: number, signal?: AbortSignal) {
  return apiGet(`/reservations/${id}`, reservationDetailSchema, signal, true)
}

export function getReservationRequestById(id: string, signal?: AbortSignal) {
  return apiGet(`/reservations/requests/${id}`, reservationRequestSchema, signal, true)
}

export interface CreateReservationPayload {
  customerName?: string
  phoneNumber: string
  tableId: string
  startsAt: string
  endsAt: string
  guestCount: number
  notes?: string
}

export async function createReservation(payload: CreateReservationPayload): Promise<Reservation> {
  return apiMutate('/reservations', 'POST', reservationSchema, payload)
}

export interface UpdateReservationPayload {
  customerName?: string | null
  phoneNumber?: string
  tableId?: string
  startsAt?: string
  endsAt?: string
  guestCount?: number
  notes?: string | null
  expectedUpdatedAt?: string
}

export async function updateReservation(
  id: number,
  payload: UpdateReservationPayload,
): Promise<Reservation> {
  return apiMutate(`/reservations/${id}`, 'PATCH', reservationSchema, payload)
}

export async function cancelReservation(id: number, reason: string): Promise<Reservation> {
  return apiMutate(`/reservations/${id}/cancel`, 'POST', reservationSchema, { reason })
}

export async function checkInReservation(id: number): Promise<CheckInResult> {
  return apiMutate(`/reservations/${id}/check-in`, 'POST', checkInResultSchema, {})
}

export async function approveReservationRequest(
  requestId: string,
  tableId: string,
): Promise<Reservation> {
  return apiMutate(`/reservations/requests/${requestId}/approve`, 'POST', reservationSchema, {
    tableId,
  })
}

export async function rejectReservationRequest(
  requestId: string,
  reason: string,
): Promise<{ requestId: string; status: ReservationRequestStatus }> {
  return apiMutate(
    `/reservations/requests/${requestId}/reject`,
    'POST',
    z.object({ requestId: z.string(), status: reservationRequestStatusSchema }),
    { reason },
  )
}

// ================= PUBLIC CUSTOMER CALLS =================

export interface CreatePublicReservationPayload {
  customerName: string
  phoneNumber: string
  startsAt: string
  endsAt: string
  guestCount: number
  notes?: string
  turnstileToken?: string
  clientRequestToken?: string
}

export async function createPublicReservationRequest(
  payload: CreatePublicReservationPayload,
): Promise<PublicBookingResponse> {
  return apiMutate(
    '/reservations/public/requests',
    'POST',
    publicBookingResponseSchema,
    payload,
    undefined,
    false, // public unauthenticated
  )
}

export async function trackPublicReservationRequest(
  accessToken: string,
): Promise<PublicTrackResponse> {
  return apiMutate(
    '/reservations/public/requests/status',
    'POST',
    publicTrackResponseSchema,
    { accessToken },
    undefined,
    false, // public unauthenticated
  )
}

export async function cancelPublicReservationRequest(
  accessToken: string,
): Promise<{ requestId: string; status: ReservationRequestStatus }> {
  return apiMutate(
    '/reservations/public/requests/cancel',
    'POST',
    z.object({ requestId: z.string(), status: reservationRequestStatusSchema }),
    { accessToken },
    undefined,
    false, // public unauthenticated
  )
}
