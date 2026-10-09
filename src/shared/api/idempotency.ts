import { z } from 'zod'
import { ApiError, apiMutate } from './client'

export const pendingOperationPrefix = 'coffee-shop:pending:'

export function clearPrivatePendingOperations() {
  for (const key of Object.keys(sessionStorage)) {
    // Actor-scoped recovery commands retain their own key until reconciled.
    if (key.startsWith(pendingOperationPrefix + 'private:') && !key.startsWith(pendingOperationPrefix + 'private:intent:')) sessionStorage.removeItem(key)
  }
}

async function pendingStorageKey(path: string, payload: Record<string, unknown>, authenticated: boolean) {
  const request = { ...payload }
  delete request.idempotencyKey
  delete request.clientRequestId
  delete request.turnstileToken
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(request)))
  const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  return `${pendingOperationPrefix}${authenticated ? 'private' : 'public'}:${path}:${fingerprint}`
}

export async function findPendingOperationKey(path: string, payload: Record<string, unknown>, authenticated = true) {
  return sessionStorage.getItem(await pendingStorageKey(path, payload, authenticated))
}

// Store only a payload digest and key; uncertain writes survive a modal close or reload.
export async function apiIdempotentMutate<T>(
  path: string,
  schema: z.ZodType<T>,
  payload: Record<string, unknown>,
  { keyField = 'idempotencyKey', authenticated = true, signal, timeoutMs }: {
    keyField?: 'idempotencyKey' | 'clientRequestId'; authenticated?: boolean; signal?: AbortSignal; timeoutMs?: number
  } = {},
): Promise<T> {
  const { [keyField]: suppliedKey, ...request } = payload
  const storageKey = await pendingStorageKey(path, request, authenticated)
  const pendingKey = sessionStorage.getItem(storageKey)
  if (pendingKey && suppliedKey && pendingKey !== suppliedKey) {
    throw new ApiError(409, 'CLIENT_PENDING_OPERATION', undefined,
      'Có lần gửi cùng nội dung chưa được xác nhận. Quay lại xem đơn để khôi phục lần gửi đó.')
  }
  const key = pendingKey ?? (typeof suppliedKey === 'string' && suppliedKey ? suppliedKey : crypto.randomUUID())
  sessionStorage.setItem(storageKey, key)
  try {
    const result = await apiMutate(path, 'POST', schema, { ...request, [keyField]: key }, signal, authenticated, timeoutMs)
    if (sessionStorage.getItem(storageKey) === key) sessionStorage.removeItem(storageKey)
    return result
  } catch (error) {
    // A rejected first write has no unknown predecessor. Never discard a retry's key.
    if (!pendingKey && error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429 && sessionStorage.getItem(storageKey) === key)
      sessionStorage.removeItem(storageKey)
    throw error
  }
}
