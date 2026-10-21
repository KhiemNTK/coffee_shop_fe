import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const id = '72000000-0000-4000-8000-000000000001'
const otherId = '72000000-0000-4000-8000-000000000002'
const token = 'd'.repeat(64)
const date = '2099-01-01T00:00:00.000Z'
const paged = (list: unknown[]) => ({ list, currentPage: 1, totalPages: 1, totalItems: list.length })

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', route => route.fulfill({ status: 503, json: { message: 'Unmocked API' } }))
  await page.route('**/api/v1/menu/public/store', route => route.fulfill({ json: envelope({ name: 'Coffee Homes', address: '3 Phố Nhổn, Từ Liêm, Hà Nội', phone: '0973336850' }) }))
  await page.route('**/api/v1/menu/public/categories', route => route.fulfill({ json: envelope([]) }))
  await page.route('**/api/v1/menu/public/items?*', route => route.fulfill({ json: envelope(paged([])) }))
})

async function staff(page: Page, permissions: string[]) {
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: envelope(defaultMockAdminEmployee) }))
  await page.route('**/api/v1/auth/me/permissions', route => route.fulfill({ json: envelope(defaultMockAdminAuth(permissions)) }))
}

test('explicit dine-in completion confirms guests have left and prevents rapid duplicate submits', async ({ page }, info) => {
  await staff(page, ['/orders_sessions_read', '/orders_tables_clear'])
  await page.route('**/api/v1/orders/sessions', route => route.fulfill({ json: envelope([]) }))
  await page.route('**/api/v1/dining-tables', route => route.fulfill({ json: envelope([]) }))
  let completed = false
  let writes = 0
  await page.route(`**/api/v1/orders/sessions/${id}`, route => route.fulfill({ json: envelope({
    id, sessionStatus: completed ? 'COMPLETED' : 'ACTIVE', createdAt: date,
    table: { id: otherId, name: 'Bàn 1', status: 'OCCUPIED' }, employee: defaultMockAdminEmployee,
    orderItems: [{ id: otherId, quantity: 1, priceAtTime: '25000', serveStatus: 'SERVED', isPaid: true, selectedOptions: [], menuItem: { id: otherId, name: 'Coffee', price: '25000' } }],
  }) }))
  await page.route(`**/api/v1/orders/sessions/${id}/complete`, async route => {
    writes++; completed = true
    await route.fulfill({ json: envelope({ success: true, message: 'Completed' }) })
  })
  await page.goto(`/staff/pos/sessions/${id}`)
  await expect(page.getByText('Nhân viên:', { exact: false })).toContainText('Tại bàn')
  await page.getByRole('button', { name: 'Kết thúc phục vụ', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Xác nhận khách đã rời bàn')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('complete-session.png') })
  await dialog.getByRole('button', { name: 'Xác nhận khách đã rời bàn', exact: true }).evaluate(button => {
    if (!(button instanceof HTMLButtonElement)) throw new Error('Expected a native button')
    button.click(); button.click(); button.click()
  })
  await expect(page).toHaveURL(/\/staff\/pos$/)
  expect(writes).toBe(1)
})

for (const item of [{ isPaid: false, serveStatus: 'SERVED' }, { isPaid: true, serveStatus: 'COOKING' }]) {
  test(`does not offer table release for unfinished item ${JSON.stringify(item)}`, async ({ page }) => {
    await staff(page, ['/orders_sessions_read', '/orders_tables_clear'])
    await page.route(`**/api/v1/orders/sessions/${id}`, route => route.fulfill({ json: envelope({
      id, sessionStatus: 'ACTIVE', createdAt: date, table: { id: otherId, name: 'Bàn 1', status: 'OCCUPIED' }, employee: defaultMockAdminEmployee,
      orderItems: [{ id: otherId, quantity: 1, priceAtTime: '25000', ...item, selectedOptions: [], menuItem: { id: otherId, name: 'Coffee', price: '25000' } }],
    }) }))
    await page.goto(`/staff/pos/sessions/${id}`)
    await expect(page.getByRole('button', { name: 'Kết thúc phục vụ', exact: true })).toBeDisabled()
  })
}

test('retains tracked orders when ordering again and exports a private pickup receipt', async ({ page }, info) => {
  await page.addInitScript(value => sessionStorage.setItem('coffee_shop_takeaway_order', JSON.stringify(value)), [
    { requestId: id, accessToken: token, accessExpiresAt: date },
    { requestId: otherId, accessToken: 'e'.repeat(64), accessExpiresAt: date },
  ])
  await page.route('**/api/v1/online-orders/requests/status', route => route.fulfill({ json: envelope({
    requestId: route.request().postDataJSON().requestId, status: 'ACCEPTED', expiresAt: date, accessExpiresAt: date,
    quotedSubtotal: '25000', pickupAt: date, items: [], fulfillmentStatus: 'READY', isPaid: false, orderItems: [],
  }) }))
  await page.goto('/order')
  await expect(page.getByText('3 Phố Nhổn, Từ Liêm, Hà Nội', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '0973336850', exact: true })).toHaveAttribute('href', 'tel:0973336850')
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Tải phiếu nhận đơn', exact: true }).click()
  const download = await pending
  expect(download.suggestedFilename()).toBe(`phieu-nhan-${id}.txt`)
  const path = await download.path()
  const text = await readFile(path!, 'utf8')
  expect(text).toContain(id)
  expect(text).toContain(token)
  await page.getByRole('button', { name: 'Đặt món khác', exact: true }).click()
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('coffee_shop_takeaway_order')!).length)).toBe(2)
  await page.getByRole('button', { name: 'Đơn đang theo dõi', exact: true }).click()
  const labels = await page.getByLabel('Đơn đã lưu trong phiên này').locator('option').allTextContents()
  expect(new Set(labels).size).toBe(2)
  await page.getByLabel('Đơn đã lưu trong phiên này').selectOption(otherId)
  await expect(page.getByText(otherId, { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('pickup-receipt.png'), fullPage: true })
})

test('inventory editor treats measurement unit as immutable', async ({ page }) => {
  await staff(page, ['/inventory_read', '/inventory_update'])
  const item = { id, name: 'Coffee beans', stock: '1000', reservedStock: '0', categoryId: otherId, unitId: id, unit: { id, name: 'g' }, category: { id: otherId, name: 'Beans' } }
  await page.route('**/api/v1/inventory/items?*', route => route.fulfill({ json: envelope(paged([item])) }))
  await page.route('**/api/v1/inventory/reorder-alerts', route => route.fulfill({ json: envelope(paged([])) }))
  await page.route('**/api/v1/inventory/categories?*', route => route.fulfill({ json: envelope(paged([item.category])) }))
  await page.route('**/api/v1/inventory/units?*', route => route.fulfill({ json: envelope(paged([item.unit])) }))
  await page.goto('/staff/inventory')
  await page.getByTitle('Chỉnh sửa', { exact: true }).click()
  await expect(page.getByRole('dialog').getByLabel('Đơn vị tính cố định')).toHaveValue('g')
  await expect(page.getByRole('dialog').getByLabel('Đơn vị tính cố định')).toHaveAttribute('readonly', '')
})
