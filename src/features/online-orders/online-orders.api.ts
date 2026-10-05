import { z } from 'zod'
import { apiGet, apiMutate } from '../../shared/api/client'
import { apiIdempotentMutate } from '../../shared/api/idempotency'
import { moneySchema } from '../menu/menu.api'

// --- SCHEMAS ---

export const PickupSlotSchema = z.object({
  pickupAt: z.string(),
  remaining: z.number().int().nonnegative(),
})

export const PickupSlotsResponseSchema = z.object({
  date: z.string(),
  timeZone: z.string(),
  enabled: z.boolean(),
  slots: z.array(PickupSlotSchema),
})

export const OnlineOrderPublicItemSchema = z.object({
  lineNumber: z.number().int().positive(),
  menuItemId: z.string(),
  quotedName: z.string(),
  quotedUnitPrice: moneySchema,
  quotedOptions: z.unknown(),
  quantity: z.number().int().positive(),
  note: z.string().nullable().optional(),
})

export const CreateOrderResponseSchema = z.object({
  requestId: z.string(),
  status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED']),
  expiresAt: z.string(),
  quotedSubtotal: moneySchema,
  pickupAt: z.string().nullable().optional(),
  items: z.array(OnlineOrderPublicItemSchema),
  accessToken: z.string(),
  reorderToken: z.string().nullable().optional(),
  reorderExpiresAt: z.string().nullable().optional(),
})

export const TrackOrderItemSchema = z.object({
  id: z.string(),
  menuItemId: z.string(),
  quantity: z.number().int().positive(),
  note: z.string().nullable().optional(),
  serveStatus: z.enum(['PENDING', 'COOKING', 'READY', 'SERVED', 'CANCELLED']),
  isPaid: z.boolean(),
  selectedOptions: z.unknown(),
})

export const TrackOrderResponseSchema = z.object({
  requestId: z.string(),
  status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED']),
  expiresAt: z.string(),
  rejectionReason: z.string().nullable().optional(),
  cancellationReason: z.string().nullable().optional(),
  noShowAt: z.string().nullable().optional(),
  quotedSubtotal: moneySchema,
  pickupAt: z.string().nullable().optional(),
  items: z.array(OnlineOrderPublicItemSchema),
  fulfillmentStatus: z
    .enum(['PREPARING', 'PARTIALLY_READY', 'READY', 'COLLECTED', 'NEEDS_REVIEW'])
    .nullable()
    .optional(),
  isPaid: z.boolean(),
  orderItems: z.array(TrackOrderItemSchema),
  telegram: z.object({ enabled: z.boolean(), subscribed: z.boolean() }).optional(),
})

export const CancelOrderResponseSchema = z.object({
  requestId: z.string(),
  status: z.string(),
})

export const TelegramLinkResponseSchema = z.object({
  url: z.string().regex(/^https:\/\/t\.me\/[A-Za-z0-9_]{5,32}\?start=[A-Za-z0-9_-]{43}$/),
  expiresAt: z.iso.datetime(),
})

export const PendingOrderSchema = z.object({
  id: z.string(),
  pickupName: z.string(),
  phoneNumber: z.string(),
  quotedSubtotal: moneySchema,
  pickupAt: z.string().nullable().optional(),
  expiresAt: z.string(),
  createdAt: z.string(),
  items: z.array(OnlineOrderPublicItemSchema),
})

export const PendingOrdersPageSchema = z.object({
  list: z.array(PendingOrderSchema),
  totalPages: z.number().int().nonnegative(),
  totalItems: z.number().int().nonnegative(),
  currentPage: z.number().int().positive(),
})

export const FulfillmentOrderItemSchema = z.object({
  id: z.string(),
  quantity: z.number().int().positive(),
  priceAtTime: moneySchema,
  serveStatus: z.enum(['PENDING', 'COOKING', 'READY', 'SERVED', 'CANCELLED']),
  readyAt: z.string().nullable().optional(),
  isPaid: z.boolean(),
  invoiceId: z.string().nullable().optional(),
  selectedOptions: z.unknown(),
  menuItem: z.object({
    name: z.string(),
  }),
})

