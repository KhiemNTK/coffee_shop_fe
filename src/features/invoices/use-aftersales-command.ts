import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { z } from 'zod'
import { ApiError, errorMessage } from '../../shared/api/client'
import { pendingIntentKey, readPendingIntent, writePendingIntent, type PendingIntent } from '../../shared/api/pending-intent'

export function useAftersalesCommand<T, R>({ employeeId, operation, schema, execute, onUpdated, onSuccess }: {
  employeeId: string; operation: string; schema: z.ZodType<T>
  execute: (payload: T, key: string) => Promise<R>; onUpdated: () => void
  onSuccess: () => void
}) {
  const key = pendingIntentKey(employeeId, operation)
  const [recovery] = useState(() => {
    try { return { intent: readPendingIntent(key, schema), error: null } }
    catch { return { intent: null, error: 'Không đọc được yêu cầu phục hồi. Liên hệ quản lý để đối soát trước khi gửi lại.' } }
  })
  const [submitted, setSubmitted] = useState(recovery.intent)
  const [storageError, setStorageError] = useState<string | null>(recovery.error)
  const flight = useRef(false)
  const mutation = useMutation({
    retry: false,
    mutationFn: (intent: PendingIntent<T>) => execute(intent.payload, intent.idempotencyKey),
    onSuccess: () => {
      sessionStorage.removeItem(key)
      setSubmitted(null)
      setStorageError(null)
      onSuccess()
    },
    onError: (error, intent) => {
      if (!intent.uncertain && error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429) {
        sessionStorage.removeItem(key)
        setSubmitted(null)
      } else setSubmitted({ ...intent, uncertain: true })
    },
    onSettled: () => { flight.current = false; onUpdated() },
  })
  function submit(payload: T) {
    if (flight.current || recovery.error) return
    const intent = submitted ?? { payload: schema.parse(payload), createdAt: Date.now(), idempotencyKey: crypto.randomUUID() }
    // These two commands retain permanent replay protection in their business records.
    try { writePendingIntent(key, { ...intent, uncertain: true }) }
    catch { setStorageError('Không lưu được yêu cầu phục hồi. Chưa gửi giao dịch; kiểm tra bộ nhớ trình duyệt.'); return }
    setStorageError(null)
    setSubmitted(intent)
    flight.current = true
    mutation.mutate(intent)
  }
  return {
    submit, submitted, mutation, locked: mutation.isPending || Boolean(submitted) || Boolean(recovery.error),
    error: storageError ?? (mutation.error ? errorMessage(mutation.error) : null),
    canRecover: !recovery.error && !mutation.isPending,
  }
}
