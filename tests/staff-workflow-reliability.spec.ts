import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const id = '92000000-0000-4000-8000-000000000001'
const targetId = '92000000-0000-4000-8000-000000000002'
const thirdId = '92000000-0000-4000-8000-000000000003'
const revision = '2026-10-26T01:00:00.000Z'
const position = { id, name: 'Thu ngân' }
const employee = { id: targetId, fullName: 'Recovery cashier', username: 'recovery-cashier', email: 'cashier@example.test', phoneNumber: '0901234567', positionId: id, isActive: true, updatedAt: revision }
const item = { id, name: 'Recovery beans', stock: '10', reservedStock: '0', categoryId: targetId, unitId: thirdId, category: { id: targetId, name: 'Hạt' }, unit: { id: thirdId, name: 'kg' } }
const paged = (list: unknown[]) => ({ list, currentPage: 1, totalPages: list.length ? 1 : 0, totalItems: list.length })
const bulkKey = `coffee-shop:pending:private:intent:${defaultMockAdminEmployee.id}:inventory.bulk`

async function staff(page: Page, permissions: string[]) {
  const session = { active: true }
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '')
    if (path === '/auth/me') return session.active ? route.fulfill({ json: envelope(defaultMockAdminEmployee) }) : route.fulfill({ status: 401 })
    if (path === '/auth/me/permissions') return route.fulfill({ json: envelope(defaultMockAdminAuth(permissions)) })
    if (path === '/auth/logout') { session.active = false; return route.fulfill({ json: envelope({ success: true }) }) }
    return route.fulfill({ status: 503 })
  })
  return session
}

async function inventory(page: Page) {
  const session = await staff(page, ['/inventory_read', '/inventory_stock_adjust', '/inventory_delete'])
  await page.route('**/api/v1/inventory/categories?*', route => route.fulfill({ json: envelope(paged([item.category])) }))
  await page.route('**/api/v1/inventory/units?*', route => route.fulfill({ json: envelope(paged([item.unit])) }))
  await page.route('**/api/v1/inventory/reorder-alerts?*', route => route.fulfill({ json: envelope(paged([])) }))
  await page.route('**/api/v1/inventory/items?*', route => route.fulfill({ json: envelope(paged([item])) }))
  await page.goto('/staff/inventory')
  await expect(page.getByText(item.name, { exact: true })).toBeVisible()
  return session
}

