import { z } from 'zod'
import { apiGet, apiMutate, ApiError } from '@/shared/api/client'
import { moneySchema } from '@/shared/api/money'
import { minorAmount } from '@/shared/lib/money'

const dateTime = z.iso.datetime({ offset: true })
const count = z.number().int().nonnegative()
export const voucherStatuses = ['AVAILABLE', 'UPCOMING', 'RESERVED', 'USED', 'EXPIRED', 'REVOKED'] as const
export const voucherStatusSchema = z.enum(voucherStatuses)
const termsSchema = z.object({
  id: z.uuid(), name: z.string(), description: z.string().nullish(),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']), discountValue: moneySchema,
  maxDiscount: moneySchema.nullish(), minSubtotal: moneySchema, startDate: dateTime, endDate: dateTime,
})
export const campaignSchema = termsSchema.extend({
  isPublic: z.boolean(), status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED']),
  issuanceLimit: count, issuedCount: count, publishedAt: dateTime.nullish(), createdAt: dateTime, updatedAt: dateTime,
})
export const campaignDetailSchema = campaignSchema.extend({
  stats: z.object({ claimed: count, gifted: count, reserved: count, redeemed: count, revoked: count }),
})
export const walletEntrySchema = z.object({
  id: z.uuid(), source: z.enum(['CLAIM', 'GIFT']), status: voucherStatusSchema,
  createdAt: dateTime, expiresAt: dateTime, campaign: termsSchema, orderId: z.uuid().nullable(),
})
export const voucherGrantSchema = z.object({
  id: z.uuid(), campaignId: z.uuid(), customerId: z.uuid(), source: z.enum(['CLAIM', 'GIFT']),
  status: voucherStatusSchema, sourceOrderId: z.uuid().nullable(), reason: z.string().nullable(),
  createdAt: dateTime, updatedAt: dateTime, expiresAt: dateTime,
})
const pagination = { totalItems: count, totalPages: count, currentPage: z.number().int().positive() }
const issuedVoucherSchema = z.object({ customerId: z.uuid(), voucherId: z.uuid() })
const campaignsSchema = z.object({ list: z.array(campaignSchema), ...pagination })
const publicCampaignsSchema = z.object({ list: z.array(termsSchema), ...pagination })
const grantsSchema = z.object({ list: z.array(voucherGrantSchema), ...pagination })
export const customerVouchersSchema = z.object({ customerId: z.uuid(), list: z.array(walletEntrySchema), ...pagination })
export type VoucherCampaign = z.infer<typeof campaignSchema>
export type VoucherGrant = z.infer<typeof voucherGrantSchema>
export type WalletEntry = z.infer<typeof walletEntrySchema>
export type VoucherStatus = z.infer<typeof voucherStatusSchema>
export type CustomerVouchersQuery = { status?: VoucherStatus; page?: number; itemPerPage?: number }

export const voucherKeys = {
  public: ['voucher-campaigns', 'public'] as const,
  wallet: (customerId: string) => ['customer', customerId, 'vouchers'] as const,
  staff: (employeeId: string) => ['private', employeeId, 'vouchers'] as const,
  campaigns: (employeeId: string) => [...voucherKeys.staff(employeeId), 'campaigns'] as const,
  detail: (employeeId: string, id: string) => [...voucherKeys.staff(employeeId), 'detail', id] as const,
  grants: (employeeId: string, id: string) => [...voucherKeys.staff(employeeId), 'grants', id] as const,
}
function search(query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value))
  return params.size ? `?${params}` : ''
}
export function getPublicCampaigns(page = 1, signal?: AbortSignal) {
  return apiGet(`/voucher-campaigns/public${search({ page, itemPerPage: 12 })}`, publicCampaignsSchema, signal)
}
export function getCustomerVouchers(query: CustomerVouchersQuery = {}, signal?: AbortSignal) {
  return apiGet(`/customers/vouchers${search(query)}`, customerVouchersSchema, signal)
}
export async function claimVoucher(campaignId: string, expectedCustomerId: string) {
  const result = await apiMutate('/customers/vouchers/claim', 'POST',
    issuedVoucherSchema,
    z.object({ campaignId: z.uuid(), expectedCustomerId: z.uuid() }).parse({ campaignId, expectedCustomerId }), undefined, false)
  if (result.customerId !== expectedCustomerId) throw new ApiError(401, 'CUSTOMER_SESSION_CHANGED')
  return result
}
export function getCampaigns(query: { page?: number; itemPerPage?: number; status?: VoucherCampaign['status'] } = {}, signal?: AbortSignal) {
  return apiGet(`/voucher-campaigns${search(query)}`, campaignsSchema, signal, true)
}
export function getCampaign(id: string, signal?: AbortSignal) {
  return apiGet(`/voucher-campaigns/${id}`, campaignDetailSchema, signal, true)
}

