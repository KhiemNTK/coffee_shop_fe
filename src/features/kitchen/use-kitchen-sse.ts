import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { posKeys } from '../pos/pos.keys'
import { kitchenKeys, kitchenRealtimeEventSchema } from './kitchen.api'
import { playNotificationChime } from '../../shared/lib/sound'

export type KitchenConnectionStatus = 'connected' | 'connecting' | 'disconnected'

export function useKitchenSse(
  employeeId: string,
  enabled = true,
  options?: { soundEnabled?: boolean; stationId?: string },
) {
  const queryClient = useQueryClient()
  const soundEnabled = options?.soundEnabled ?? false
  const stationId = options?.stationId ?? ''
  const settingsRef = useRef({ soundEnabled, stationId })
  useEffect(() => {
    settingsRef.current = { soundEnabled, stationId }
  }, [soundEnabled, stationId])

  const [connectionState, setConnectionState] = useState({
    employeeId,
    enabled,
    status: 'connecting' as KitchenConnectionStatus,
  })
  if (connectionState.employeeId !== employeeId || connectionState.enabled !== enabled) {
    setConnectionState({ employeeId, enabled, status: 'connecting' })
  }

  useEffect(() => {
    if (!enabled) return

    let source: EventSource | null = null
    let active = true
    let refreshTimeout: number | undefined
    let reconnectTimeout: number | undefined
    let heartbeatTimeout: number | undefined
    let pendingChime = false
    let batchStationId = ''
    // shortcut: dedupe the latest 200 new-ticket events per mounted KDS session, not across reloads.
    const seenEvents = new Set<string>()

    function setStatus(status: KitchenConnectionStatus) {
      setConnectionState({ employeeId, enabled, status })
    }

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

    function disconnect(connection: EventSource) {
      if (!active || source !== connection) return
      source = null
      window.clearTimeout(heartbeatTimeout)
      window.clearTimeout(refreshTimeout)
      refreshTimeout = undefined
      pendingChime = false
      connection.close()
      setStatus('disconnected')
      refresh()
      if (reconnectTimeout === undefined) {
        reconnectTimeout = window.setTimeout(() => {
          reconnectTimeout = undefined
          connect()
        }, 5_000)
      }
    }

    function watchHeartbeat(connection: EventSource) {
      window.clearTimeout(heartbeatTimeout)
      heartbeatTimeout = window.setTimeout(() => disconnect(connection), 45_000)
    }

    function connect() {
      if (!active) return
      const connection = new EventSource('/api/v1/kitchen/events', {
        withCredentials: true,
      })
      source = connection
      watchHeartbeat(connection)

      connection.onopen = () => {
        if (!active || source !== connection) return
        setStatus('connected')
        watchHeartbeat(connection)
        refresh()
      }

      connection.addEventListener('kitchen.refresh', (message) => {
        if (!active || source !== connection) return
        watchHeartbeat(connection)
        if (refreshTimeout === undefined) batchStationId = settingsRef.current.stationId
        try {
          const event = kitchenRealtimeEventSchema.parse(
            JSON.parse((message as MessageEvent<string>).data),
          )
          if (event.eventName === 'order.items.added' && !seenEvents.has(event.eventId)) {
            seenEvents.add(event.eventId)
            if (seenEvents.size > 200) seenEvents.delete(seenEvents.values().next().value!)
            // shortcut: scheduled releases stay visual; add a durable release event if timed audio is needed.
            pendingChime ||=
              settingsRef.current.soundEnabled &&
              (event.newTickets?.some(
                (ticket) =>
                  (!settingsRef.current.stationId ||
                    ticket.stationId === settingsRef.current.stationId) &&
                  Date.parse(ticket.availableAt) <= Date.now(),
              ) ??
                false)
          }
        } catch {
          // Legacy or malformed events may refresh data, but never trigger a guessed alert.
        }
        if (refreshTimeout !== undefined) return
        refreshTimeout = window.setTimeout(() => {
          refreshTimeout = undefined
          if (!active) return
          if (
            pendingChime &&
            settingsRef.current.soundEnabled &&
            batchStationId === settingsRef.current.stationId
          )
            playNotificationChime()
          pendingChime = false
          refresh()
        }, 250)
      })

      connection.addEventListener('heartbeat', () => {
        if (!active || source !== connection) return
        watchHeartbeat(connection)
        setStatus('connected')
      })

      connection.onerror = () => disconnect(connection)
    }

    connect()

    return () => {
      active = false
      window.clearTimeout(refreshTimeout)
      window.clearTimeout(reconnectTimeout)
      window.clearTimeout(heartbeatTimeout)
      source?.close()
    }
  }, [employeeId, enabled, queryClient])

  return {
    status: enabled ? connectionState.status : ('disconnected' as const),
  }
}
