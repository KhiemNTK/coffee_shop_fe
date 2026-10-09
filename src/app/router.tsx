import { lazy, Suspense } from 'react'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { MenuPage } from '../features/menu/menu-page'
import { authConfig } from '../features/auth/auth.config'
import {
  PermissionGate,
  StaffHome,
  StaffLayout,
} from '../features/auth/staff-layout'

const SignInPage = lazy(() => import('../features/auth/sign-in-page'))
const SignUpPage = authConfig.signupEnabled ? lazy(() => import('../features/auth/sign-up-page')) : undefined
const PasswordRecoveryPage = lazy(() => import('../features/auth/password-recovery-page'))
const PaymentReturnPage = lazy(() => import('../features/invoices/payment-return-page'))
const ReorderPage = lazy(() => import('../features/online-orders/reorder-page'))
const PickupPage = lazy(() => import('../features/online-orders/pickup-page'))
const ReconciliationPage = lazy(() => import('../features/reconciliation/reconciliation-page'))
const StaffMenuPage = lazy(() => import('../features/menu/staff-menu-page'))
const CashierShiftPage = lazy(
  () => import('../features/cashier-shifts/cashier-shift-page'),
)
const PosTablesPage = lazy(() => import('../features/pos/pos-tables-page'))
const PosSessionPage = lazy(() => import('../features/pos/pos-session-page'))
const KitchenPage = lazy(() => import('../features/kitchen/kitchen-page'))
const OnlineOrderPage = lazy(
  () => import('../features/online-orders/online-order-page'),
)
const StaffOnlineOrdersPage = lazy(
  () => import('../features/online-orders/staff-online-orders-page'),
)
const InvoicesPage = lazy(() => import('../features/invoices/invoices-page'))
const InventoryPage = lazy(() => import('../features/inventory/inventory-page'))
const ReportsPage = lazy(() => import('../features/reports/reports-page'))
const PublicReservationsPage = lazy(
  () => import('../features/reservations/public-reservations-page'),
)
const StaffReservationsPage = lazy(
  () => import('../features/reservations/staff-reservations-page'),
)
const PromotionsPage = lazy(
  () => import('../features/promotions/promotions-page'),
)
const DiningTablesPage = lazy(() =>
  import('../features/dining-tables/dining-tables-page').then((m) => ({
    default: m.DiningTablesPage,
  })),
)
const EmployeesPage = lazy(() =>
  import('@/features/employees/employees-page').then((m) => ({
    default: m.EmployeesPage,
  })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/settings-page').then((m) => ({
    default: m.SettingsPage,
  })),
)
const AuditLogsPage = lazy(() =>
  import('@/features/audit-logs/audit-logs-page').then((m) => ({
    default: m.AuditLogsPage,
  })),
)
const PrintingPage = lazy(() =>
  import('@/features/printing/printing-page').then((m) => ({
    default: m.PrintingPage,
  })),
)

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="feedback" role="status">
            Đang tải…
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<MenuPage />} />
          <Route path="/order" element={<OnlineOrderPage />} />
          <Route path="/reorder" element={<ReorderPage />} />
          <Route path="/pickup" element={<PickupPage />} />
          <Route path="/reservations" element={<PublicReservationsPage />} />
          <Route path="/sign-in" element={<SignInPage />} />
          {SignUpPage && <Route path="/sign-up" element={<SignUpPage />} />}
          <Route path="/forgot-password" element={<PasswordRecoveryPage />} />
          <Route path="/reset-password" element={<PasswordRecoveryPage />} />
          <Route path="/payment/:provider/return" element={<PaymentReturnPage />} />
          <Route path="/auth/sign-in" element={<SignInPage />} />
          {SignUpPage && <Route path="/auth/sign-up" element={<SignUpPage />} />}
          <Route path="/staff" element={<StaffLayout />}>
            <Route element={<PermissionGate anyOf={['/payment-reconciliation_read', '/bank-reconciliation_read', '/reports_read']} />}>
              <Route path="reconciliation" element={<ReconciliationPage />} />
            </Route>
            <Route index element={<StaffHome />} />
            <Route element={<PermissionGate permission="/reservations_read" />}>
              <Route path="reservations" element={<StaffReservationsPage />} />
            </Route>
            <Route element={<PermissionGate permission="/menu_read" />}>
              <Route path="menu" element={<StaffMenuPage />} />
            </Route>
            <Route
              element={
                <PermissionGate
                  anyOf={[
                    '/cashier-shifts_current',
                    '/cashier-shifts_read',
                    '/cashier-shifts_open',
                    '/cashier-shifts_expenses-review',
                    '/cash-handovers_read',
                    '/cash-handovers_create',
                    '/funds_read',
                    '/funds_manage',
                  ]}
                />
              }
            >
              <Route path="shifts" element={<CashierShiftPage />} />
            </Route>
            <Route
              element={
                <PermissionGate
                  anyOf={['/dining-tables_read', '/orders_sessions_read']}
                />
              }
            >
              <Route path="pos" element={<PosTablesPage />} />
            </Route>
            <Route element={<PermissionGate permission="/orders_sessions_read" />}>
              <Route path="pos/sessions/:sessionId" element={<PosSessionPage />} />
            </Route>
            <Route
              element={
                <PermissionGate
                  anyOf={['/kitchen-tickets_read', '/kitchen-stations_read']}
                />
              }
            >
              <Route path="kitchen" element={<KitchenPage />} />
            </Route>
            <Route
              element={
                <PermissionGate permission="/online-orders_read" />
              }
            >
              <Route path="online-orders" element={<StaffOnlineOrdersPage />} />
            </Route>
            <Route element={<PermissionGate permission="/invoices_read" />}>
              <Route path="invoices" element={<InvoicesPage />} />
            </Route>
            <Route element={<PermissionGate permission="/inventory_read" />}>
              <Route path="inventory" element={<InventoryPage />} />
            </Route>
            <Route element={<PermissionGate permission="/reports_read" />}>
              <Route path="reports" element={<ReportsPage />} />
            </Route>
            <Route element={<PermissionGate permission="/promotions_read" />}>
              <Route path="promotions" element={<PromotionsPage />} />
            </Route>
            <Route element={<PermissionGate permission="/dining-tables_read" />}>
              <Route path="tables" element={<DiningTablesPage />} />
            </Route>
            <Route
              element={
                <PermissionGate
                  anyOf={['/employees_read', '/positions_read', '/roles_read']}
                />
              }
            >
              <Route path="employees" element={<EmployeesPage />} />
            </Route>
            <Route
              element={
                <PermissionGate
                  anyOf={[
                    '/equipment_read',
                    '/system-settings_read',
                    '/management-exceptions_read',
                  ]}
                />
              }
            >
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route element={<PermissionGate permission="/audit-logs_read" />}>
              <Route path="audit-logs" element={<AuditLogsPage />} />
            </Route>
            <Route
              element={
                <PermissionGate
                  anyOf={['/print-devices_read', '/print-jobs_read', '/receipts_reprint']}
                />
              }
            >
              <Route path="printing" element={<PrintingPage />} />
            </Route>
          </Route>
          <Route
            path="*"
            element={
              <main className="feedback">
                <h1>Không tìm thấy trang</h1>
                <Link to="/">Về thực đơn</Link>
              </main>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
