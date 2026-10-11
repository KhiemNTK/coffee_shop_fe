import type { Permission } from './employees.api'

const groups: Record<string, string> = {
  permissions: 'Nhân sự & phân quyền',
  roles: 'Nhân sự & phân quyền',
  employees: 'Nhân sự & phân quyền',
  positions: 'Nhân sự & phân quyền',
  orders: 'Bán hàng',
  'dining-tables': 'Bán hàng',
  'online-orders': 'Bán hàng',
  invoices: 'Bán hàng',
  'kitchen-stations': 'Bếp & pha chế',
  'kitchen-tickets': 'Bếp & pha chế',
  'payment-attempts': 'Thanh toán',
  'payment-refunds': 'Thanh toán',
  'cash-refunds': 'Thanh toán',
  'payment-reconciliation': 'Thanh toán',
  funds: 'Ca & quỹ',
  'cashier-shifts': 'Ca & quỹ',
  'cash-handovers': 'Ca & quỹ',
  'bank-reconciliation': 'Ca & quỹ',
  menu: 'Thực đơn & khuyến mãi',
  promotions: 'Thực đơn & khuyến mãi',
  inventory: 'Kho hàng',
  reservations: 'Đặt bàn',
  equipment: 'Thiết bị & in ấn',
  'print-devices': 'Thiết bị & in ấn',
  'print-jobs': 'Thiết bị & in ấn',
  receipts: 'Thiết bị & in ấn',
  reports: 'Báo cáo & kiểm toán',
  'audit-logs': 'Báo cáo & kiểm toán',
  'management-exceptions': 'Báo cáo & kiểm toán',
  feedback: 'Báo cáo & kiểm toán',
  'system-settings': 'Cài đặt',
}

const sensitive = new Set([
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
])

export function isSensitivePermission(key: string) {
  return sensitive.has(key)
}

export function groupPermissions(permissions: Permission[]) {
  const result = new Map<string, Permission[]>()
  for (const permission of permissions) {
    const resource = permission.key.slice(1).split('_', 1)[0] ?? ''
    const label = groups[resource] ?? 'Khác'
    const items = result.get(label) ?? []
    items.push(permission)
    result.set(label, items)
  }
  return [...result].sort(([left], [right]) => left.localeCompare(right, 'vi'))
}
