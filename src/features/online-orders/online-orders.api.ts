import { decimalAmount, minorAmount } from '@/shared/lib/money'
import { moneySchema } from '@/shared/api/money'
import { z } from 'zod'
import { apiGet, apiMutate, ApiError } from '../../shared/api/client'
import { apiIdempotentMutate, clearPendingOperationByKey, findPendingOperationKey } from '../../shared/api/idempotency'
import { readPendingIntent, writePendingIntent } from '../../shared/api/pending-intent'
import { selectedOptionsSchema } from '../../shared/api/order-options'
import { publicFeedbackSchema } from './feedback'

export const onlineOrderKeys = {
  all: (employeeId: string) => ['private', employeeId, 'online-orders'] as const,
}

export const onlineAvailabilitySchema = z.object({
  acceptingOrders: z.boolean(),
  acceptingAsap: z.boolean(),
  asapOpenLocal: z.string(),
  asapCloseLocal: z.string(),
  timeZone: z.string(),
  pausedUntil: z.string().nullable(),
  reason: z.string().nullable(),
})
export function getOnlineAvailability(signal?: AbortSignal) {
  return apiGet('/online-orders/availability', onlineAvailabilitySchema, signal)
}

const intakeStatusSchema = z.object({
  acceptingOrders: z.boolean(),
  pausedUntil: z.iso.datetime({ offset: true }).nullable(),
  reason: z.string().nullable(),
  version: z.number().int().nonnegative(),
})
export function getOnlineIntake(signal?: AbortSignal) {
  return apiGet('/online-orders/intake', intakeStatusSchema, signal, true)
}
export function updateOnlineIntake(payload: {
  expectedVersion: number
  pausedUntil: string | null
  reason: string | null
}) {
  return apiMutate('/online-orders/intake', 'PUT', intakeStatusSchema, payload)
}

const onlineQuoteSchema = z.object({
  canFulfill: z.boolean(),
  reason: z.string().nullable(),
  subtotal: moneySchema,
  items: z.array(z.object({
    menuItemId: z.uuid(),
    quantity: z.number().int().positive(),
    unitPrice: moneySchema,
    selectedOptions: selectedOptionsSchema,
  })).min(1).max(20),
})
export type OnlineOrderQuote = z.infer<typeof onlineQuoteSchema>
export function quoteOnlineOrder(items: PublicOrderItemPayload[], signal?: AbortSignal) {
  return apiMutate('/online-orders/quote', 'POST', onlineQuoteSchema, { items }, signal, false)
}

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
  quotedOptions: selectedOptionsSchema,
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
  accessExpiresAt: z.iso.datetime().optional(),
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
  accessExpiresAt: z.iso.datetime().optional(),
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
  feedback: z.array(publicFeedbackSchema.extend({ invoiceId: z.uuid() })).default([]),
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
  selectedOptions: selectedOptionsSchema,
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
  expectedCustomerId?: string
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

export const onlineOrderRecoveryKey = 'coffee-shop:pending:public:intent:online-order'
const onlineOrderRecoverySchema = z.object({
  clientRequestId: z.uuid(),
  requestHash: z.string().regex(/^[0-9a-f]{64}$/),
  expectedCustomerId: z.uuid().optional(),
  draft: z.object({
    pickupAt: z.iso.datetime({ offset: true }).optional(),
    maxSubtotal: moneySchema.optional(),
    items: z.array(z.object({
      menuItemId: z.uuid(), quantity: z.number().int().min(1).max(20),
      note: z.string().max(255).optional(), optionIds: z.array(z.uuid()).max(20).optional(),
    })).min(1).max(20),
  }).strict().optional(),
}).strict()
export type OnlineOrderRecoveryProof = z.infer<typeof onlineOrderRecoverySchema>

export function readOnlineOrderRecovery() {
  return readPendingIntent(onlineOrderRecoveryKey, onlineOrderRecoverySchema)
}