export const FulfillmentOrderSchema = z.object({
  id: z.string(),
  pickupName: z.string(),
  phoneNumber: z.string(),
  quotedSubtotal: moneySchema,
  createdAt: z.string(),
  pickupAt: z.string().nullable().optional(),
  orderSessionId: z.string().nullable().optional(),
  isOverdue: z.boolean(),
  isNoShowEligible: z.boolean(),
  sessionStatus: z.string().nullable().optional(),
  orderItems: z.array(FulfillmentOrderItemSchema),
  fulfillmentStatus: z
    .enum(['PREPARING', 'PARTIALLY_READY', 'READY', 'COLLECTED', 'NEEDS_REVIEW'])
    .nullable()
    .optional(),
})

export const FulfillmentOrdersPageSchema = z.object({
  list: z.array(FulfillmentOrderSchema),
  totalPages: z.number().int().nonnegative(),
  totalItems: z.number().int().nonnegative(),
  currentPage: z.number().int().positive(),
})

export const CollectOrderResponseSchema = z.object({
  requestId: z.string(),
  invoiceId: z.string(),
  invoiceNumber: z.string(),
  totalAmount: moneySchema,
  amountTendered: moneySchema.nullable().optional(),
  changeAmount: moneySchema.nullable().optional(),
  collectedItemIds: z.array(z.string()),
  collectedAt: z.string(),
})

// --- TYPES ---

export type PickupSlot = z.infer<typeof PickupSlotSchema>
export type PickupSlotsResponse = z.infer<typeof PickupSlotsResponseSchema>
export type OnlineOrderPublicItem = z.infer<typeof OnlineOrderPublicItemSchema>
export type CreateOrderResponse = z.infer<typeof CreateOrderResponseSchema>
export type TrackOrderResponse = z.infer<typeof TrackOrderResponseSchema>
export type PendingOrder = z.infer<typeof PendingOrderSchema>
export type FulfillmentOrder = z.infer<typeof FulfillmentOrderSchema>
export type FulfillmentOrderItem = z.infer<typeof FulfillmentOrderItemSchema>
export type CollectOrderResponse = z.infer<typeof CollectOrderResponseSchema>

export interface PublicOrderItemPayload {
  menuItemId: string
  quantity: number
  note?: string
  optionIds?: string[]
}

export interface CreateOnlineOrderPayload {
  clientRequestId?: string
  pickupName: string
  phoneNumber: string
  pickupAt?: string
  maxSubtotal?: string
  items: PublicOrderItemPayload[]
  turnstileToken?: string
}

// --- PUBLIC API FUNCTIONS ---

export function getPickupSlots(date: string, signal?: AbortSignal) {
  return apiGet(
    `/online-orders/pickup-slots?date=${encodeURIComponent(date)}`,
    PickupSlotsResponseSchema,
    signal ?? new AbortController().signal,
    false, // public endpoint
  )
}

export function createOnlineOrder(
  payload: CreateOnlineOrderPayload,
  signal?: AbortSignal,
) {
  return apiIdempotentMutate('/online-orders/requests', CreateOrderResponseSchema,
    { ...payload }, { keyField: 'clientRequestId', authenticated: false, signal })
}

export const reorderTemplateSchema = z.object({
  items: z.array(z.object({
    menuItemId: z.string(), quantity: z.number().int().positive(),
    note: z.string().optional(), optionIds: z.array(z.string()),
  })),
  quote: z.object({
    previousSubtotal: moneySchema, currentSubtotal: moneySchema.nullable(), canSubmit: z.boolean(),
    lines: z.array(z.object({
      lineNumber: z.number().int(), previousName: z.string(), previousUnitPrice: moneySchema,
      currentName: z.string().nullable(), currentUnitPrice: moneySchema.nullable(),
      available: z.boolean(), reason: z.string().nullable(),
    })),
  }),
})
export function getReorderTemplate(requestId: string, reorderToken: string) {
  return apiMutate('/online-orders/requests/reorder-template', 'POST', reorderTemplateSchema,
    { requestId, reorderToken }, undefined, false)
}
export function issueReorderKey(requestId: string, accessToken: string) {
  return apiMutate('/online-orders/requests/reorder-key', 'POST',
    z.object({ requestId: z.string(), reorderToken: z.string(), expiresAt: z.string() }),
    { requestId, accessToken }, undefined, false)
}
export function revokeReorderKey(requestId: string, reorderToken: string) {
  return apiMutate('/online-orders/requests/reorder-key/revoke', 'POST',
    z.object({ revoked: z.literal(true) }), { requestId, reorderToken }, undefined, false)
}

