import { createPermissionAccess, type PermissionKey } from '../../shared/auth/permissions'
import {
  Activity,
  BarChart3,
  BookOpen,
  Boxes,
  CalendarDays,
  ChefHat,
  Coins,
  Cpu,
  LayoutGrid,
  Printer,
  Receipt,
  ScrollText,
  ShoppingBag,
  Ticket,
  Users,
  UtensilsCrossed,
} from 'lucide-react'

export const staffDestinations = [
  {
    path: 'operations',
    label: 'Trung tâm vận hành',
    icon: Activity,
    permissions: ['/management-exceptions_read'],
  },
  {
    path: 'pos',
    label: 'Bán hàng (POS)',
    icon: UtensilsCrossed,
    permissions: ['/dining-tables_read', '/orders_sessions_read'],
  },
  {
    path: 'kitchen',
    label: 'Bếp & Pha chế',
    icon: ChefHat,
    permissions: ['/kitchen-tickets_read', '/kitchen-stations_read'],
  },
  {
    path: 'online-orders',
    label: 'Đơn mang đi',
    icon: ShoppingBag,
    permissions: ['/online-orders_read'],
  },
  {
    path: 'shifts',
    label: 'Ca & Quỹ tiền mặt',
    icon: Coins,
    permissions: [
      '/cashier-shifts_current',
      '/cashier-shifts_read',
      '/cashier-shifts_open',
      '/cashier-shifts_expenses-review',
      '/cash-handovers_read',
      '/cash-handovers_create',
      '/funds_read',
      '/funds_manage',
    ],
  },
  {
    path: 'invoices',
    label: 'Hóa đơn & TT',
    icon: Receipt,
    permissions: ['/invoices_read'],
  },
  {
    path: 'reconciliation',
    label: 'Đối soát & Khiếu nại',
    icon: Receipt,
    permissions: [
      '/payment-reconciliation_read',
      '/bank-reconciliation_read',
      '/reports_read',
    ],
  },
  {
    path: 'reservations',
    label: 'Đặt bàn',
    icon: CalendarDays,
    permissions: ['/reservations_read'],
  },
  {
    path: 'tables',
    label: 'Sơ đồ bàn',
    icon: LayoutGrid,
    permissions: ['/dining-tables_read'],
  },
  {
    path: 'inventory',
    label: 'Kho hàng',
    icon: Boxes,
    permissions: ['/inventory_read'],
  },
  {
    path: 'menu',
    label: 'Thực đơn',
    icon: BookOpen,
    permissions: ['/menu_read'],
  },
  {
    path: 'promotions',
    label: 'Khuyến mãi',
    icon: Ticket,
    permissions: ['/promotions_read'],
  },
  {
    path: 'reports',
    label: 'Báo cáo',
    icon: BarChart3,
    permissions: ['/reports_read'],
  },
  {
    path: 'employees',
    label: 'Nhân sự',
    icon: Users,
    permissions: ['/employees_read', '/positions_read', '/roles_read'],
  },
  {
    path: 'settings',
    label: 'Cài đặt & Thiết bị',
    icon: Cpu,
    permissions: [
      '/equipment_read',
      '/system-settings_read',
      '/management-exceptions_read',
    ],
  },
  {
    path: 'audit-logs',
    label: 'Nhật ký kiểm toán',
    icon: ScrollText,
    permissions: ['/audit-logs_read'],
  },
  {
    path: 'printing',
    label: 'Máy in & Lệnh in',
    icon: Printer,
    permissions: [
      '/print-devices_read',
      '/print-jobs_read',
      '/receipts_reprint',
    ],
  },
] as const satisfies readonly { path: string; label: string; icon: unknown; permissions: readonly PermissionKey[] }[]

export type StaffDestination = (typeof staffDestinations)[number]['path']

export function visibleStaffDestinations(permissionKeys: readonly string[]) {
  const access = createPermissionAccess(permissionKeys)
  return staffDestinations.filter((destination) =>
    access.hasAny(...destination.permissions),
  )
}

export interface StaffNavGroup {
  key: string
  label: string
  items: Array<(typeof staffDestinations)[number]>
}

export const staffNavGroups: StaffNavGroup[] = [
  {
    key: 'operations',
    label: 'Vận hành quán',
    items: staffDestinations.filter((d) =>
      ['pos', 'kitchen', 'online-orders', 'tables', 'reservations'].includes(
        d.path,
      ),
    ),
  },
  {
    key: 'sales',
    label: 'Thu ngân & Doanh thu',
    items: staffDestinations.filter((d) =>
      ['shifts', 'invoices', 'reconciliation', 'promotions'].includes(d.path),
    ),
  },
  {
    key: 'catalog',
    label: 'Thực đơn & Kho hàng',
    items: staffDestinations.filter((d) =>
      ['menu', 'inventory'].includes(d.path),
    ),
  },
  {
    key: 'management',
    label: 'Quản lý & Nhân sự',
    items: staffDestinations.filter((d) =>
      ['reports', 'employees', 'operations'].includes(d.path),
    ),
  },
  {
    key: 'system',
    label: 'Hệ thống & Thiết bị',
    items: staffDestinations.filter((d) =>
      ['settings', 'printing', 'audit-logs'].includes(d.path),
    ),
  },
]

export function visibleGroupedStaffDestinations(permissionKeys: readonly string[]) {
  const visiblePaths = new Set(
    visibleStaffDestinations(permissionKeys).map((item) => item.path),
  )

  return staffNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => visiblePaths.has(item.path)),
    }))
    .filter((group) => group.items.length > 0)
}
