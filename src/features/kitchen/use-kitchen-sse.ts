import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { posKeys } from '../pos/pos.keys'
import { kitchenKeys } from './kitchen.api'
import { playKitchenChime } from '../../shared/lib/sound'

export type KitchenConnectionStatus = 'connected' | 'connecting' | 'disconnected'

export function useKitchenSse(
  employeeId: string,
  enabled = true,
  options?: { soundEnabled?: boolean },
) {
  const queryClient = useQueryClient()
  const soundEnabled = options?.soundEnabled ?? false
  const soundEnabledRef = useRef(soundEnabled)
  useEffect(() => {
    soundEnabledRef.current = soundEnabled
  }, [soundEnabled])

  const [status, setStatus] = useState<KitchenConnectionStatus>(() =>
    enabled ? 'connecting' : 'disconnected',
  )
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) return

    let source: EventSource | null = null
    let active = true

    function refresh() {
      void queryClient.invalidateQueries({ queryKey: kitchenKeys.tickets(employeeId) })
      void queryClient.invalidateQueries({ queryKey: kitchenKeys.workload(employeeId) })
      void queryClient.invalidateQueries({
        queryKey: posKeys.sessions(employeeId),
      })
      void queryClient.invalidateQueries({
        queryKey: posKeys.tables(employeeId),
      })
      void queryClient.invalidateQueries({
        queryKey: posKeys.session(employeeId).slice(0, -1),
      })
    }

    function connect() {
      if (!active) return
      setStatus('connecting')

      source = new EventSource('/api/v1/kitchen/events', {
        withCredentials: true,
      })

      source.onopen = () => {
        if (!active) return
        setStatus('connected')
        refresh()
      }

      source.addEventListener('kitchen.refresh', () => {
        if (!active) return
        setLastRefreshedAt(new Date().toLocaleTimeString('vi-VN'))
        if (soundEnabledRef.current) {
          playKitchenChime()
        }
        refresh()
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
  }, [employeeId, enabled, queryClient])

  return {
    status: enabled ? status : ('disconnected' as const),
    lastRefreshedAt: enabled ? lastRefreshedAt : null,
  }
}