export function trackOnlineOrder(
  requestId: string,
  accessToken: string,
  signal?: AbortSignal,
) {
  return apiMutate(
    '/online-orders/requests/status',
    'POST',
    TrackOrderResponseSchema,
    { requestId, accessToken },
    signal,
    false, // public endpoint
  )
}

export function cancelOnlineOrder(
  requestId: string,
  accessToken: string,
  signal?: AbortSignal,
) {
  return apiMutate(
    '/online-orders/requests/cancel',
    'POST',
    CancelOrderResponseSchema,
    { requestId, accessToken },
    signal,
    false, // public endpoint
  )
}

export function getTelegramLink(
  requestId: string,
  accessToken: string,
  signal?: AbortSignal,
) {
  return apiMutate(
    '/online-orders/requests/telegram-link',
    'POST',
    TelegramLinkResponseSchema,
    { requestId, accessToken },
    signal,
    false, // public endpoint
  )
}

// --- STAFF API FUNCTIONS ---

export function getPendingOnlineOrders(
  query: { page?: number; itemPerPage?: number } = {},
  signal?: AbortSignal,
) {
  const params = new URLSearchParams()
  if (query.page) params.set('page', String(query.page))
  if (query.itemPerPage) params.set('itemPerPage', String(query.itemPerPage))
  const qs = params.toString() ? `?${params.toString()}` : ''
  return apiGet(
    `/online-orders/requests${qs}`,
    PendingOrdersPageSchema,
    signal ?? new AbortController().signal,
    true,
  )
}

export function getFulfillmentOnlineOrders(
  query: { page?: number; itemPerPage?: number; overdueOnly?: boolean } = {},
  signal?: AbortSignal,
) {
  const params = new URLSearchParams()
  if (query.page) params.set('page', String(query.page))
  if (query.itemPerPage) params.set('itemPerPage', String(query.itemPerPage))
  if (query.overdueOnly) params.set('overdueOnly', 'true')
  const qs = params.toString() ? `?${params.toString()}` : ''
  return apiGet(
    `/online-orders/requests/fulfillment${qs}`,
    FulfillmentOrdersPageSchema,
    signal ?? new AbortController().signal,
    true,
  )
}

export function acceptOnlineOrder(id: string) {
  return apiMutate(
    `/online-orders/requests/${encodeURIComponent(id)}/accept`,
    'POST',
    z.object({
      requestId: z.string(),
      status: z.string(),
      orderSessionId: z.string(),
    }),
    {},
  )
}

export function rejectOnlineOrder(id: string, reason: string) {
  return apiMutate(
    `/online-orders/requests/${encodeURIComponent(id)}/reject`,
    'POST',
    z.object({
      requestId: z.string(),
      status: z.string(),
    }),
    { reason },
  )
}

export function collectOnlineOrder(
  id: string,
  payload: {
    accessToken: string
    amountTendered: string
    idempotencyKey?: string
  },
) {
  return apiIdempotentMutate(
    `/online-orders/requests/${encodeURIComponent(id)}/collect`,
    CollectOrderResponseSchema,
    { ...payload },
  )
}

export function cancelAcceptedOnlineOrder(id: string, reason: string) {
  return apiMutate(
    `/online-orders/requests/${encodeURIComponent(id)}/cancel`,
    'POST',
    z.object({
      requestId: z.string(),
      status: z.string(),
      noShowAt: z.string().nullable().optional(),
    }),
    { reason },
  )
}

export function markOnlineOrderNoShow(id: string) {
  return apiMutate(
    `/online-orders/requests/${encodeURIComponent(id)}/no-show`,
    'POST',
    z.object({
      requestId: z.string(),
      status: z.string(),
      noShowAt: z.string(),
    }),
    {},
  )
}
