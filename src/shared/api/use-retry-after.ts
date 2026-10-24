import { useEffect, useState } from 'react'
import { ApiError } from './client'

export function useRetryAfter(error: unknown) {
  const retryAt = error instanceof ApiError ? error.retryAt : undefined
  const [now, setNow] = useState(Date.now)
  const receivedAt = error instanceof ApiError ? error.receivedAt : 0
  useEffect(() => {
    if (!retryAt || retryAt <= Date.now()) return
    const timer = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= retryAt) window.clearInterval(timer)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [retryAt])
  return Math.max(0, Math.ceil(((retryAt ?? 0) - Math.max(now, receivedAt)) / 1000))
}
