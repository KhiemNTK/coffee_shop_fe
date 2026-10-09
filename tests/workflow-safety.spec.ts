import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const paged = (list: unknown[], currentPage = 1, totalItems = list.length, totalPages = 1) => ({ list, currentPage, totalItems, totalPages })
const table = { id: '61000000-0000-4000-8000-000000000001', name: 'Bàn an toàn', status: 'OCCUPIED' }
const session = { id: '61000000-0000-4000-8000-000000000002', sessionStatus: 'ACTIVE', table,
  employee: defaultMockAdminEmployee, createdAt: '2026-10-07T00:00:00Z', updatedAt: '2026-10-07T00:00:00Z', _count: { orderItems: 1 } }

async function staff(page: Page, permissions: string[]) {
  await page.route('**/api/v1/**', route => route.fulfill({ status: 503, json: { message: 'Unmocked API' } }))
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: envelope(defaultMockAdminEmployee) }))
  await page.route('**/api/v1/auth/me/permissions', route => route.fulfill({ json: envelope(defaultMockAdminAuth(permissions)) }))
}

test('table-only staff cannot enter a session detail or call its protected API', async ({ page }) => {
  await staff(page, ['/dining-tables_read'])
  let reads = 0
  await page.route('**/api/v1/orders/sessions/' + session.id, route => { reads++; return route.fulfill({ status: 403 }) })
  await page.goto('/staff/pos/sessions/' + session.id)
  await expect(page.getByRole('heading', { name: 'Không có quyền truy cập', exact: true })).toBeVisible()
  expect(reads).toBe(0)
})

test('read-only current shift never fetches expense requests without transaction permission', async ({ page }) => {
  await staff(page, ['/cashier-shifts_current'])
  let expenseReads = 0
  await page.route('**/api/v1/cashier-shifts/current', route => route.fulfill({ json: envelope({
    id: 'shift-read-only', openedAt: '2026-10-07T00:00:00Z', startingCash: '100000.00', status: 'OPEN',
    employeeId: defaultMockAdminEmployee.id, employee: defaultMockAdminEmployee,
  }) }))
  await page.route('**/api/v1/cashier-shifts/current/expense-requests?*', route => { expenseReads++; return route.fulfill({ status: 403 }) })
  await page.goto('/staff/shifts')
  await expect(page.getByRole('heading', { name: /Ca & Quỹ/ })).toBeVisible()
  await expect(page.getByText('100.000', { exact: false }).first()).toBeVisible()
  expect(expenseReads).toBe(0)
})

test('waiter POS does not call forbidden current-shift API', async ({ page }) => {
  await staff(page, ['/dining-tables_read', '/orders_sessions_read'])
  let shiftReads = 0
  await page.route('**/api/v1/cashier-shifts/current', route => { shiftReads++; return route.fulfill({ status: 403 }) })
  await page.route('**/api/v1/dining-tables', route => route.fulfill({ json: envelope([table]) }))
  await page.route('**/api/v1/orders/sessions', route => route.fulfill({ json: envelope([session]) }))
  await page.route('**/api/v1/orders/takeaway/handoff?*', route => route.fulfill({ json: envelope(paged([])) }))
  await page.goto('/staff/pos')
  await expect(page.getByRole('button', { name: /Bàn an toàn/ })).toBeVisible()
  await expect(page.getByText('Bạn chưa mở ca thu ngân.', { exact: false })).toHaveCount(0)
  expect(shiftReads).toBe(0)
})

test('session-only staff can reach seated sessions without fetching table catalog', async ({ page }) => {
  await staff(page, ['/orders_sessions_read'])
  let tableReads = 0
  await page.route('**/api/v1/dining-tables', route => { tableReads++; return route.fulfill({ status: 403 }) })
  await page.route('**/api/v1/orders/sessions', route => route.fulfill({ json: envelope([session]) }))
  await page.route('**/api/v1/orders/takeaway/handoff?*', route => route.fulfill({ json: envelope(paged([])) }))
  await page.goto('/staff/pos')
  await expect(page.getByRole('button', { name: /Bàn an toàn/ })).toBeVisible()
  expect(tableReads).toBe(0)
  await expect(page.getByText('Bàn trống', { exact: true })).toHaveCount(0)
})

