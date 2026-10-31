import { test, expect } from '../fixtures/live-backend'

test('frontend adapters parse actual API responses and render a takeaway invoice', async ({ backend, page, context }, info) => {
  const { cookies, prefix, ids } = backend
  await context.addCookies(cookies)
  await page.goto('/staff')
  await expect(page.getByRole('heading', { name: prefix, exact: true })).toBeVisible()
  const checks = await page.evaluate(async (fixture) => {
    const { ApiError } = await import('/src/shared/api/client.ts')
    const failures: string[] = []
    let passed = 0
    const check = async (module: string, name: string, args: unknown[] = []) => {
      try {
        const api = await import('/src/features/' + module + '.ts')
        const parts = name.split('.')
        const owner = parts.length === 2 ? api[parts[0]!] : api
        await owner[parts.at(-1)!](...args)
        passed++
      } catch (error) {
        const details = error instanceof ApiError
          ? ` [${error.code ?? error.status}] ${error.validationIssues?.join('; ') ?? ''}`
          : ''
        failures.push(name + ': ' + String(error) + details)
      }
    }
    await check('menu/menu.api', 'getCategories')
    await check('menu/menu.api', 'getMenu', [{ keyword: '', categoryId: '', page: 1 }])
    await check('menu/menu.admin.api', 'getAdminCategories', [{}])
    await check('menu/menu.admin.api', 'getAdminItems', [{}])
    await check('pos/pos.api', 'getDiningTables')
    await check('pos/pos.api', 'getActiveSessions')
    await check('pos/pos.api', 'getSessionDetail', [fixture.session])
    await check('invoices/invoices.api', 'getInvoices')
    await check('invoices/invoices.api', 'getInvoiceById', [fixture.invoice])
    await check('invoices/invoices.api', 'getInvoicePaymentAttempts', [fixture.invoice])
    await check('invoices/invoices.api', 'getPaymentProviders')
    await check('inventory/inventory.api', 'getInventoryItems')
    await check('inventory/inventory.api', 'getInventoryCategories')
    await check('inventory/inventory.api', 'getInventoryUnits')
    await check('inventory/inventory.api', 'getInventoryTransactions')
    await check('inventory/procurement.api', 'getSuppliers', [1, ''])
    await check('inventory/procurement.api', 'getReceipts', [1])
    await check('inventory/procurement.api', 'getReceipt', [fixture.receipt])
    await check('inventory/procurement.api', 'getStocktakes', [1])
    await check('inventory/procurement.api', 'getStocktake', [fixture.stocktake])
    await check('kitchen/kitchen.api', 'getKitchenStations')
    await check('kitchen/kitchen.api', 'getKitchenWorkload')
    await check('promotions/promotions.api', 'getPromotions')
    await check('employees/employees.api', 'getEmployees', [{}])
    await check('employees/employees.api', 'getRoles', [{}])
    await check('employees/employees.api', 'getPermissions', [{}])
    await check('online-orders/online-orders.api', 'getPendingOnlineOrders')
    await check('online-orders/online-orders.api', 'getFulfillmentOnlineOrders')
    await check('employees/employees.api', 'getPositions', [{}])
    await check('employees/employees.api', 'getRolePermissions', [fixture.role])
    await check('employees/employees.api', 'getEmployeeRoles', [fixture.employee])
    await check('cashier-shifts/cashier-shifts.api', 'getCurrentShift')
    await check('cashier-shifts/cashier-shifts.api', 'getCashierShifts')
    await check('cashier-shifts/cashier-shifts.api', 'getFunds')
    await check('cashier-shifts/cashier-shifts.api', 'getAllCashHandovers')
    await check('cashier-shifts/cashier-shifts.api', 'getExpenseRequests')
    await check('reports/reports.api', 'getDashboardReport')
    await check('reports/reports.api', 'getKitchenSlaReport')
    await check('reports/reports.api', 'getKitchenBottlenecks')
    await check('printing/printing.api', 'printingApi.getDevices')
    await check('printing/printing.api', 'printingApi.getJobs')
    await check('settings/settings.api', 'settingsApi.getEquipment')
    await check('settings/settings.api', 'settingsApi.getSystemSettings')
    await check('operations/operations.api', 'operationsApi.getManagementExceptionsSummary')
    await check('operations/operations.api', 'operationsApi.getManagementExceptions', [{ kind: 'PAYMENT' }])
    await check('audit-logs/audit-logs.api', 'auditLogsApi.getAuditLogs')
    await check('reservations/reservations.api', 'getReservations', [{}])
    return { passed, failures }
  }, ids)
  expect(checks.failures, 'API contract mismatch: check the backend SHA recorded by CI and its BACKEND_REF repository variable.').toEqual([])
  expect(checks.passed).toBe(47)
  await page.goto('/staff/invoices')
  await page.getByRole('row', { name: `Chi tiết hóa đơn ${prefix}`, exact: true }).click()
  await expect(page.getByRole('dialog').getByText(prefix + '-coffee', { exact: true })).toBeVisible()
  await expect(page.getByRole('dialog').getByText('Mang đi', { exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('live-takeaway-invoice.png') })
})
