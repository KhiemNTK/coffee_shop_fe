import { PermissionKeys as P, type PermissionKey } from './permissions'

// Complete UI workflows include the read permissions needed by their dialogs.
export const WorkflowPermissions = {
  transferTable: [P.ORDERS_TABLES_TRANSFER, P.DINING_TABLES_READ],
  mergeTables: [P.ORDERS_TABLES_MERGE, P.DINING_TABLES_READ],
  splitTable: [P.ORDERS_TABLES_SPLIT, P.DINING_TABLES_READ],
  manualCheckout: [P.INVOICES_CREATE, P.INVOICES_PAY],
  digitalCheckout: [P.INVOICES_CREATE, P.INVOICES_READ, P.PAYMENT_ATTEMPTS_CREATE, P.PAYMENT_ATTEMPTS_READ],
  collectOnlineOrder: [P.INVOICES_CREATE, P.INVOICES_PAY, P.ORDERS_ITEMS_HANDOFF],
  manageEmployeeRoles: [P.EMPLOYEE_ROLES_READ, P.EMPLOYEE_ROLES_UPDATE, P.ROLES_READ],
} as const satisfies Record<string, readonly PermissionKey[]>
