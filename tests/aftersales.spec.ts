import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const employeeId = defaultMockAdminEmployee.id
const invoiceId = 'invoice-aftersales'
const itemId = '60000000-0000-4000-8000-000000000003'
const timestamp = '2026-10-11T03:00:00.000Z'
const permissions = ['/invoices_read', '/payment-refunds_read', '/cash-refunds_create', '/cashier-shifts_current', '/orders_items_remake']
const invoiceFixture = {
  id: invoiceId, invoiceNumber: 'CF-20261011-001', totalAmount: '60000.50', subTotal: '60000.50',
  discountAmount: '0', taxAmount: '0', taxRate: '0', paymentMethod: 'CASH', paymentStatus: 'PAID',
  createdAt: timestamp, updatedAt: timestamp, employeeId, orderSessionId: 'session-aftersales',
  employee: { id: employeeId, fullName: defaultMockAdminEmployee.fullName, email: defaultMockAdminEmployee.email },
  orderSession: { id: 'session-aftersales', tableId: null as string | null, table: null, sessionStatus: 'COMPLETED' },
  orderItems: [{ id: itemId, quantity: 2, priceAtTime: '30000.25', serveStatus: 'SERVED', isPaid: true,
    note: null, menuItem: { id: 'menu-aftersales', name: 'Cà phê sữa đá', price: '32000' },
    originalRemake: null as { id: string; replacementItemId: string; reason: string } | null }],
}
const paged = (list: unknown[]) => ({ list, totalItems: list.length, totalPages: list.length ? 1 : 0, currentPage: 1 })
const refundFixture = (amount = '10000.25') => ({ id: 'cash-refund-1', invoiceId, amount, reason: 'Khách yêu cầu hoàn tiền',
  completedAt: timestamp, idempotencyKey: 'key-fixture', requestedById: employeeId,
  requestedBy: { id: employeeId, fullName: defaultMockAdminEmployee.fullName },
  cashTransaction: { id: 'cash-movement', shiftId: 'shift-current', fundId: 'fund-cash' } })

async function setup(page: Page, granted = permissions) {
  const state = { invoice: structuredClone(invoiceFixture), refunds: [] as ReturnType<typeof refundFixture>[],
    shiftOpen: true, historyError: false, invoiceError: false, failedReads: 0, totalItems: null as number | null }
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: envelope(defaultMockAdminEmployee) }))
  await page.route('**/api/v1/auth/me/permissions', route => route.fulfill({ json: envelope(defaultMockAdminAuth(granted)) }))
  await page.route('**/api/v1/invoices?*', route => route.fulfill({ json: envelope(paged([state.invoice])) }))
  await page.route(`**/api/v1/invoices/${invoiceId}`, route => {
    if (state.invoiceError) { state.failedReads++; return route.fulfill({ status: 503, json: {} }) }
    return route.fulfill({ json: envelope(state.invoice) })
  })
  await page.route(`**/api/v1/invoices/${invoiceId}/cash-refunds?*`, route => state.historyError
    ? route.fulfill({ status: 500, json: { message: 'History unavailable' } })
    : route.fulfill({ json: envelope({ ...paged(state.refunds), ...(state.totalItems === null ? {} : { totalItems: state.totalItems, totalPages: 2 }) }) }))
  await page.route('**/api/v1/cashier-shifts/current', route => state.shiftOpen ? route.fulfill({ json: envelope({
    id: 'shift-current', employeeId, employee: { id: employeeId, fullName: 'Thu ngân' }, status: 'OPEN',
    openedAt: timestamp, startingCash: '200000', fundId: 'fund-cash', fund: { id: 'fund-cash', name: 'Quỹ tiền mặt', type: 'CASH', balance: '200000' },
  }) }) : route.fulfill({ status: 404, json: {} }))
  return state
}
async function openAftersales(page: Page) {
  await page.goto('/staff/invoices')
  await page.getByTitle('Xem chi tiết & Thanh toán').click()
  const tab = page.getByRole('button', { name: 'Hoàn tiền & làm lại', exact: true })
  if (await tab.isEnabled()) await tab.click()
  return page.getByRole('region', { name: 'Hoàn tiền mặt', exact: true })
}

