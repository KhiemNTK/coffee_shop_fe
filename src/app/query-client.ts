import { QueryClient } from '@tanstack/react-query'
import { resetSessionRequests, sessionEvents } from '../shared/api/client'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 30_000 },
    mutations: { retry: false, networkMode: 'always' },
  },
})

export function clearIdentity() {
  resetSessionRequests()
  queryClient.clear()
}

// Only control messages cross tabs, never tokens or employee data.
const channel =
  typeof BroadcastChannel === 'undefined'
    ? undefined
    : new BroadcastChannel('coffee-shop-session')
export function announceSessionChange() {
  channel?.postMessage('changed')
}
function endSession() {
  clearIdentity()
  if (window.location.pathname.startsWith('/staff'))
    window.location.replace('/sign-in')
}
sessionEvents.addEventListener('expired', endSession)
function reloadPermissions() {
  void queryClient.invalidateQueries({ queryKey: ['private', 'session'] })
}
sessionEvents.addEventListener('forbidden', reloadPermissions)
if (channel) channel.onmessage = endSession
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    sessionEvents.removeEventListener('expired', endSession)
    sessionEvents.removeEventListener('forbidden', reloadPermissions)
    channel?.close()
  })
