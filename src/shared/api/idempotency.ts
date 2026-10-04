import { z } from 'zod'
import { apiMutate } from './client'

export const pendingOperationPrefix = 'coffee-shop:pending:'

export function clearPrivatePendingOperations() {
  for (const key of Object.keys(sessionStorage)) {
    if (key.startsWith(pendingOperationPrefix + 'private:')) sessionStorage.removeItem(key)
  }
}

// Store only a payload digest and key; uncertain writes survive a modal close or reload.
export async function apiIdempotentMutate<T>(
  path: string,
  schema: z.ZodType<T>,
  payload: Record<string, unknown>,
  { keyField = 'idempotencyKey', authenticated = true, signal }: {
    keyField?: 'idempotencyKey' | 'clientRequestId'; authenticated?: boolean; signal?: AbortSignal
  } = {},
): Promise<T> {
  const { [keyField]: suppliedKey, ...request } = payload
  if (typeof suppliedKey === 'string' && suppliedKey) {
    return apiMutate(path, 'POST', schema, payload, signal, authenticated)
  }
  const fingerprintRequest = { ...request }
  delete fingerprintRequest.turnstileToken
  const digest = await crypto.subtle.digest(
    'SHA-256', new TextEncoder().encode(JSON.stringify(fingerprintRequest)),
  )
  const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  const storageKey = `${pendingOperationPrefix}${authenticated ? 'private' : 'public'}:${path}:${fingerprint}`
  const key = sessionStorage.getItem(storageKey) ?? crypto.randomUUID()
  sessionStorage.setItem(storageKey, key)
  const result = await apiMutate(path, 'POST', schema, { ...request, [keyField]: key }, signal, authenticated)
  if (sessionStorage.getItem(storageKey) === key) sessionStorage.removeItem(storageKey)
  return result
}
