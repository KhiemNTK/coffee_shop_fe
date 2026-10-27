import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee as employee, envelope } from './helpers.js'

const id = '93000000-0000-4000-8000-000000000001'
const otherId = '93000000-0000-4000-8000-000000000002'
const lineId = '93000000-0000-4000-8000-000000000003'
const date = '2026-10-26T01:00:00.000Z'
const paged = (list: unknown[]) => ({ list, totalItems: list.length, totalPages: list.length ? 1 : 0, currentPage: 1 })
const session = { id, sessionStatus: 'ACTIVE', createdAt: date, table: null, employee, orderItems: [
  { id: lineId, quantity: 1, priceAtTime: '40000', serveStatus: 'SERVED', isPaid: false, selectedOptions: [], menuItem: { id: otherId, name: 'Existing drink', price: '40000' } },
] }
const recoveryKey = `coffee-shop:pending:private:intent:${employee.id}:orders.sessions.open`

async function staff(page: Page, permissions: string[]) {
  await page.route('**/api/v1/**', route => route.fulfill({ status: 503, json: { message: 'Unmocked API' } }))
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: envelope(employee) }))
  await page.route('**/api/v1/auth/me/permissions', route => route.fulfill({ json: envelope(defaultMockAdminAuth(permissions)) }))
}

async function pos(page: Page, permissions: string[] = []) {
  await staff(page, ['/orders_sessions_read', '/orders_items_create', '/invoices_create', '/invoices_pay', ...permissions])
  await page.route(`**/api/v1/orders/sessions/${id}`, route => route.fulfill({ json: envelope(session) }))
  await page.route('**/api/v1/menu/public/categories', route => route.fulfill({ json: envelope([]) }))
  await page.route('**/api/v1/menu/public/items?*', route => route.fulfill({ json: envelope(paged([
    { id: otherId, name: 'Draft drink', price: '30000', category: { id: lineId, name: 'Coffee' }, optionGroups: [] },
  ])) }))
}

test('POS keeps unsent items and blocks checkout buttons and F2', async ({ page }, info) => {
  await pos(page)
  await page.goto(`/staff/pos/sessions/${id}`)
  await page.getByRole('button', { name: /Draft drink/ }).click()
  await expect(page.getByRole('button', { name: /Thanh toán hóa đơn/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: /Thanh toán \(/ })).toBeDisabled()
  await page.keyboard.press('F2')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('status')).toContainText('Còn món chưa gửi')
  const key = `coffee_pos_draft_${employee.id}_${id}`
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toContain('Draft drink')
  await page.screenshot({ path: info.outputPath('pos-unsent-items.png'), fullPage: true })
  await page.reload()
  await expect(page.getByRole('button', { name: /Thanh toán hóa đơn/ })).toBeDisabled()
  await page.getByRole('button', { name: 'Xóa tất cả', exact: true }).click()
  await expect(page.getByRole('button', { name: /Thanh toán hóa đơn/ })).toBeEnabled()
})

test('online queue never silently selects the next order after another terminal removes it', async ({ page }, info) => {
  await page.clock.install()
  await staff(page, ['/online-orders_read', '/online-orders_review'])
  let orders = [id, otherId].map((value, index) => ({ id: value, pickupName: index ? 'Audit B' : 'Audit A', phoneNumber: '0901234567', quotedSubtotal: '40000', createdAt: date, expiresAt: new Date(Date.now() + 3_600_000).toISOString(), items: [] }))
  await page.route('**/api/v1/online-orders/requests?*', route => route.fulfill({ json: envelope(paged(orders)) }))
  const approved: string[] = []
  await page.route('**/api/v1/online-orders/requests/*/accept', route => {
    approved.push(route.request().url())
    return route.fulfill({ json: envelope({ requestId: otherId, status: 'ACCEPTED', orderSessionId: lineId }) })
  })
  await page.goto('/staff/online-orders')
  await page.getByRole('button', { name: /Audit A/ }).click()
  orders = [orders[1]!]
  await page.clock.runFor(10_100)
  await expect(page.getByRole('status')).toContainText('Chọn lại một đơn')
  await expect(page.getByRole('button', { name: 'Duyệt đơn', exact: true })).toHaveCount(0)
  expect(approved).toHaveLength(0)
  await page.screenshot({ path: info.outputPath('online-selection-changed.png'), fullPage: true })
  await page.getByRole('button', { name: /Audit B/ }).click()
  await page.getByRole('button', { name: 'Duyệt đơn', exact: true }).click()
  await expect.poll(() => approved.length).toBe(1)
  expect(approved[0]).toContain(otherId)
})