const decimalInput = z.string().regex(/^\d{1,16}(\.\d{1,2})?$/)
export const campaignInputSchema = z.object({
  name: z.string().trim().min(1).max(100), description: z.string().trim().max(500).nullable(),
  isPublic: z.boolean(), discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
  discountValue: decimalInput,
  maxDiscount: decimalInput.nullable(),
  minSubtotal: decimalInput, startDate: dateTime, endDate: dateTime,
  issuanceLimit: z.number().int().positive().max(2_147_483_647),
}).superRefine((data, context) => {
  if (!decimalInput.safeParse(data.discountValue).success || !decimalInput.safeParse(data.minSubtotal).success ||
    (data.maxDiscount !== null && !decimalInput.safeParse(data.maxDiscount).success)) return
  const discount = minorAmount(data.discountValue)
  const minimum = minorAmount(data.minSubtotal)
  if (discount <= 0n || minimum <= 0n || (data.maxDiscount !== null && minorAmount(data.maxDiscount) <= 0n))
    context.addIssue({ code: 'custom', path: ['minSubtotal'], message: 'voucher.invalidTerms' })
  if (data.discountType === 'PERCENTAGE' && (discount >= 10000n || data.maxDiscount === null))
    context.addIssue({ code: 'custom', path: ['discountValue'], message: 'voucher.invalidTerms' })
  if (data.discountType === 'FIXED_AMOUNT' && minimum <= discount)
    context.addIssue({ code: 'custom', path: ['minSubtotal'], message: 'voucher.invalidTerms' })
  if (Date.parse(data.endDate) <= Date.parse(data.startDate))
    context.addIssue({ code: 'custom', path: ['endDate'], message: 'voucher.invalidTerms' })
})
export type CampaignInput = z.infer<typeof campaignInputSchema>
export function createCampaign(payload: CampaignInput) {
  return apiMutate('/voucher-campaigns', 'POST', campaignSchema, campaignInputSchema.parse(payload))
}
export function updateCampaign(id: string, payload: CampaignInput & { expectedUpdatedAt: string }) {
  return apiMutate(`/voucher-campaigns/${id}`, 'PATCH', campaignSchema, payload)
}
export function publishCampaign(id: string, expectedUpdatedAt: string) {
  return apiMutate(`/voucher-campaigns/${id}/publish`, 'POST', campaignSchema, { expectedUpdatedAt })
}
export function pauseCampaign(id: string, expectedUpdatedAt: string) {
  return apiMutate(`/voucher-campaigns/${id}/pause`, 'POST', campaignSchema, { expectedUpdatedAt })
}
export function getCampaignGrants(id: string, query: { page?: number; itemPerPage?: number; sourceOrderId?: string } = {}, signal?: AbortSignal) {
  return apiGet(`/voucher-campaigns/${id}/grants${search(query)}`, grantsSchema, signal, true)
}
export async function getVoucherGrant(id: string, signal?: AbortSignal) {
  const grant = await apiGet(`/voucher-grants/${encodeURIComponent(id)}`, voucherGrantSchema, signal, true)
  if (grant.id !== id) throw new ApiError(502, 'CLIENT_RESPONSE_INVALID')
  return grant
}
export const issueVoucherSchema = z.object({ sourceOrderId: z.uuid(), reason: z.string().trim().min(2).max(500), idempotencyKey: z.string().min(8).max(120) })
export type IssueVoucherInput = z.infer<typeof issueVoucherSchema>
export function issueVoucher(campaignId: string, payload: IssueVoucherInput) {
  return apiMutate(`/voucher-campaigns/${campaignId}/grants`, 'POST', issuedVoucherSchema, issueVoucherSchema.parse(payload))
}
export async function revokeVoucher(id: string, payload: { reason: string; expectedUpdatedAt: string; idempotencyKey: string }) {
  const result = await apiMutate(`/voucher-grants/${id}/revoke`, 'POST', walletEntrySchema.extend({ updatedAt: dateTime }),
    z.object({ reason: z.string().trim().min(2).max(500), expectedUpdatedAt: dateTime, idempotencyKey: z.string().min(8).max(120) }).parse(payload))
  if (result.id !== id || result.status !== 'REVOKED') throw new ApiError(502, 'CLIENT_RESPONSE_INVALID')
  return result
}
export function isUncertainVoucherWrite(error: unknown) {
  return !(error instanceof ApiError) || error.status >= 500 || error.status === 408
}