test('failed session read does not expose an empty table opening command', async ({ page }) => {
  await staff(page, ['/orders_sessions_read', '/dining-tables_read', '/orders_sessions_create'])
  await page.route('**/api/v1/dining-tables', route => route.fulfill({ json: envelope([{ ...table, status: 'EMPTY' }]) }))
  await page.goto('/staff/pos')
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mở đơn mang đi' })).toHaveCount(0)
})

test('inventory history pages and filters server-side and exposes failed reads', async ({ page }) => {
  await staff(page, ['/inventory_read'])
  await page.route('**/api/v1/inventory/**', route => route.fulfill({ json: envelope(paged([])) }))
  const queries: URLSearchParams[] = []
  let failed = false
  await page.route('**/api/v1/inventory/transactions?*', route => {
    const query = new URL(route.request().url()).searchParams
    queries.push(query)
    if (failed) return route.fulfill({ status: 503, json: { message: 'Unavailable' } })
    const currentPage = Number(query.get('page'))
    return route.fulfill({ json: envelope(paged([{ id: `tx-${currentPage}`, type: 'IMPORT', quantity: '1.0000', unitPrice: '0.25',
      transactionDate: '2026-10-07T00:00:00Z', note: `History page ${currentPage}`, inventoryItemId: 'ingredient', inventoryItem: { id: 'ingredient', name: 'Coffee bean' } }], currentPage, 21, 2)) })
  })
  await page.goto('/staff/inventory')
  await page.getByRole('button', { name: 'Lịch sử Xuất / Nhập' }).click()
  const history = page.getByRole('region', { name: 'Lịch sử xuất nhập' })
  await expect(history.getByText('History page 1')).toBeVisible()
  await expect(history.getByText('21 giao dịch')).toBeVisible()
  await history.getByRole('button', { name: 'Trang sau' }).click()
  await expect(history.getByText('History page 2')).toBeVisible()
  await history.getByRole('combobox').selectOption('EXPORT')
  await expect(history.getByText('History page 1')).toBeVisible()
  expect(queries.at(-1)?.get('type')).toBe('EXPORT')
  expect(queries.at(-1)?.get('itemPerPage')).toBe('20')
  failed = true
  await history.getByRole('combobox').selectOption('IMPORT')
  await expect(history.getByRole('alert')).toBeVisible()
  await expect(history.getByText('Chưa có lịch sử biến động kho.')).toHaveCount(0)
  failed = false
  await history.getByRole('button', { name: 'Tải lại lịch sử kho' }).click()
  await expect(history.getByText('History page 1')).toBeVisible()
})

test('daily close displays immutable money, cost coverage and separate post-close refunds', async ({ page }, info) => {
  await staff(page, ['/reports_read'])
  const snapshot = { asOf: '2026-10-07T16:00:00Z', paidInvoiceCount: 3, grossSales: '35000.25', discountAmount: '0.00', taxAmount: '0.00',
    refundCount: 1, refundAmount: '0.25', netReceipts: '35000.00', estimatedNetSalesExTax: '35000.00', ingredientCost: '35000.50',
    wasteCost: '0.00', estimatedGrossProfit: '-0.50', soldItemCount: 4, itemsWithCostSnapshot: 3, zeroCostSnapshotCount: 1 }
  await page.route('**/api/v1/reports/daily-closes/*', route => route.fulfill({ json: envelope({ id: 'close', businessDate: '2026-10-07',
    closedAt: snapshot.asOf, closedById: defaultMockAdminEmployee.id, snapshot, refundDeltaSinceClose: { count: 1, amount: '1.25' } }) }))
  await page.goto('/staff/reports')
  await page.getByRole('tab', { name: 'Chốt sổ doanh thu ngày' }).click()
  await expect(page.getByRole('heading', { name: 'Ngày 2026-10-07 đã được chốt sổ thành công' })).toBeVisible()
  await expect(page.getByText('Doanh thu gộp', { exact: true }).locator('..')).toContainText('35.000,25')
  await expect(page.getByText('Lợi nhuận gộp ước tính', { exact: true }).locator('..')).toContainText('-0,50')
  await expect(page.getByText('Dòng món có snapshot giá vốn:', { exact: false })).toContainText('3/4')
  await expect(page.getByText('Hoàn tiền sau chốt:', { exact: false })).toContainText('1,25')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('daily-close.png'), fullPage: true })
})

