import { z } from 'zod'
import { apiMutate } from '../../shared/api/client'

export const pickupCredentialSchema = z.object({
  invoiceId: z.uuid(), code: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
})
const issuedCodeSchema = pickupCredentialSchema.extend({ expiresAt: z.iso.datetime({ offset: true }) })
const statusSchema = z.object({
  invoiceId: z.uuid(), status: z.enum(['PREPARING', 'PARTIALLY_READY', 'READY', 'COLLECTED']),
  expiresAt: z.iso.datetime({ offset: true }),
  items: z.array(z.object({ id: z.uuid(), name: z.string(), quantity: z.number().int().positive(),
    serveStatus: z.enum(['PENDING', 'COOKING', 'READY', 'SERVED', 'CANCELLED']) })),
})
export type PickupCredential = z.infer<typeof pickupCredentialSchema>
export type PickupStatus = z.infer<typeof statusSchema>

export function parsePickupLink(value: string): PickupCredential | null {
  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin || url.pathname !== '/pickup') return null
    const params = new URLSearchParams(url.hash.slice(1))
    const result = pickupCredentialSchema.safeParse({ invoiceId: params.get('invoiceId'), code: params.get('code') })
    return result.success ? result.data : null
  } catch { return null }
}
export function pickupLink(credential: PickupCredential) {
  return window.location.origin + '/pickup#' + new URLSearchParams(credential).toString()
}
export function issuePickupCode(invoiceId: string) {
  return apiMutate('/orders/takeaway/invoices/' + invoiceId + '/pickup-code', 'POST', issuedCodeSchema, {})
}
export function rotatePickupCode(credential: PickupCredential) {
  return apiMutate('/orders/takeaway/invoices/' + credential.invoiceId + '/pickup-code/rotate', 'POST', issuedCodeSchema, { code: credential.code })
}
export function revokePickupCode(credential: PickupCredential) {
  return apiMutate('/orders/takeaway/invoices/' + credential.invoiceId + '/pickup-code/revoke', 'POST', z.object({ revoked: z.literal(true) }), { code: credential.code })
}
export function getPickupStatus(credential: PickupCredential, signal?: AbortSignal) {
  return apiMutate('/orders/takeaway/pickup/status', 'POST', statusSchema, credential, signal, false)
}
export function collectPickupItem(credential: PickupCredential, itemId: string) {
  return apiMutate('/orders/takeaway/pickup/collect', 'POST', z.object({ id: z.uuid(), serveStatus: z.literal('SERVED') }), { ...credential, itemId })
}
export function submitPickupFeedback(credential: PickupCredential, rating: number, comment: string) {
  return apiMutate('/orders/takeaway/pickup/feedback', 'POST', z.object({ id: z.uuid(), rating: z.number().int(), comment: z.string().nullable(), createdAt: z.iso.datetime({ offset: true }) }),
    { ...credential, rating, ...(comment.trim() ? { comment: comment.trim() } : {}) }, undefined, false)
}