test('cash payout requires confirmation and preserves immutable invoice total', async ({ page }, info) => {
  const state = await setup(page)
  const bodies: Record<string, unknown>[] = []
  await page.route(`**/api/v1/invoices/${invoiceId}/cash-refunds`, route => {
    bodies.push(route.request().postDataJSON())
    const refund = { ...refundFixture(), idempotencyKey: bodies[0]!.idempotencyKey as string }
    state.refunds.push(refund); state.invoice.paymentStatus = 'PARTIALLY_REFUNDED'
    return route.fulfill({ json: envelope(refund) })
  })
  const panel = await openAftersales(page)
  await expect(panel.getByRole('button', { name: 'Chi hoàn tiền', exact: true })).toBeEnabled()
  await panel.getByLabel('Số tiền hoàn (VND)').fill('10000.25')
  await panel.getByLabel('Lý do hoàn tiền mặt').fill('Khách yêu cầu hoàn tiền')
  await panel.getByRole('button', { name: 'Chi hoàn tiền', exact: true }).click()
  const confirmation = page.getByRole('dialog', { name: 'Xác nhận chi hoàn tiền mặt' })
  await expect(confirmation).toBeVisible()
  expect(bodies).toHaveLength(0)
  const box = await confirmation.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(info.project.use.viewport!.width)
  await page.screenshot({ path: info.outputPath('cash-refund-confirmation.png') })
  await confirmation.getByRole('button', { name: 'Xác nhận chi tiền', exact: true }).dblclick()
  await expect(confirmation).toHaveCount(0)
  await expect(panel.getByRole('status').filter({ hasText: 'Đã ghi nhận hoàn' })).toBeVisible()
  await expect(panel.getByText('Còn có thể hoàn').locator('..')).toContainText('50.000,25')
  await expect(page.getByRole('dialog', { name: /Hóa đơn #/ }).getByText('Hoàn một phần', { exact: true })).toBeVisible()
  expect(bodies).toHaveLength(1)
  expect(bodies[0]).toMatchObject({ amount: '10000.25', reason: 'Khách yêu cầu hoàn tiền' })
  await expect(panel.getByText('Đã thu ban đầu').locator('..')).toContainText('60.000,50')
  await page.screenshot({ path: info.outputPath('aftersales-invoice.png') })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('unknown cash payout recovers the same key after reload even when invoice is refunded', async ({ page }) => {
  const state = await setup(page)
  const bodies: Record<string, unknown>[] = []
  await page.route(`**/api/v1/invoices/${invoiceId}/cash-refunds`, route => {
    bodies.push(route.request().postDataJSON())
    state.invoice.paymentStatus = 'REFUNDED'
    state.refunds = [refundFixture('60000.50')]
    return bodies.length === 1 ? route.abort() : route.fulfill({ json: envelope(refundFixture('60000.50')) })
  })
  const panel = await openAftersales(page)
  await panel.getByLabel('Số tiền hoàn (VND)').fill('60000.50')
  await panel.getByLabel('Lý do hoàn tiền mặt').fill('Khách yêu cầu hoàn tiền')
  await panel.getByRole('button', { name: 'Chi hoàn tiền', exact: true }).click()
  await page.getByRole('dialog', { name: 'Xác nhận chi hoàn tiền mặt' }).getByRole('button', { name: 'Xác nhận chi tiền' }).click()
  await expect(page.getByRole('dialog', { name: 'Xác nhận chi hoàn tiền mặt' }).getByRole('alert')).toBeVisible()
  await openAftersales(page)
  await expect(panel.getByRole('status').filter({ hasText: 'Chưa xác nhận kết quả' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: /Hóa đơn #/ }).getByRole('button', { name: 'Đóng', exact: true })).toBeDisabled()
  await panel.getByRole('button', { name: 'Kiểm tra lại cùng yêu cầu', exact: true }).click()
  await expect.poll(() => bodies.length).toBe(2)
  expect(bodies[1]).toEqual(bodies[0])
  await expect(panel.getByRole('status').filter({ hasText: 'Chưa xác nhận kết quả' })).toHaveCount(0)
})

test('uncollected items and a closed shift both block a new cash payout', async ({ page }) => {
  const state = await setup(page)
  state.invoice.orderItems[0]!.serveStatus = 'READY'
  state.shiftOpen = false
  const panel = await openAftersales(page)
  await expect(panel.getByText('Cần giao đủ món của hóa đơn trước khi hoàn tiền.')).toBeVisible()
  await expect(panel.getByText('Bạn cần một ca tiền mặt đang mở để chi hoàn tiền.')).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Chi hoàn tiền', exact: true })).toBeDisabled()
})

test('a failed invoice reread cannot deadlock an already submitted cash refund', async ({ page }) => {
  const state = await setup(page)
  const bodies: Record<string, unknown>[] = []
  await page.route(`**/api/v1/invoices/${invoiceId}/cash-refunds`, route => {
    bodies.push(route.request().postDataJSON())
    state.invoiceError = bodies.length === 1
    return bodies.length === 1 ? route.abort() : route.fulfill({ json: envelope(refundFixture()) })
  })
  const panel = await openAftersales(page)
  await panel.getByLabel('Số tiền hoàn (VND)').fill('10000.25')
  await panel.getByLabel('Lý do hoàn tiền mặt').fill('Khách yêu cầu hoàn tiền')
  await panel.getByRole('button', { name: 'Chi hoàn tiền', exact: true }).click()
  const confirmation = page.getByRole('dialog', { name: 'Xác nhận chi hoàn tiền mặt' })
  await confirmation.getByRole('button', { name: 'Xác nhận chi tiền' }).click()
  await expect.poll(() => state.failedReads).toBeGreaterThan(0)
  await confirmation.getByRole('button', { name: 'Kiểm tra lại cùng yêu cầu', exact: true }).click()
  await expect(confirmation).toHaveCount(0)
  expect(bodies).toHaveLength(2)
  expect(bodies[0]).toEqual(bodies[1])
})

test('corrupt recovery data fails closed instead of creating a fresh payout', async ({ page }) => {
  await setup(page)
  await page.addInitScript(key => sessionStorage.setItem(key, '{broken'),
    `coffee-shop:pending:private:intent:${employeeId}:cash-refund:${invoiceId}`)
  const panel = await openAftersales(page)
  await expect(panel.getByRole('alert')).toContainText('Không đọc được yêu cầu phục hồi')
  await expect(panel.getByRole('button', { name: 'Chi hoàn tiền', exact: true })).toBeDisabled()
})

test('read-only staff sees history but no financial or remake command', async ({ page }) => {
  const state = await setup(page, ['/invoices_read', '/payment-refunds_read'])
  state.refunds.push(refundFixture())
  const panel = await openAftersales(page)
  await expect(panel.getByText('Khách yêu cầu hoàn tiền')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Chi hoàn tiền', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Làm lại', exact: true })).toHaveCount(0)
})

test('paginated refund history cannot invent a remaining balance', async ({ page }) => {
  const state = await setup(page)
  state.totalItems = 21
  state.refunds.push(refundFixture())
  const panel = await openAftersales(page)
  await expect(panel.getByRole('navigation', { name: 'Phân trang' })).toBeVisible()
  await expect(panel.getByText('Còn có thể hoàn')).toHaveCount(0)
})

test('failed refund history blocks payout instead of assuming no earlier refunds', async ({ page }) => {
  const state = await setup(page)
  state.historyError = true
  const panel = await openAftersales(page)
  await expect(panel.getByRole('alert')).toContainText('Dịch vụ tạm thời không khả dụng')
  await expect(panel.getByRole('button', { name: 'Chi hoàn tiền', exact: true })).toBeDisabled()
})

test('remake requires full-line waste confirmation and removes its action after success', async ({ page }, info) => {
  const state = await setup(page)
  const bodies: Record<string, unknown>[] = []
  await page.route(`**/api/v1/orders/items/${itemId}/remake`, route => {
    bodies.push(route.request().postDataJSON())
    const remake = { id: 'remake-1', originalItemId: itemId, replacementItemId: 'replacement-1', reason: bodies[0]!.reason as string }
    state.invoice.orderItems[0]!.originalRemake = remake
    return route.fulfill({ json: envelope({ ...remake, replacementItem: { id: 'replacement-1', quantity: 2, priceAtTime: '0', invoiceId: null, isPaid: true, serveStatus: 'PENDING' } }) })
  })
  await openAftersales(page)
  const panel = page.getByRole('region', { name: 'Làm lại món', exact: true })
  await panel.getByRole('button', { name: 'Làm lại', exact: true }).click()
  const confirmation = page.getByRole('dialog', { name: 'Xác nhận làm lại món' })
  await confirmation.getByLabel('Lý do làm lại').fill('Pha sai công thức')
  await expect(confirmation.getByRole('button', { name: 'Xác nhận gửi bếp' })).toBeDisabled()
  await confirmation.getByRole('checkbox').check()
  expect(bodies).toHaveLength(0)
  await page.screenshot({ path: info.outputPath('remake-confirmation.png') })
  await confirmation.getByRole('button', { name: 'Xác nhận gửi bếp' }).click()
  await expect(confirmation).toHaveCount(0)
  await expect(panel.getByRole('status')).toContainText('không thu thêm tiền')
  await expect(panel.getByText('Đã yêu cầu làm lại')).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Làm lại', exact: true })).toHaveCount(0)
  expect(bodies).toHaveLength(1)
  expect(bodies[0]).toMatchObject({ reason: 'Pha sai công thức' })
  expect(bodies[0]).not.toHaveProperty('quantity')
})

test('closed dine-in sessions never allow a remake into the old table', async ({ page }) => {
  const state = await setup(page)
  state.invoice.orderSession.tableId = 'old-table'
  await openAftersales(page)
  await expect(page.getByRole('region', { name: 'Làm lại món' }).getByRole('button', { name: 'Làm lại', exact: true })).toBeDisabled()
})