test('unknown POS openings recover the original payload and key after reload', async ({ page }) => {
  await pos(page, ['/orders_sessions_create'])
  const writes: Record<string, unknown>[] = []
  await page.route('**/api/v1/orders/sessions', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: envelope([]) })
    writes.push(route.request().postDataJSON())
    return writes.length === 1 ? route.abort() : route.fulfill({ json: envelope(session) })
  })
  await page.goto('/staff/pos')
  await page.getByRole('button', { name: 'Mở đơn mang đi', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Kiểm tra lại lần mở phiên', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Mở đơn mang đi', exact: true })).toBeDisabled()
  await page.reload()
  await page.getByRole('button', { name: 'Kiểm tra lại lần mở phiên', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/staff/pos/sessions/${id}$`))
  expect(writes).toHaveLength(2)
  expect(writes[1]).toEqual(writes[0])
  expect(await page.evaluate(key => sessionStorage.getItem(key), recoveryKey)).toBeNull()
})

for (const mode of ['corrupt', 'expired'] as const) {
  test(`POS opening blocks a ${mode} recovery instead of creating a replacement`, async ({ page }) => {
    await page.addInitScript(({ key, mode }) => sessionStorage.setItem(key, mode === 'corrupt' ? '{broken' : JSON.stringify({
      payload: { tableId: null }, idempotencyKey: '93000000-0000-4000-8000-000000000004', createdAt: Date.now() - 24 * 3_600_000,
    })), { key: recoveryKey, mode })
    await staff(page, ['/orders_sessions_read', '/orders_sessions_create'])
    await page.route('**/api/v1/orders/sessions', route => route.fulfill({ json: envelope([]) }))
    await page.goto('/staff/pos')
    await expect(page.getByRole('button', { name: 'Mở đơn mang đi', exact: true })).toBeDisabled()
    await expect(page.getByRole('alert').filter({ hasText: mode === 'corrupt' ? 'Không đọc được' : 'quá thời hạn' })).toBeVisible()
    if (mode === 'expired') await expect(page.getByRole('button', { name: 'Kiểm tra lại lần mở phiên', exact: true })).toBeDisabled()
  })
}

test('POS transfer resets selection, checks remote occupancy and shows errors inside the dialog', async ({ page }) => {
  await page.clock.install()
  await pos(page, ['/orders_tables_transfer', '/dining-tables_read'])
  const source = { id, name: 'Source table', status: 'OCCUPIED' }
  let tables = [source, { id: otherId, name: 'Target B', status: 'EMPTY' }, { id: lineId, name: 'Target C', status: 'EMPTY' }]
  await page.route(`**/api/v1/orders/sessions/${id}`, route => route.fulfill({ json: envelope({ ...session, table: source }) }))
  await page.route('**/api/v1/dining-tables', route => route.fulfill({ json: envelope(tables) }))
  await page.route('**/api/v1/orders/sessions/transfer-table', route => route.fulfill({ status: 409, json: { message: 'Bàn đích vừa được sử dụng.' } }))
  await page.goto(`/staff/pos/sessions/${id}`)
  await page.getByRole('button', { name: 'Chuyển bàn', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Chọn bàn trống muốn chuyển sang:').selectOption(otherId)
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click()
  await page.getByRole('button', { name: 'Chuyển bàn', exact: true }).click()
  await expect(dialog.getByLabel('Chọn bàn trống muốn chuyển sang:')).toHaveValue('')
  await dialog.getByLabel('Chọn bàn trống muốn chuyển sang:').selectOption(otherId)
  tables = [source, { id: otherId, name: 'Target B', status: 'OCCUPIED' }, { id: lineId, name: 'Target C', status: 'EMPTY' }]
  await page.clock.runFor(10_100)
  await expect(dialog.getByRole('button', { name: 'Xác nhận chuyển', exact: true })).toBeDisabled()
  await dialog.getByLabel('Chọn bàn trống muốn chuyển sang:').selectOption(lineId)
  await dialog.getByRole('button', { name: 'Xác nhận chuyển', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Bàn đích vừa được sử dụng')
  await expect(dialog.getByRole('button', { name: 'Xác nhận chuyển', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Xác nhận chuyển', exact: true })).toBeEnabled()
})

test('intake refreshes at pause expiry and follows changes from another manager', async ({ page }) => {
  await page.clock.install()
  await staff(page, ['/online-orders_read', '/online-orders_manage-intake'])
  await page.route('**/api/v1/online-orders/requests?*', route => route.fulfill({ json: envelope(paged([])) }))
  let acceptingOrders = false
  let reads = 0
  const pausedUntil = new Date(Date.now() + 2_000).toISOString()
  await page.route('**/api/v1/online-orders/intake', route => {
    reads++
    return route.fulfill({ json: envelope({ acceptingOrders, pausedUntil, reason: 'Bếp quá tải', version: reads }) })
  })
  await page.goto('/staff/online-orders')
  const control = page.getByRole('region', { name: 'Nhận đơn online', exact: true })
  await expect(control).toContainText('Bếp quá tải')
  const before = reads
  acceptingOrders = true
  await page.clock.runFor(2_200)
  await expect.poll(() => reads).toBeGreaterThan(before)
  await expect(control.getByRole('button', { name: 'Nhận đơn trở lại', exact: true })).toHaveCount(0)
  acceptingOrders = false
  await page.clock.runFor(15_100)
  await expect(control).toContainText('Bếp quá tải')
})

for (const area of ['operations', 'reconciliation'] as const) {
  test(`${area} distinguishes refund exceptions from payment reconciliation`, async ({ page }, info) => {
    await staff(page, ['/management-exceptions_read', '/payment-reconciliation_read', '/payment-reconciliation_manage'])
    const incident = { id, type: 'REFUND_STATE_MISMATCH', title: 'Audit refund uncertain', detectedAt: date, paymentAttemptId: otherId, paymentRefundId: lineId, status: 'OPEN', resolutionNote: null,
      paymentAttempt: { id: otherId, status: 'SUCCEEDED', amount: '40000', invoiceId: id, merchantReference: 'AUDIT-PAYMENT' } }
    const counts = { PAYMENT: 1, CASH_EXPENSE: 0, CASH_HANDOVER: 0, FEEDBACK: 0, KITCHEN_OVERDUE: 0, ONLINE_PICKUP_LATE: 0, OUTBOX_DEAD_LETTER: 0, PRINT_REVIEW: 0 }
    await page.route('**/api/v1/management/exceptions/summary', route => route.fulfill({ json: envelope({ asOf: date, counts, total: 1 }) }))
    await page.route('**/api/v1/management/exceptions?*', route => route.fulfill({ json: envelope({ kind: 'PAYMENT', ...paged([incident]) }) }))
    await page.route('**/api/v1/payment-reconciliation/incidents?*', route => route.fulfill({ json: envelope(paged([incident])) }))
    await page.goto(`/staff/${area}`)
    await page.getByRole('button', { name: 'Chi tiết', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(lineId)
    await expect(dialog.getByRole('status')).toContainText('ngoại lệ hoàn tiền')
    await expect(dialog.getByRole('button', { name: /Đối soát lại/ })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`${area}-refund.png`), fullPage: true })
  })
}
