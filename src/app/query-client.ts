import { QueryClient } from '@tanstack/react-query'
import { resetSessionRequests, sessionEvents } from '../shared/api/client'
import { clearStaffDestination, rememberStaffDestination } from '../shared/auth/staff-destination'

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

const customerChannel = typeof BroadcastChannel === 'undefined'
  ? undefined
  : new BroadcastChannel('coffee-shop-customer-session')
export function announceCustomerSessionChange() {
  customerChannel?.postMessage('changed')
}
async function refreshCustomerIdentity() {
  await queryClient.cancelQueries({ queryKey: ['customer'] })
  queryClient.removeQueries({
    queryKey: ['customer'],
    predicate: query => query.queryKey[1] !== 'me',
  })
  queryClient.setQueryData(['customer', 'me'], null)
  await queryClient.invalidateQueries({ queryKey: ['customer', 'me'] })
}
if (customerChannel) customerChannel.onmessage = event => {
  if (event.data === 'changed') void refreshCustomerIdentity()
}
function endSession(event: Event) {
  clearIdentity()
  if (/^\/staff(?:\/|$)/.test(window.location.pathname)) {
    if (event.type === 'expired')
      rememberStaffDestination(window.location.pathname + window.location.search + window.location.hash)
    else clearStaffDestination()
    window.location.replace('/sign-in')
  }
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
    customerChannel?.close()
  })
