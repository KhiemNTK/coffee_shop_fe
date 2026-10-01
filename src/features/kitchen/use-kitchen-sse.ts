import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

export type KitchenConnectionStatus = 'connected' | 'connecting' | 'disconnected'

export function useKitchenSse(enabled = true) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<KitchenConnectionStatus>(() =>
    enabled ? 'connecting' : 'disconnected',
  )
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) return

    let source: EventSource | null = null
    let active = true

    function connect() {
      if (!active) return
      setStatus('connecting')

      source = new EventSource('/api/v1/kitchen/events', {
        withCredentials: true,
      })

      source.onopen = () => {
        if (!active) return
        setStatus('connected')
      }

      source.addEventListener('kitchen.refresh', () => {
        if (!active) return
        setLastRefreshedAt(new Date().toLocaleTimeString('vi-VN'))
        void queryClient.invalidateQueries({ queryKey: ['kitchen', 'tickets'] })
        void queryClient.invalidateQueries({ queryKey: ['kitchen', 'workload'] })
        void queryClient.invalidateQueries({ queryKey: ['pos'] })
      })

      source.addEventListener('heartbeat', () => {
        if (!active) return
        setStatus('connected')
      })

      source.onerror = () => {
        if (!active) return
        setStatus('disconnected')
        source?.close()
        reconnectTimeoutRef.current = window.setTimeout(connect, 5_000)
      }
    }

    connect()

    return () => {
      active = false
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current)
      }
      source?.close()
    }
  }, [enabled, queryClient])

  return { status, lastRefreshedAt }
}
