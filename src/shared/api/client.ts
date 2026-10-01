import { z } from 'zod'

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly requestId?: string
  readonly serverMessage?: string
  constructor(
    status: number,
    code?: string,
    requestId?: string,
    serverMessage?: string,
  ) {
    super(serverMessage || 'API request failed')
    this.status = status
    this.code = code
    this.requestId = requestId
    this.serverMessage = serverMessage
  }
}

let sessionRequests = new AbortController()
let refreshFlight: Promise<void> | undefined
export const sessionEvents = new EventTarget()

export function resetSessionRequests() {
  sessionRequests.abort()
  sessionRequests = new AbortController()
}

function csrfToken() {
  return (
    document.cookie
      .split('; ')
      .find((value) => value.startsWith('csrfToken='))
      ?.slice('csrfToken='.length) ?? ''
  )
}

export function withSessionLock<T>(task: () => Promise<T>): Promise<T> {
  return navigator.locks
    ? (navigator.locks.request('coffee-shop-auth', task) as Promise<T>)
    : task()
}

async function http(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  signal: AbortSignal,
  body?: unknown,
) {
  const headers = new Headers({ Accept: 'application/json' })
  if (method !== 'GET') {
    headers.set('Content-Type', 'application/json')
    const csrf = csrfToken()
    if (csrf) headers.set('X-CSRF-Token', csrf)
  }
  const response = await fetch(`/api/v1${path}`, {
    method,
    headers,
    credentials: 'include',
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    const error = z
      .object({
        code: z.string().optional(),
        requestId: z.string().optional(),
        message: z.string().optional(),
        errors: z.array(z.object({ message: z.string() })).nullish(),
      })
      .safeParse(await response.json().catch(() => null))
    const serverMessage = error.success
      ? error.data.errors?.[0]?.message || (typeof error.data.message === 'string' ? error.data.message : undefined)
      : undefined
    throw new ApiError(
      response.status,
      error.success ? error.data.code : undefined,
      response.headers.get('x-request-id') ??
        (error.success ? error.data.requestId : undefined),
      serverMessage,
    )
  }
  return response
}

function refresh(observedCsrf: string, sessionSignal: AbortSignal) {
  if (!refreshFlight) {
    const flight = withSessionLock(async () => {
      sessionSignal.throwIfAborted()
      // Another tab may already have rotated this shared cookie while we waited.
      if (csrfToken() !== observedCsrf) return
      if (!observedCsrf) throw new ApiError(401)
      const response = await http('/auth/refresh', 'POST', sessionSignal, {})
      z.object({ errors: z.null() }).parse(await response.json())
    })
    refreshFlight = flight
    void flight
      .finally(() => {
        if (refreshFlight === flight) refreshFlight = undefined
      })
      .catch(() => {})
  }
  return refreshFlight
}

export async function apiGet<T>(
  path: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
  authenticated = false,
): Promise<T> {
  const sessionSignal = sessionRequests.signal
  const activeSignal = signal ?? new AbortController().signal
  const combined = authenticated
    ? AbortSignal.any([activeSignal, sessionSignal])
    : activeSignal
  const observedCsrf = csrfToken()
  let response: Response
  try {
    try {
      response = await http(path, 'GET', combined)
    } catch (error) {
      if (
        !authenticated ||
        !(error instanceof ApiError) ||
        error.status !== 401
      )
        throw error
      try {
        await refresh(observedCsrf, sessionSignal)
      } catch (refreshError) {
        if (!sessionSignal.aborted)
          sessionEvents.dispatchEvent(new Event('expired'))
        throw refreshError
      }
      combined.throwIfAborted()
      response = await http(path, 'GET', combined)
    }
  } catch (error) {
    if (authenticated && error instanceof ApiError && error.status === 401)
      sessionEvents.dispatchEvent(new Event('expired'))
    if (
      authenticated &&
      !path.startsWith('/auth/') &&
      error instanceof ApiError &&
      error.status === 403
    )
      sessionEvents.dispatchEvent(new Event('forbidden'))
    throw error
  }
  const result = z
    .object({ data: schema, errors: z.null() })
    .parse(await response.json()).data
  combined.throwIfAborted()
  return result
}

// Mutations with optional CSRF and session refresh (authenticated defaults to true)
export async function apiMutate<T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  schema: z.ZodType<T>,
  body?: unknown,
  signal?: AbortSignal,
  authenticated = true,
): Promise<T> {
  const sessionSignal = sessionRequests.signal
  const combined = authenticated
    ? signal
      ? AbortSignal.any([signal, sessionSignal])
      : sessionSignal
    : (signal ?? new AbortController().signal)
  const observedCsrf = csrfToken()
  let response: Response
  try {
    try {
      response = await http(path, method, combined, body)
    } catch (error) {
      if (
        !authenticated ||
        !(error instanceof ApiError) ||
        error.status !== 401
      )
        throw error
      try {
        await refresh(observedCsrf, sessionSignal)
      } catch (refreshError) {
        if (!sessionSignal.aborted)
          sessionEvents.dispatchEvent(new Event('expired'))
        throw refreshError
      }
      combined.throwIfAborted()
      response = await http(path, method, combined, body)
    }
  } catch (error) {
    if (authenticated && error instanceof ApiError && error.status === 401)
      sessionEvents.dispatchEvent(new Event('expired'))
    if (
      authenticated &&
      !path.startsWith('/auth/') &&
      error instanceof ApiError &&
      error.status === 403
    )
      sessionEvents.dispatchEvent(new Event('forbidden'))
    throw error
  }
  const result = z
    .object({ data: schema, errors: z.null() })
    .parse(await response.json()).data
  combined.throwIfAborted()
  return result
}

// No automatic retries for auth commands, including timeout and 401.
export async function authCommand(
  path: '/auth/sign-in' | '/auth/logout',
  body: unknown,
) {
  return withSessionLock(async () => {
    resetSessionRequests()
    const response = await http(path, 'POST', sessionRequests.signal, body)
    // Validate the success envelope, but discard token data rather than caching it.
    z.object({ errors: z.null() }).parse(await response.json())
  })
}

export function errorMessage(error: unknown) {
  if (!(error instanceof ApiError))
    return 'Không thể kết nối. Vui lòng thử lại.'
  if (error.status === 401)
    return 'Thông tin đăng nhập không đúng hoặc phiên đã hết hạn.'
  if (error.status === 403)
    return 'Yêu cầu bị từ chối. Kiểm tra quyền truy cập hoặc xác minh bảo mật.'
  if (error.status === 429)
    return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.'
  if (
    error.serverMessage &&
    (error.status === 400 || error.status === 409 || error.status === 404)
  )
    return error.serverMessage
  if (error.status === 400)
    return 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.'
  if (error.status === 409)
    return 'Trạng thái dữ liệu đã thay đổi hoặc đang bị xung đột. Vui lòng thử lại.'
  if (error.status === 404)
    return 'Không tìm thấy dữ liệu yêu cầu.'
  return 'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại.'
}

