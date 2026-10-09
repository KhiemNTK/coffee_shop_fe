import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const id = '30000000-0000-4000-8000-000000000001'
const itemId = '30000000-0000-4000-8000-000000000002'
const tableId = '30000000-0000-4000-8000-000000000003'
const targetId = '30000000-0000-4000-8000-000000000004'
const code = 'c'.repeat(43)
const date = '2026-10-04T08:00:00.000Z'
const paged = (list: unknown[]) => ({ list, totalItems: list.length, totalPages: list.length ? 1 : 0, currentPage: 1 })
async function staff(page: Page, permissions: string[]) {
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: envelope(defaultMockAdminEmployee) }))
  await page.route('**/api/v1/auth/me/permissions', route => route.fulfill({ json: envelope(defaultMockAdminAuth(permissions)) }))
}
async function inventory(page: Page) {
  await page.route('**/api/v1/inventory/**', route => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill({ json: envelope(paged(path.endsWith('/items') ? [{ id: itemId, name: 'Cà phê hạt', stock: '10.1234', categoryId: id, unitId: id, unit: { id, name: 'kg' } }] : [])) })
  })
}

test('offline warning distinguishes uncertain writes from a safe retry', async ({ page }) => {
  await page.goto('/sign-in')
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }); window.dispatchEvent(new Event('offline')) })
  await expect(page.getByRole('status').filter({ hasText: 'Thiết bị đang ngoại tuyến' })).toContainText('chưa gửi lại giao dịch chưa rõ kết quả')
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); window.dispatchEvent(new Event('online')) })
  await expect(page.getByText('Thiết bị đang ngoại tuyến.', { exact: false })).toHaveCount(0)
})