test('Excel download refreshes once and session reset aborts a pending download', async ({ page }) => {
  await staff(page, [])
  await page.context().addCookies([{ name: 'csrfToken', value: 'csrf-fixture', url: 'http://localhost:4173' }])
  let reads = 0
  let refreshes = 0
  await page.route('**/api/v1/auth/refresh', route => { refreshes++; return route.fulfill({ json: envelope(null) }) })
  await page.route('**/api/v1/reports/dashboard/export', route => {
    reads++
    return reads === 1 ? route.fulfill({ status: 401, json: { message: 'Expired' } })
      : route.fulfill({ body: Buffer.from('xlsx-fixture'), contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  })
  await page.goto('/sign-in')
  const size = await page.evaluate(async () => {
    const path = '/src/features/reports/reports.api.ts'
    const { downloadDashboardExcel } = await import(/* @vite-ignore */ path)
    return (await downloadDashboardExcel()).size
  })
  expect(size).toBe(12)
  expect(reads).toBe(2)
  expect(refreshes).toBe(1)
  const aborted = await page.evaluate(async () => {
    const path = '/src/shared/api/client.ts'
    const { apiDownload, resetSessionRequests } = await import(/* @vite-ignore */ path)
    const result = apiDownload('/reports/dashboard/export').then(() => false, (error: Error) => error.name === 'AbortError')
    resetSessionRequests()
    return result
  })
  expect(aborted).toBe(true)
})

test('pending commands are actor-scoped and reject retries beyond the server retention window', async ({ page }) => {
  await staff(page, [])
  await page.goto('/sign-in')
  const result = await page.evaluate(async () => {
    const path = '/src/shared/api/pending-intent.ts'
    const { pendingIntentKey, isPendingIntentExpired } = await import(/* @vite-ignore */ path)
    return { distinct: pendingIntentKey('one', 'cashier') !== pendingIntentKey('two', 'cashier'),
      fresh: isPendingIntentExpired({ createdAt: Date.now() }), old: isPendingIntentExpired({ createdAt: Date.now() - 24 * 60 * 60 * 1000 }) }
  })
  expect(result).toEqual({ distinct: true, fresh: false, old: true })
})

test('definitive first rejection releases the key, but a rejected unknown retry retains it', async ({ page }) => {
  await staff(page, [])
  let writes = 0
  await page.route('**/api/v1/fixture-idempotency', route => {
    writes++
    return writes === 2 ? route.abort() : route.fulfill({ status: 400, json: { message: 'Invalid command' } })
  })
  await page.goto('/sign-in')
  const result = await page.evaluate(async () => {
    const path = '/src/shared/api/idempotency.ts'
    const schemaPath = '/src/features/cashier-shifts/cashier-shifts.api.ts'
    const { apiIdempotentMutate, findPendingOperationKey } = await import(/* @vite-ignore */ path)
    const { fundSchema } = await import(/* @vite-ignore */ schemaPath)
    const payload = { name: 'test' }
    await apiIdempotentMutate('/fixture-idempotency', fundSchema, payload).catch(() => {})
    const firstKey = await findPendingOperationKey('/fixture-idempotency', payload)
    await apiIdempotentMutate('/fixture-idempotency', fundSchema, payload).catch(() => {})
    const key = await findPendingOperationKey('/fixture-idempotency', payload)
    await apiIdempotentMutate('/fixture-idempotency', fundSchema, payload).catch(() => {})
    return { firstKey, retryKey: await findPendingOperationKey('/fixture-idempotency', payload), key }
  })
  expect(result.firstKey).toBeNull()
  expect(result.key).toBeTruthy()
  expect(result.retryKey).toBe(result.key)
})