test('a stale employee edit sends only changed fields and reloads before another save', async ({ page }, info) => {
  await staff(page, ['/employees_read', '/employees_update', '/positions_read'])
  await page.route('**/api/v1/positions/dropdown', route => route.fulfill({ json: envelope([position]) }))
  await page.route('**/api/v1/employees?*', route => route.fulfill({ json: envelope(paged([employee])) }))
  const current = { ...employee, isActive: false, updatedAt: '2026-10-26T01:01:00.000Z' }
  await page.route(`**/api/v1/employees/${targetId}`, route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: envelope(current) })
    const body = route.request().postDataJSON()
    expect(body).not.toHaveProperty('isActive')
    expect(body).not.toHaveProperty('positionId')
    return body.expectedUpdatedAt === revision
      ? route.fulfill({ status: 409, json: { code: 'EMPLOYEE_PROFILE_CHANGED', message: 'Hồ sơ đã thay đổi.' } })
      : route.fulfill({ json: envelope({ ...current, phoneNumber: body.phoneNumber }) })
  })
  await page.goto('/staff/employees')
  await page.getByRole('button', { name: `Chỉnh sửa thông tin ${employee.fullName}` }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Họ và tên', { exact: true })).toHaveValue(employee.fullName)
  await page.screenshot({ path: info.outputPath('employee-profile.png') })
  await dialog.getByLabel('Số điện thoại', { exact: true }).fill('0912345678')
  await dialog.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Hồ sơ đã thay đổi')
  await expect(dialog.getByLabel('Số điện thoại', { exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Đọc lại hồ sơ', exact: true }).click()
  await expect(dialog.getByLabel('Trạng thái làm việc')).toHaveValue('false')
  await dialog.getByLabel('Số điện thoại', { exact: true }).fill('0912345678')
  await dialog.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  await expect(dialog).not.toBeVisible()
})

for (const mode of ['no-permission', 'unavailable'] as const) {
  test(`employee creation explains the missing position dependency: ${mode}`, async ({ page }) => {
    await staff(page, ['/employees_read', '/employees_create', ...(mode === 'unavailable' ? ['/positions_read'] : [])])
    await page.route('**/api/v1/employees?*', route => route.fulfill({ json: envelope(paged([])) }))
    await page.goto('/staff/employees')
    await expect(page.getByRole('button', { name: 'Thêm nhân viên', exact: true })).toBeDisabled()
    if (mode === 'no-permission') await expect(page.getByText('Bạn cần quyền đọc vị trí để hoàn tất tạo nhân viên.', { exact: true })).toBeVisible()
    else await expect(page.getByRole('alert')).toContainText('Không tải được vị trí công việc.')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
}

test('a rejected inventory deletion keeps the dialog and explains the dependency', async ({ page }) => {
  await inventory(page)
  await page.route(`**/api/v1/inventory/items/${id}`, route => route.fulfill({ status: 409, json: { code: 'INVENTORY_IN_USE', message: 'Nguyên liệu còn được dùng trong công thức.' } }))
  await page.getByRole('button', { name: `Xóa ${item.name}`, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Xác nhận xóa', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('còn được dùng trong công thức')
  await expect(dialog).toContainText(item.name)
})

test('an unknown bulk movement survives logout and reload with exactly the same payload and key', async ({ page }, info) => {
  const session = await inventory(page)
  const writes: Record<string, unknown>[] = []
  await page.route('**/api/v1/inventory/imports/bulk', route => {
    writes.push(route.request().postDataJSON())
    return writes.length === 1 ? route.abort() : route.fulfill({ json: envelope([{ inventoryItemId: id, transactionId: 'tx', type: 'IMPORT', quantity: '2.5000', unitCost: '1000', totalAmount: '2500', stockAfter: '12.5000', averageUnitCost: '1000' }]) })
  })
  await page.getByRole('button', { name: 'Nhập / Xuất nhiều nguyên liệu', exact: true }).click()
  await page.getByLabel('Nguyên liệu 1', { exact: true }).selectOption(id)
  await page.getByLabel('Số lượng 1', { exact: true }).fill('2.5000')
  await page.getByLabel('Đơn giá 1', { exact: true }).fill('1000')
  await page.getByLabel('Lý do 1', { exact: true }).fill('Receipt confirmation')
  await page.getByRole('button', { name: 'Kiểm tra lô', exact: true }).click()
  await page.getByRole('button', { name: 'Xác nhận ghi sổ', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Gửi lại cùng lô', exact: true })).toBeEnabled()
  await expect.poll(() => page.evaluate(key => sessionStorage.getItem(key), bulkKey)).not.toBeNull()
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  await expect(page).toHaveURL(/\/sign-in/)
  expect(await page.evaluate(key => sessionStorage.getItem(key), bulkKey)).not.toBeNull()
  session.active = true
  await page.goto('/staff/inventory')
  await page.reload()
  await page.getByRole('button', { name: 'Nhập / Xuất nhiều nguyên liệu', exact: true }).click()
  await expect(page.getByLabel('Số lượng 1', { exact: true })).toHaveValue('2.5000')
  await expect(page.getByLabel('Số lượng 1', { exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Sửa lô', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('bulk-recovery.png'), fullPage: true })
  await page.getByRole('button', { name: 'Gửi lại cùng lô', exact: true }).click()
  await expect(page.getByText('Đã ghi nhận 1 giao dịch kho.', { exact: true })).toBeVisible()
  expect(writes).toHaveLength(2)
  expect(writes[1]).toEqual(writes[0])
  expect(await page.evaluate(key => sessionStorage.getItem(key), bulkKey)).toBeNull()
})

test('a first rejected bulk movement can be edited and gets a fresh key', async ({ page }) => {
  await inventory(page)
  const writes: { quantity: string; idempotencyKey: string }[] = []
  await page.route('**/api/v1/inventory/exports/bulk', route => {
    const body = route.request().postDataJSON()
    writes.push({ quantity: body.items[0].quantity, idempotencyKey: body.idempotencyKey })
    return writes.length === 1 ? route.fulfill({ status: 409, json: { code: 'INVENTORY_INSUFFICIENT_STOCK', message: 'Không đủ tồn khả dụng.' } })
      : route.fulfill({ json: envelope([{ inventoryItemId: id, transactionId: 'tx', type: 'EXPORT', quantity: '1', unitCost: '1000', totalAmount: '1000', stockAfter: '9', averageUnitCost: '1000' }]) })
  })
  await page.getByRole('button', { name: 'Nhập / Xuất nhiều nguyên liệu', exact: true }).click()
  await page.getByLabel('Xuất kho', { exact: true }).check()
  await page.getByLabel('Nguyên liệu 1', { exact: true }).selectOption(id)
  await page.getByLabel('Số lượng 1', { exact: true }).fill('100')
  await page.getByLabel('Lý do 1', { exact: true }).fill('Stock issue')
  await page.getByRole('button', { name: 'Kiểm tra lô', exact: true }).click()
  await page.getByRole('button', { name: 'Xác nhận ghi sổ', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Không đủ nguyên liệu khả dụng')
  await expect(page.getByLabel('Số lượng 1', { exact: true })).toBeEnabled()
  await page.getByLabel('Số lượng 1', { exact: true }).fill('1')
  await page.getByRole('button', { name: 'Kiểm tra lô', exact: true }).click()
  await page.getByRole('button', { name: 'Xác nhận ghi sổ', exact: true }).click()
  await expect(page.getByText('Đã ghi nhận 1 giao dịch kho.', { exact: true })).toBeVisible()
  expect(writes.map(write => write.quantity)).toEqual(['100', '1'])
  expect(writes[1]!.idempotencyKey).not.toBe(writes[0]!.idempotencyKey)
})

for (const mode of ['expired', 'corrupt'] as const) {
  test(`bulk recovery fails closed when the saved intent is ${mode}`, async ({ page }) => {
    await page.addInitScript(({ key, inventoryItemId, mode }) => sessionStorage.setItem(key, mode === 'corrupt' ? '{broken' : JSON.stringify({
      payload: { movement: { type: 'IMPORT', items: [{ inventoryItemId, quantity: '1', unitPrice: '1000', note: 'Original receipt' }] }, labels: { [inventoryItemId]: 'Recovery beans' } },
      createdAt: Date.now() - 24 * 60 * 60 * 1000, idempotencyKey: '92000000-0000-4000-8000-000000000004', uncertain: true,
    })), { key: bulkKey, inventoryItemId: id, mode })
    await inventory(page)
    await page.getByRole('button', { name: 'Nhập / Xuất nhiều nguyên liệu', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(mode === 'expired' ? 'quá thời hạn' : 'đối soát')
    if (mode === 'expired') await expect(page.getByRole('button', { name: 'Gửi lại cùng lô', exact: true })).toBeDisabled()
    else await expect(page.getByRole('button', { name: 'Kiểm tra lô', exact: true })).toHaveCount(0)
  })
}

test('table polling updates another terminal change and resets transfer targets on reopen', async ({ page }, info) => {
  await page.clock.install()
  await staff(page, ['/dining-tables_read', '/orders_tables_transfer'])
  const table = (tableId: string, name: string, occupied = false) => ({ id: tableId, name, status: occupied ? 'OCCUPIED' : 'EMPTY', orderSessions: occupied ? [{ id: `${tableId.slice(0, -1)}9`, sessionStatus: 'ACTIVE', createdAt: revision, orderItems: [] }] : [] })
  let tables = [table(id, 'Recovery A', true), table(targetId, 'Recovery B'), table(thirdId, 'Recovery C')]
  await page.route('**/api/v1/dining-tables', route => route.fulfill({ json: envelope(tables) }))
  await page.route('**/api/v1/orders/sessions/transfer-table', route => {
    expect(route.request().postDataJSON()).toMatchObject({ fromTableId: id, toTableId: targetId })
    tables = [table(id, 'Recovery A'), table(targetId, 'Recovery B', true), table(thirdId, 'Recovery C')]
    return route.fulfill({ json: envelope({ success: true, message: 'Transferred' }) })
  })
  await page.goto('/staff/tables')
  await page.getByTitle('Chuyển bàn sang bàn khác').click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('Chọn bàn đích', { exact: true }).selectOption(targetId)
  await dialog.getByRole('button', { name: 'Xác nhận chuyển', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await page.getByTitle('Chuyển bàn sang bàn khác').click()
  dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Chọn bàn đích', { exact: true })).toHaveValue('')
  await expect(dialog.getByRole('button', { name: 'Xác nhận chuyển', exact: true })).toBeDisabled()
  await dialog.getByLabel('Chọn bàn đích', { exact: true }).selectOption(thirdId)
  tables = [table(id, 'Recovery A'), table(targetId, 'Recovery B', true), table(thirdId, 'Recovery C', true)]
  await page.clock.runFor(15_100)
  await expect(dialog.getByRole('button', { name: 'Xác nhận chuyển', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click()
  await expect(page.locator('[data-badge]').filter({ hasText: /^Có khách$/ })).toHaveCount(2)
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  const color = await page.getByRole('heading', { name: 'Sơ đồ & Quản lý Bàn ăn', exact: true }).evaluate(node => getComputedStyle(node).color)
  expect(color).toBe(await page.locator('.staff-workspace').evaluate(node => getComputedStyle(node).color))
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('tables-dark.png'), fullPage: true })
})