test('failed lazy screen has a render fallback instead of a blank page', async ({ page }) => {
  await staff(page, ['/payment-reconciliation_read'])
  await page.route('**/src/features/reconciliation/reconciliation-page.tsx*', route => route.abort())
  await page.goto('/staff/reconciliation')
  await expect(page.getByRole('heading', { name: 'Chưa mở được màn hình' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Kiểm tra trạng thái giao dịch')
})

test('exception read failure is not shown as an empty healthy queue', async ({ page }) => {
  await staff(page, ['/management-exceptions_read'])
  await page.route('**/api/v1/management/exceptions/summary', route => route.fulfill({ json: envelope({ counts: { PAYMENT: 0, CASH_EXPENSE: 0, CASH_HANDOVER: 0, FEEDBACK: 0 }, total: 0 }) }))
  await page.route('**/api/v1/management/exceptions?*', route => route.fulfill({ status: 503, json: { message: 'Unavailable' } }))
  await page.goto('/staff/settings')
  await expect(page.getByRole('alert')).toContainText('Dịch vụ tạm thời không khả dụng')
  await expect(page.getByText('Không có ngoại lệ tồn đọng')).toHaveCount(0)
})

test('incident resolution requires a note and explicit confirmation', async ({ page }) => {
  await staff(page, ['/payment-reconciliation_read', '/payment-reconciliation_manage'])
  const incident = { id, type: 'STALE_ATTEMPT', status: 'OPEN', title: 'Payment cần kiểm tra', detectedAt: date, paymentAttemptId: itemId,
    paymentRefundId: null, resolutionNote: null, paymentAttempt: { id: itemId, status: 'PENDING', amount: '125000.50', invoiceId: tableId, merchantReference: 'PAY-001' } }
  let posts = 0
  await page.route('**/api/v1/payment-reconciliation/incidents?*', route => route.fulfill({ json: envelope(paged([incident])) }))
  await page.route('**/api/v1/payment-reconciliation/incidents/' + id + '/resolve', route => {
    posts++; expect(route.request().postDataJSON()).toEqual({ action: 'RESOLVE', resolutionNote: 'Đã xác minh giao dịch' })
    return route.fulfill({ json: envelope({ id, status: 'RESOLVED' }) })
  })
  await page.goto('/staff/reconciliation')
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Đã xử lý', exact: true })).toBeDisabled()
  await dialog.getByLabel('Lý do xử lý').fill('Đã xác minh giao dịch')
  await dialog.getByRole('button', { name: 'Đã xử lý', exact: true }).click()
  expect(posts).toBe(0)
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(posts).toBe(1)
})

test('bank import validates duplicates and reviews the statement before posting', async ({ page }, info) => {
  await staff(page, ['/bank-reconciliation_read', '/bank-reconciliation_import'])
  await page.route('**/api/v1/bank-reconciliation/imports?*', route => route.fulfill({ json: envelope(paged([])) }))
  await page.route('**/api/v1/bank-reconciliation/entries?*', route => route.fulfill({ json: envelope(paged([])) }))
  let posts = 0
  await page.route('**/api/v1/bank-reconciliation/imports', route => {
    posts++
    const data = route.request().postDataJSON()
    expect(data.entries[0].amount).toBe('125000.50')
    return route.fulfill({ json: envelope({ statementImport: { ...data, id, createdAt: date, fund: { id, name: 'Ngân hàng' } }, reconciliationPending: true }) })
  })
  await page.goto('/staff/reconciliation?tab=bank')
  await page.getByLabel('Quỹ ngân hàng').fill(id)
  const entry = { externalId: 'B001', direction: 'CREDIT', amount: '125000.50', transactionDate: date }
  const statement = { statementFrom: '2026-10-04T00:00:00Z', statementTo: '2026-10-05T00:00:00Z', entries: [entry, entry] }
  await page.getByLabel('Sao kê JSON').setInputFiles({ name: 'duplicate.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(statement)) })
  await expect(page.getByRole('alert')).toContainText('Mã giao dịch bị trùng')
  expect(posts).toBe(0)
  await page.getByLabel('Sao kê JSON').setInputFiles({ name: 'statement.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...statement, entries: [entry] })) })
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(posts).toBe(0)
  const box = await page.getByRole('dialog').boundingBox()
  expect(box!.width).toBeLessThanOrEqual(info.project.use.viewport!.width)
  await page.screenshot({ path: info.outputPath('bank-preview.png') })
  await page.getByRole('button', { name: 'Xác nhận nhập', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('alert')).toContainText('Đã nhập sao kê. Đối soát tự động chưa hoàn tất.')
  expect(posts).toBe(1)
})

test('feedback reports use invoiceNumber and do not offer mutation to a reader', async ({ page }) => {
  await staff(page, ['/reports_read'])
  await page.route('**/api/v1/orders/takeaway/feedback/cases?*', route => route.fulfill({ json: envelope(paged([{ id, invoice: { invoiceNumber: 'HD-001' }, rating: 1, comment: 'Món bị nguội', createdAt: date }])) }))
  await page.goto('/staff/reconciliation?tab=feedback')
  await expect(page.getByText('HD-001', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Xử lý', exact: true })).toHaveCount(0)
})

test('pickup link keeps credentials off query strings, storage and read cache keys', async ({ page }, info) => {
  let polls = 0
  await page.route('**/api/v1/orders/takeaway/pickup/status', route => {
    polls++
    expect(new URL(route.request().url()).search).toBe('')
    expect(route.request().postDataJSON()).toEqual({ invoiceId: id, code })
    return route.fulfill({ json: envelope({ invoiceId: id, status: 'READY', expiresAt: '2099-01-01T00:00:00Z', items: [{ id: itemId, name: 'Cà phê hạt', quantity: 2, serveStatus: 'READY' }] }) })
  })
  await page.goto('/pickup#' + new URLSearchParams({ invoiceId: id, code }))
  await expect(page.getByRole('heading', { name: 'Sẵn sàng nhận tại quán' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Đánh giá đơn hàng' })).toHaveCount(0)
  const privateData = await page.evaluate(async () => {
    const path = '/src/app/query-client.ts'
    const { queryClient } = await import(path)
    return JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, keys: queryClient.getQueryCache().getAll().map((query: { queryKey: unknown }) => query.queryKey) })
  })
  expect(privateData).not.toContain(code)
  expect(polls).toBeGreaterThan(0)
  await page.screenshot({ path: info.outputPath('pickup-ready.png') })
})

test('collected pickup feedback freezes an uncertain request for an identical retry', async ({ page }) => {
  await page.route('**/api/v1/orders/takeaway/pickup/status', route => route.fulfill({ json: envelope({ invoiceId: id, status: 'COLLECTED', expiresAt: '2099-01-01T00:00:00Z', items: [{ id: itemId, name: 'Coffee', quantity: 1, serveStatus: 'SERVED' }] }) }))
  const payloads: unknown[] = []
  await page.route('**/api/v1/orders/takeaway/pickup/feedback', route => {
    payloads.push(route.request().postDataJSON())
    return payloads.length === 1 ? route.abort() : route.fulfill({ json: envelope({ id: itemId, rating: 2, comment: 'Cần cải thiện', createdAt: date }) })
  })
  await page.goto('/pickup#' + new URLSearchParams({ invoiceId: id, code }))
  await page.getByRole('radio', { name: '2/5' }).check()
  await page.getByLabel('Nhận xét').fill('Cần cải thiện')
  await page.getByRole('button', { name: 'Gửi đánh giá', exact: true }).click()
  await expect(page.getByLabel('Nhận xét')).toBeDisabled()
  await page.getByRole('button', { name: 'Gửi lại cùng đánh giá' }).click()
  await expect(page.getByRole('status')).toContainText('Cảm ơn')
  expect(payloads).toHaveLength(2)
  expect(payloads[0]).toEqual(payloads[1])
})

test('staff pickup handoff only enables ready lines and verifies after uncertainty', async ({ page }) => {
  await staff(page, ['/online-orders_read', '/orders_items_handoff'])
  await page.route('**/api/v1/online-orders/**', route => route.fulfill({ json: envelope(paged([])) }))
  await page.route('**/api/v1/orders/takeaway/pickup/status', route => route.fulfill({ json: envelope({ invoiceId: id, status: 'PARTIALLY_READY', expiresAt: '2099-01-01T00:00:00Z', items: [
    { id: itemId, name: 'Đã pha', quantity: 1, serveStatus: 'READY' }, { id: targetId, name: 'Chưa pha', quantity: 1, serveStatus: 'COOKING' },
  ] }) }))
  let posts = 0
  await page.route('**/api/v1/orders/takeaway/pickup/collect', route => { posts++; return route.abort() })
  await page.goto('/staff/online-orders')
  await page.getByLabel('Liên kết nhận hàng').fill('http://localhost:4173/pickup#' + new URLSearchParams({ invoiceId: id, code }))
  await page.getByRole('button', { name: 'Kiểm tra', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Bàn giao', exact: true })).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Bàn giao', exact: true }).nth(1)).toBeDisabled()
  page.on('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Bàn giao', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Bàn giao', exact: true }).first()).toBeDisabled()
  expect(posts).toBe(1)
})

test('bulk stock movement reviews decimals and reuses a key after malformed success', async ({ page }, info) => {
  await staff(page, ['/inventory_read', '/inventory_stock_adjust'])
  await inventory(page)
  const payloads: Array<{ idempotencyKey: string; items: unknown[] }> = []
  await page.route('**/api/v1/inventory/imports/bulk', route => {
    payloads.push(route.request().postDataJSON())
    return route.fulfill({ json: envelope(payloads.length === 1 ? [{ status: 'malformed' }] : [{ inventoryItemId: itemId, transactionId: id, type: 'IMPORT', quantity: '0.1234', unitCost: '10000.25', totalAmount: '1234.03', stockAfter: '10.2468', averageUnitCost: '10000.25' }]) })
  })
  await page.goto('/staff/inventory')
  await page.getByRole('button', { name: 'Nhập / Xuất nhiều nguyên liệu' }).click()
  await page.getByRole('combobox', { name: 'Nguyên liệu 1', exact: true }).selectOption(itemId)
  await page.getByLabel('Số lượng 1').fill('0.1234')
  await page.getByLabel('Đơn giá 1').fill('10000.25')
  await page.getByLabel('Lý do 1').fill('Nhập hàng mới')
  await page.getByRole('button', { name: 'Kiểm tra lô' }).click()
  expect(payloads).toHaveLength(0)
  await expect(page.getByLabel('Số lượng 1')).toBeDisabled()
  await page.screenshot({ path: info.outputPath('bulk-review.png') })
  await page.getByRole('button', { name: 'Xác nhận ghi sổ' }).click()
  await expect(page.getByRole('alert')).toContainText('Phản hồi không hợp lệ')
  await page.getByRole('button', { name: 'Gửi lại cùng lô' }).click()
  await expect(page.getByText('Đã ghi nhận 1 giao dịch kho.')).toBeVisible()
  expect(payloads).toHaveLength(2)
  expect(payloads[0]).toEqual(payloads[1])
})

test('waste trace keeps four-decimal quantities and links the source session', async ({ page }) => {
  await staff(page, ['/inventory_read', '/orders_sessions_read'])
  await inventory(page)
  await page.route('**/api/v1/inventory/waste?*', route => route.fulfill({ json: envelope(paged([{ id, orderItemId: itemId, inventoryItemId: tableId, quantity: '0.1234', reason: 'Hủy sau pha chế', createdAt: date,
    employee: { id: defaultMockAdminEmployee.id, fullName: 'Nhân viên' }, snapshot: { inventoryItemName: 'Cà phê hạt', unitName: 'kg', orderItem: { id: itemId, orderSessionId: targetId, menuItem: { id: tableId, name: 'Latte' } } } }])) }))
  await page.goto('/staff/inventory')
  await page.getByRole('button', { name: 'Hao hụt', exact: true }).click()
  await expect(page.getByRole('cell', { name: '0.1234 kg' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Latte', exact: true })).toHaveAttribute('href', '/staff/pos/sessions/' + targetId)
})

test('split snapshots original quantities and stops resubmitting on conflict', async ({ page }) => {
  await staff(page, ['/orders_sessions_read', '/orders_tables_split'])
  await page.route('**/api/v1/menu/public/categories', route => route.fulfill({ json: envelope([]) }))
  await page.route('**/api/v1/menu/public/items?*', route => route.fulfill({ json: envelope(paged([])) }))
  await page.route('**/api/v1/recommendations/**', route => route.fulfill({ json: envelope([]) }))
  await page.route('**/api/v1/dining-tables', route => route.fulfill({ json: envelope([{ id: tableId, name: 'Bàn nguồn', status: 'OCCUPIED' }, { id: targetId, name: 'Bàn đích trống', status: 'EMPTY' }]) }))
  await page.route('**/api/v1/orders/sessions/' + id, route => route.fulfill({ json: envelope({ id, sessionStatus: 'ACTIVE', createdAt: date, table: { id: tableId, name: 'Bàn nguồn', status: 'OCCUPIED' }, employee: { id: defaultMockAdminEmployee.id, fullName: 'Nhân viên' },
    orderItems: [{ id: itemId, quantity: 3, priceAtTime: '35000', isPaid: false, invoiceId: null, serveStatus: 'PENDING', menuItem: { id: tableId, name: 'Latte', price: '35000' } }] }) }))
  let posts = 0
  await page.route('**/api/v1/orders/sessions/split', route => {
    posts++
    expect(route.request().postDataJSON()).toEqual({ sourceOrderSessionId: id, destinationTableId: targetId, itemsToMove: [{ orderItemId: itemId, quantityToMove: 1, expectedOriginalQuantity: 3 }] })
    return route.fulfill({ status: 409, json: { message: 'Quantity changed' } })
  })
  await page.goto('/staff/pos/sessions/' + id)
  await expect(page.getByRole('button', { name: 'Chuyển bàn', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Thanh toán hóa đơn', exact: true })).toHaveCount(0)
  await expect(page.getByTitle('Hủy món', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Tách món', exact: true }).click()
  await page.getByRole('combobox', { name: 'Bàn đích', exact: true }).selectOption(targetId)
  await page.getByLabel('Số lượng tách Latte').fill('1')
  await page.getByRole('button', { name: 'Kiểm tra trước khi chuyển' }).click()
  expect(posts).toBe(0)
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Quantity changed')
  await expect(page.getByRole('button', { name: 'Xác nhận', exact: true })).toBeDisabled()
  expect(posts).toBe(1)
})

test('offline stock writes fail immediately and do not auto-submit when online returns', async ({ page }) => {
  await staff(page, ['/inventory_read', '/inventory_stock_adjust'])
  await inventory(page)
  let posts = 0
  await page.route('**/api/v1/inventory/exports/bulk', route => {
    posts++
    return route.fulfill({ json: envelope([{ inventoryItemId: itemId, transactionId: id, type: 'EXPORT', quantity: '1', unitCost: '10000', totalAmount: '10000', stockAfter: '9.1234', averageUnitCost: '10000' }]) })
  })
  await page.goto('/staff/inventory')
  await page.getByRole('button', { name: 'Nhập / Xuất nhiều nguyên liệu' }).click()
  await page.getByRole('radio', { name: 'Xuất kho', exact: true }).check()
  await page.getByRole('combobox', { name: 'Nguyên liệu 1', exact: true }).selectOption(itemId)
  await page.getByLabel('Số lượng 1').fill('1')
  await page.getByLabel('Lý do 1').fill('Xuất pha chế')
  await page.getByRole('button', { name: 'Kiểm tra lô' }).click()
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    window.dispatchEvent(new Event('offline'))
    const original = window.fetch
    window.fetch = (input, init) => String(input).includes('/exports/bulk') ? Promise.reject(new TypeError('Offline')) : original(input, init)
  })
  await page.getByRole('button', { name: 'Xác nhận ghi sổ' }).click()
  await expect(page.getByRole('alert')).toContainText('Không thể kết nối')
  expect(posts).toBe(0)
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); window.dispatchEvent(new Event('online')) })
  await expect(page.getByRole('button', { name: 'Gửi lại cùng lô' })).toBeEnabled()
  expect(posts).toBe(0)
})

test('kitchen event invalidates the current actor POS keys without invalidating another actor', async ({ page }) => {
  await page.addInitScript(() => {
    class FixtureEventSource extends EventTarget {
      onopen: (() => void) | null = null
      onerror: (() => void) | null = null
      constructor() { super(); Object.assign(window, { kitchenSource: this }); setTimeout(() => this.onopen?.(), 0) }
      close() {}
    }
    Object.assign(window, { EventSource: FixtureEventSource })
  })
  await staff(page, ['/kitchen-tickets_read', '/kitchen-stations_read'])
  await page.route('**/api/v1/kitchen/stations?*', route => route.fulfill({ json: envelope({ list: [], totalItems: 0 }) }))
  await page.route('**/api/v1/kitchen/workload', route => route.fulfill({ json: envelope({ asOf: date, dueSoonWindowSeconds: 60, stations: [] }) }))
  await page.route('**/api/v1/kitchen/tickets?*', route => route.fulfill({ json: envelope(paged([])) }))
  await page.goto('/staff/kitchen')
  await expect(page.getByRole('heading', { name: /Bếp|pha chế/i }).first()).toBeVisible()
  const result = await page.evaluate(async ({ actor, sessionId }) => {
    const path = '/src/app/query-client.ts'
    const { queryClient } = await import(path)
    const keys = [['private', actor, 'orders', 'session', sessionId], ['private', actor, 'dining-tables'],
      ['private', actor, 'orders', 'active-sessions'], ['private', 'another-employee', 'orders', 'session', sessionId],
      ['private', actor, 'kitchen', 'tickets', 'inactive-fixture'], ['private', 'another-employee', 'kitchen', 'tickets', 'inactive-fixture']]
    keys.forEach(key => queryClient.setQueryData(key, {}))
    const source = (window as unknown as { kitchenSource: EventTarget }).kitchenSource
    source.dispatchEvent(new Event('kitchen.refresh'))
    return keys.map(key => queryClient.getQueryState(key)?.isInvalidated)
  }, { actor: defaultMockAdminEmployee.id, sessionId: id })
  expect(result).toEqual([true, true, true, false, true, false])
})

test('business report preserves unknown rates and avoids a fabricated recommendation lift', async ({ page }, info) => {
  await staff(page, ['/reports_read'])
  await page.route('**/api/v1/reports/dashboard?*', route => route.fulfill({ status: 503, json: {} }))
  const summary = { submittedCount: 0, acceptedCount: 0, readyCount: 0, paidCount: 0, collectedCount: 0, rejectedCount: 0, expiredCount: 0,
    noShowCount: 0, pendingCount: 0, cancelledBeforeReviewCount: 0, cancelledAfterAcceptanceCount: 0, quotedDemand: '0.00', netReceipts: '0.00', collectedNetReceipts: '0.00',
    requestToCollectionRatePercent: null, acceptanceToCollectionRatePercent: null, noShowRatePercent: null, averageReviewSeconds: null, averagePrepSeconds: null }
  await page.route('**/api/v1/reports/online-orders?*', route => route.fulfill({ json: envelope({ period: { from: date, to: date, timeZone: 'Asia/Ho_Chi_Minh', cohort: 'requestCreatedAt' }, summary, trend: [] }) }))
  await page.route('**/api/v1/recommendations/experiment?*', route => route.fulfill({ json: envelope({ from: date, to: date, variants: ['CONTROL', 'TREATMENT'].map(variant => ({ variant, assignments: 0, offersWithCandidates: 0, requests: 0, paidOrders: 0, attachedOrders: 0, revenue: '0.00', paidConversionRate: 0, attachedPaidOrderRate: 0, revenuePerAssignment: '0.00', averageOrderValue: '0.00' })) }) }))
  await page.goto('/staff/reports')
  await page.getByRole('tab', { name: 'Hiệu quả đơn online' }).click()
  await expect(page.getByRole('region', { name: 'Hiệu quả đơn online' }).getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('definition').filter({ hasText: '—' })).toHaveCount(2)
  await expect(page.getByText('Số liệu mô tả, chưa phải kết luận thống kê về tác động của gợi ý.')).toBeVisible()
  await page.getByRole('heading', { name: 'Hành trình đơn mang đi' }).scrollIntoViewIfNeeded()
  const bounds = await page.getByRole('heading', { name: 'Hành trình đơn mang đi' }).boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(info.project.use.viewport!.width)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('online-business.png') })
})
