import type { Permission } from './employees.api'
import { getPermissionLabel } from '../../shared/auth/permission-label'
import { currentLanguage, i18n, type TranslationKey } from '../../shared/i18n'

export function permissionLabel(permission: Pick<Permission, 'key' | 'name' | 'isSystemPermission'>) {
  return permission.isSystemPermission
    ? getPermissionLabel(permission.key, currentLanguage(), permission.name)
    : permission.name
}

const groups: Record<string, TranslationKey> = {
  permissions: 'permissions.group.people',
  roles: 'permissions.group.people',
  employees: 'permissions.group.people',
  positions: 'permissions.group.people',
  orders: 'permissions.group.sales',
  'dining-tables': 'permissions.group.sales',
  'online-orders': 'permissions.group.sales',
  invoices: 'permissions.group.sales',
  'kitchen-stations': 'permissions.group.kitchen',
  'kitchen-tickets': 'permissions.group.kitchen',
  'payment-attempts': 'permissions.group.payments',
  'payment-refunds': 'permissions.group.payments',
  'cash-refunds': 'permissions.group.payments',
  'payment-reconciliation': 'permissions.group.payments',
  funds: 'permissions.group.cash',
  'cashier-shifts': 'permissions.group.cash',
  'cash-handovers': 'permissions.group.cash',
  'bank-reconciliation': 'permissions.group.cash',
  menu: 'permissions.group.menu',
  promotions: 'permissions.group.menu',
  inventory: 'permissions.group.inventory',
  reservations: 'permissions.group.reservations',
  equipment: 'permissions.group.equipment',
  'print-devices': 'permissions.group.equipment',
  'print-jobs': 'permissions.group.equipment',
  receipts: 'permissions.group.equipment',
  reports: 'permissions.group.reports',
  'audit-logs': 'permissions.group.reports',
  'management-exceptions': 'permissions.group.reports',
  'outbox-events': 'permissions.group.reports',
  feedback: 'permissions.group.reports',
  'system-settings': 'permissions.group.settings',
}

const sensitive = new Set([
  '/invoices_pay',
  '/invoices_void',
  '/roles_permissions_update',
  '/employees_roles_update',
  '/employees_update',
  '/permissions_create',
  '/permissions_update',
  '/permissions_delete',
  '/roles_delete',
  '/employees_delete',
  '/payment-refunds_create',
  '/cash-refunds_create',
  '/payment-reconciliation_manage',
  '/inventory_stock_adjust',
  '/inventory_purchase-receipts_post',
  '/inventory_stocktakes_post',
  '/cashier-shifts_expenses-review',
  '/cash-handovers_review',
  '/cash-handovers_settle',
  '/bank-reconciliation_manage',
  '/reports_close',
  '/outbox-events_retry',
])

export function isSensitivePermission(key: string) {
  return sensitive.has(key)
}

export function groupPermissions(permissions: Permission[]) {
  const result = new Map<string, Permission[]>()
  for (const permission of permissions) {
    const resource = permission.key.slice(1).split('_', 1)[0] ?? ''
    const label = i18n.t(groups[resource] ?? 'permissions.group.other')
    const items = result.get(label) ?? []
    items.push(permission)
    result.set(label, items)
  }
  return [...result].sort(([left], [right]) => left.localeCompare(right, currentLanguage()))
}
