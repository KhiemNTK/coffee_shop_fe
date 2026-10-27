const storageKey = 'coffee_shop_staff_return_to'

function validateDestination(value: unknown) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\p{Cc}]/u.test(value)
  ) return null
  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin || !/^\/staff(?:\/|$)/.test(url.pathname)) return null
    return url.pathname + url.search + url.hash
  } catch { return null }
}

export function rememberStaffDestination(value: string) {
  try {
    const destination = validateDestination(value)
    if (destination) sessionStorage.setItem(storageKey, destination)
  } catch { /* Navigation still works when browser storage is unavailable. */ }
}

export function clearStaffDestination() {
  try { sessionStorage.removeItem(storageKey) } catch { /* Do not block logout. */ }
}

export function takeStaffDestination(value?: unknown) {
  let stored: string | null = null
  try { stored = sessionStorage.getItem(storageKey) } catch { /* Fall back to the workdesk. */ }
  clearStaffDestination()
  return validateDestination(value ?? stored) ?? '/staff'
}
