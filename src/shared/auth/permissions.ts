import type { PermissionKey } from './permission-contract'

export { PermissionKeys, type PermissionKey } from './permission-contract'

export function createPermissionAccess(keys: readonly string[]) {
  const granted = new Set(keys)
  return {
    has: (key: PermissionKey) => granted.has(key),
    hasAll: (...required: readonly PermissionKey[]) => required.every((key) => granted.has(key)),
    hasAny: (...required: readonly PermissionKey[]) => required.some((key) => granted.has(key)),
  }
}

export type PermissionAccess = ReturnType<typeof createPermissionAccess>
