import { useTranslation } from 'react-i18next'
import { lazy, Suspense, type ComponentType } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { MenuPage } from '../features/menu/menu-page'
import { authConfig } from '../features/auth/auth.config'
import { PermissionGate, StaffLayout } from '../features/auth/staff-layout'

import { staffDestinations, type StaffDestination } from '../features/auth/staff-navigation'

const StaffHome = lazy(() => import('../features/auth/staff-home'))
const StaffAccount = lazy(() => import('../features/auth/staff-account'))
const OperationsPage = lazy(() => import('../features/operations/operations-page'))
const SignInPage = lazy(() => import('../features/auth/sign-in-page'))
const SignUpPage = authConfig.signupEnabled
  ? lazy(() => import('../features/auth/sign-up-page'))
  : undefined
const PasswordRecoveryPage = lazy(() => import('../features/auth/password-recovery-page'))
const PaymentReturnPage = lazy(() => import('../features/invoices/payment-return-page'))
const ReorderPage = lazy(() => import('../features/online-orders/reorder-page'))
const PickupPage = lazy(() => import('../features/online-orders/pickup-page'))
const CartPage = lazy(() => import('../features/online-orders/cart-page'))
const WishlistPage = lazy(() => import('../features/customers/wishlist-page'))
const CustomerSignInPage = lazy(() => import('../features/customers/customer-sign-in'))
const CustomerAccountPage = lazy(() => import('../features/customers/customer-account-page'))
const ReconciliationPage = lazy(() => import('../features/reconciliation/reconciliation-page'))
const StaffMenuPage = lazy(() => import('../features/menu/staff-menu-page'))
const CashierShiftPage = lazy(() => import('../features/cashier-shifts/cashier-shift-page'))
const PosTablesPage = lazy(() => import('../features/pos/pos-tables-page'))
const PosSessionPage = lazy(() => import('../features/pos/pos-session-page'))
const KitchenPage = lazy(() => import('../features/kitchen/kitchen-page'))
const OnlineOrderPage = lazy(() => import('../features/online-orders/online-order-page'))
const StaffOnlineOrdersPage = lazy(
  () => import('../features/online-orders/staff-online-orders-page'),
)
const InvoicesPage = lazy(() => import('../features/invoices/invoices-page'))
const InventoryPage = lazy(() => import('../features/inventory/inventory-page'))
const ReportsPage = lazy(() => import('../features/reports/reports-page'))
const PublicReservationsPage = lazy(
  () => import('../features/reservations/public-reservations-page'),
)
const StaffReservationsPage = lazy(() => import('../features/reservations/staff-reservations-page'))
const PromotionsPage = lazy(() => import('../features/promotions/promotions-page'))
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
const NotFoundPage = lazy(() => import('../features/not-found/not-found-page'))

const staffPages: Record<StaffDestination, ComponentType> = {
  operations: OperationsPage,
  pos: PosTablesPage,
  kitchen: KitchenPage,
  'online-orders': StaffOnlineOrdersPage,
  shifts: CashierShiftPage,
  invoices: InvoicesPage,
  reconciliation: ReconciliationPage,
  reservations: StaffReservationsPage,
  tables: DiningTablesPage,
  inventory: InventoryPage,
  menu: StaffMenuPage,
  promotions: PromotionsPage,
  reports: ReportsPage,
  employees: EmployeesPage,
  settings: SettingsPage,
  'audit-logs': AuditLogsPage,
  printing: PrintingPage,
}

export function AppRouter() {
  const { t: translate } = useTranslation()
  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div
            className="feedback min-h-[60vh] flex flex-col items-center justify-center gap-3 p-8 text-stone-500"
            role="status"
            aria-live="polite"
          >
            <div
              className="w-9 h-9 rounded-full border-2 border-amber-600/20 border-t-amber-600 animate-spin"
              aria-hidden="true"
            />
            <span className="font-medium text-sm text-stone-600 dark:text-stone-300 animate-pulse tracking-wide">
              {translate('common.loading')}
            </span>
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<MenuPage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/customer/sign-in" element={<CustomerSignInPage />} />
          <Route path="/account" element={<CustomerAccountPage />} />
          <Route path="/account/orders/:orderId" element={<CustomerAccountPage />} />
          <Route path="/account/orders/:orderId/reorder" element={<ReorderPage />} />
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
            <Route index element={<StaffHome />} />
            <Route path="account" element={<StaffAccount />} />
            {staffDestinations.map((destination) => {
              const Page = staffPages[destination.path]
              return (
                <Route
                  key={destination.path}
                  element={<PermissionGate anyOf={destination.permissions} />}
                >
                  <Route path={destination.path} element={<Page />} />
                </Route>
              )
            })}
            <Route element={<PermissionGate permission="/orders_sessions_read" />}>
              <Route path="pos/sessions/:sessionId" element={<PosSessionPage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