export async function hashOnlineOrderRequest(payload: CreateOnlineOrderPayload) {
  // Match the validated backend DTO order and normalization; never persist contact data.
  const canonical = JSON.stringify({
    pickupName: payload.pickupName.trim(),
    phoneNumber: payload.phoneNumber.trim(),
    pickupAt: payload.pickupAt ? new Date(payload.pickupAt).toISOString() : undefined,
    maxSubtotal: payload.maxSubtotal ? decimalAmount(minorAmount(payload.maxSubtotal)) : undefined,
    items: payload.items.map(line => ({
      menuItemId: line.menuItemId, quantity: line.quantity,
      note: line.note?.trim(), optionIds: line.optionIds,
    })),
    ...(payload.expectedCustomerId ? { customerId: payload.expectedCustomerId } : {}),
  })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function clearOnlineOrderRecovery(clientRequestId: string) {
  if (readOnlineOrderRecovery()?.payload.clientRequestId === clientRequestId)
    sessionStorage.removeItem(onlineOrderRecoveryKey)
}

export async function createOnlineOrder(payload: CreateOnlineOrderPayload, signal?: AbortSignal) {
  const clientRequestId = payload.clientRequestId ?? await findPendingOnlineOrderKey(payload) ?? crypto.randomUUID()
  const requestHash = await hashOnlineOrderRequest(payload)
  const previous = readOnlineOrderRecovery()
  if (previous && (previous.payload.clientRequestId !== clientRequestId || previous.payload.requestHash !== requestHash))
    throw new ApiError(409, 'ONLINE_ORDER_PENDING_RECOVERY')
  const proof = onlineOrderRecoverySchema.parse({ clientRequestId, requestHash,
      ...(payload.expectedCustomerId ? { expectedCustomerId: payload.expectedCustomerId } : {}),
      draft: { items: payload.items, pickupAt: payload.pickupAt, maxSubtotal: payload.maxSubtotal },
  })
  writePendingIntent(onlineOrderRecoveryKey, {
    payload: proof,
    idempotencyKey: clientRequestId, createdAt: previous?.createdAt ?? Date.now(),
  })
  try {
    const result = await apiIdempotentMutate(
      payload.expectedCustomerId ? '/customers/orders' : '/online-orders/requests',
      CreateOrderResponseSchema, { ...payload, clientRequestId },
      { keyField: 'clientRequestId', authenticated: false, signal },
    )
    clearPendingOperationByKey(payload.expectedCustomerId ? '/customers/orders' : '/online-orders/requests', clientRequestId, false)
    clearOnlineOrderRecovery(clientRequestId)
    return result
  } catch (error) {
    if (!previous && error instanceof ApiError && error.status >= 400 && error.status < 500 && ![408, 429].includes(error.status))
      clearOnlineOrderRecovery(clientRequestId)
    throw error
  }
}

export async function recoverOnlineOrderByKey(proof: OnlineOrderRecoveryProof) {
  const path = proof.expectedCustomerId ? '/customers/orders' : '/online-orders/requests'
  const { draft: _draft, ...credential } = proof
  const result = await apiMutate(`${path}/recover-by-key`, 'POST', CreateOrderResponseSchema, credential, undefined, false)
  clearPendingOperationByKey(path, proof.clientRequestId, false)
  clearOnlineOrderRecovery(proof.clientRequestId)
  return result
}

export async function recoverOnlineOrder(payload: CreateOnlineOrderPayload) {
  if (!payload.clientRequestId) throw new ApiError(409, 'CLIENT_PENDING_OPERATION')
  const path = payload.expectedCustomerId ? '/customers/orders' : '/online-orders/requests'
  const request = { ...payload }
  delete request.turnstileToken
  const result = await apiMutate(`${path}/recover`, 'POST', CreateOrderResponseSchema, request, undefined, false)
  clearPendingOperationByKey(path, payload.clientRequestId, false)
  clearOnlineOrderRecovery(payload.clientRequestId)
  return result
}

export async function findPendingOnlineOrderKey(payload: CreateOnlineOrderPayload) {
  const { expectedCustomerId, ...guestPayload } = payload
  if (
    expectedCustomerId &&
    (await findPendingOperationKey('/online-orders/requests', guestPayload, false))
  )
    throw new ApiError(
      409,
      'CLIENT_PENDING_OPERATION',
      undefined,
      'Có đơn khách vãng lai chưa được xác nhận. Kiểm tra đơn đã gửi trước khi tạo đơn bằng tài khoản.',
    )
  return findPendingOperationKey(
    expectedCustomerId ? '/customers/orders' : '/online-orders/requests',
    { ...payload },
    false,
  )
}

export const reorderTemplateSchema = z.object({
  items: z.array(
    z.object({
      menuItemId: z.string(),
      quantity: z.number().int().positive(),
      note: z.string().optional(),
      optionIds: z.array(z.string()),
    }),
  ),
  quote: z.object({
    previousSubtotal: moneySchema,
    currentSubtotal: moneySchema.nullable(),
    canSubmit: z.boolean(),
    stockAvailable: z.boolean().optional(),
    lines: z.array(
      z.object({
        lineNumber: z.number().int(),
        previousName: z.string(),
        previousUnitPrice: moneySchema,
        currentName: z.string().nullable(),
        currentUnitPrice: moneySchema.nullable(),
        available: z.boolean(),
        reason: z.string().nullable(),
      }),
    ),
  }),
})
export function getReorderTemplate(requestId: string, reorderToken: string) {
  return apiMutate(
    '/online-orders/requests/reorder-template',
    'POST',
    reorderTemplateSchema,
    { requestId, reorderToken },
    undefined,
    false,
  )
}
export function issueReorderKey(requestId: string, accessToken: string) {
  return apiMutate(
    '/online-orders/requests/reorder-key',
    'POST',
    z.object({
      requestId: z.string(),
      reorderToken: z.string(),
      expiresAt: z.string(),
    }),
    { requestId, accessToken },
    undefined,
    false,
  )
}
export function revokeReorderKey(requestId: string, reorderToken: string) {
  return apiMutate(
    '/online-orders/requests/reorder-key/revoke',
    'POST',
    z.object({ revoked: z.literal(true) }),
    { requestId, reorderToken },
    undefined,
    false,
  )
}

export function trackOnlineOrder(requestId: string, accessToken: string, signal?: AbortSignal) {
  return apiMutate(
    '/online-orders/requests/status',
    'POST',
    TrackOrderResponseSchema,
    { requestId, accessToken },
    signal,
    false, // public endpoint
  )
}

export function cancelOnlineOrder(requestId: string, accessToken: string, signal?: AbortSignal) {
  return apiMutate(
    '/online-orders/requests/cancel',
    'POST',
    CancelOrderResponseSchema,
    { requestId, accessToken },
    signal,
    false, // public endpoint
  )
}

export function getTelegramLink(requestId: string, accessToken: string, signal?: AbortSignal) {
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
