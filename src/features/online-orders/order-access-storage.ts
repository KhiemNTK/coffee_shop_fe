import { z } from 'zod'

const STORAGE_KEY = 'coffee_shop_takeaway_order'
const orderAccessSchema = z.object({ requestId: z.uuid(), accessToken: z.string().regex(/^[a-f0-9]{64}$/), accessExpiresAt: z.iso.datetime().optional() })
export type OrderAccess = z.infer<typeof orderAccessSchema>

export function storedOrders(): OrderAccess[] {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]')
    const parsed = z.array(orderAccessSchema).max(10).safeParse(Array.isArray(raw) ? raw : [raw])
    return parsed.success ? parsed.data.filter(order => !order.accessExpiresAt || Date.parse(order.accessExpiresAt) > Date.now()) : []
  } catch { return [] }
}

export function rememberOrder(order: OrderAccess): void {
  const value = orderAccessSchema.parse(order)
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify([value, ...storedOrders().filter(previous => previous.requestId !== value.requestId)].slice(0, 10)))
}
