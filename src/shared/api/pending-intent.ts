import { z } from 'zod'
import { pendingOperationPrefix } from './idempotency'

export function pendingIntentKey(employeeId: string, operation: string) {
  return `${pendingOperationPrefix}private:intent:${employeeId}:${operation}`
}

export type PendingIntent<T> = { payload: T; createdAt: number; idempotencyKey: string; uncertain?: boolean }

export function readPendingIntent<T>(key: string, schema: z.ZodType<T>): PendingIntent<T> | null {
  const stored = sessionStorage.getItem(key)
  // Invalid recovery data must not silently become a fresh financial command.
  return stored === null ? null : z.object({ payload: schema, createdAt: z.number().int().nonnegative(), idempotencyKey: z.uuid(), uncertain: z.boolean().optional() }).parse(JSON.parse(stored))
}

export function writePendingIntent<T>(key: string, intent: PendingIntent<T>) {
  sessionStorage.setItem(key, JSON.stringify(intent))
}

// Stay below the backend's 24-hour retention; older commands require staff reconciliation.
export function isPendingIntentExpired(intent: PendingIntent<unknown>) {
  return intent.createdAt > Date.now() || Date.now() - intent.createdAt >= 23 * 60 * 60 * 1000
}
