import { lazy, Suspense } from 'react'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { MenuPage } from '../features/menu/menu-page'
import {
  PermissionGate,
  StaffHome,
  StaffLayout,
} from '../features/auth/staff-layout'

const SignInPage = lazy(() => import('../features/auth/sign-in-page'))
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
          <Route path="/reservations" element={<PublicReservationsPage />} />
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/staff" element={<StaffLayout />}>
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
