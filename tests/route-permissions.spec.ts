import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const paged = (list: unknown[] = []) => ({ list, currentPage: 1, totalPages: list.length ? 1 : 0, totalItems: list.length })
const id = defaultMockAdminEmployee.id

async function staff(page: Page, initial: string[]) {
  let keys = initial
  const unexpected: string[] = []
  await page.route('**/api/v1/**', (route) => {
    unexpected.push(route.request().method() + ' ' + new URL(route.request().url()).pathname)
    return route.fulfill({ status: 403, json: { message: 'Forbidden' } })
  })
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: envelope(defaultMockAdminEmployee) }))
  await page.route('**/api/v1/auth/me/permissions', (route) => route.fulfill({ json: envelope(defaultMockAdminAuth(keys)) }))
  return {
    unexpected,
    has: (permission: string) => keys.includes(permission),
    async replace(next: string[]) {
      keys = next
      await page.evaluate(async () => {
        const path = '/src/shared/api/query-client.ts'
        const { queryClient } = await import(path)
        await queryClient.invalidateQueries({ queryKey: ['private', 'session'] })
      })
    },
  }
}

test('every staff destination denies missing grants before fetching protected data', async ({ page }) => {
  const { unexpected } = await staff(page, [])
  await page.goto('/staff/menu')
  const paths: string[] = await page.evaluate(async () => {
    const path = '/src/features/auth/staff-navigation.ts'
    const { staffDestinations } = await import(path)
    return staffDestinations.map((entry: { path: string }) => '/staff/' + entry.path)
  })
  for (const path of [...paths, '/staff/pos/sessions/' + id]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: 'Không có quyền truy cập' })).toBeVisible()
  }
  expect(unexpected).toEqual([])
})

test('permission gate rejects missing, conflicting, empty and unknown runtime policies', async ({ page }) => {
  await staff(page, [])
  await page.goto('/staff/menu')
  for (const policy of [{}, { permission: '/menu_read', anyOf: ['/menu_read'] }, { permission: '', anyOf: ['/menu_read'] }, { anyOf: null }, { anyOf: [] }, { permission: '/menu_*' }]) {
    await page.evaluate(async (value) => {
      const path = '/tests/fixtures/permission-gate-probe.tsx'
      const { renderGate } = await import(path)
      renderGate(value)
    }, policy)
    await expect(page.locator('#permission-gate-probe').getByRole('alert')).toBeVisible()
    await expect(page.locator('#permission-gate-probe').getByTestId('allowed')).toHaveCount(0)
  }
  await page.evaluate(async () => {
    const path = '/tests/fixtures/permission-gate-probe.tsx'
    const { renderGate } = await import(path)
    renderGate({ anyOf: ['/menu_read'] })
  })
  await expect(page.locator('#permission-gate-probe').getByTestId('allowed')).toBeVisible()
})

for (const [permission, endpoint, label, row] of [
  ['/inventory_suppliers_read', 'suppliers', 'Nhà cung cấp', { id, code: 'SUP', name: 'Supplier only' }],
  ['/inventory_purchase-receipts_read', 'purchase-receipts', 'Phiếu nhập', { id, receiptNumber: 'PR-READ', supplierId: id, status: 'DRAFT', totalAmount: '20000', receivedAt: '2026-10-23T00:00:00Z' }],
  ['/inventory_stocktakes_read', 'stocktakes', 'Kiểm kê', { id, stocktakeNumber: 'ST-READ', status: 'DRAFT', createdAt: '2026-10-23T00:00:00Z' }],
] as const) {
  test(`inventory opens ${endpoint} without granting stock access`, async ({ page }, info) => {
    const { unexpected } = await staff(page, [permission])
    await page.route(`**/api/v1/inventory/${endpoint}?*`, (route) => route.fulfill({ json: envelope(paged([row])) }))
    await page.goto('/staff/inventory')
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('link', { name: 'Kho hàng', exact: true })).toBeVisible()
    await expect(page.getByRole('table')).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Kho hàng & Tồn kho', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Tạo mới', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
    expect(unexpected).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`inventory-${endpoint}.png`), fullPage: true })
  })
}

test('editing an existing receipt never looks up stock or suppliers without their read grants', async ({ page }) => {
  const { unexpected } = await staff(page, ['/inventory_purchase-receipts_read', '/inventory_purchase-receipts_create'])
  const receipt = {
    id, receiptNumber: 'PR-EXISTING', supplierId: id, status: 'DRAFT', totalAmount: '20000', receivedAt: '2026-10-23T00:00:00Z', updatedAt: '2026-10-23T00:00:00Z',
    supplier: { id, code: 'SUP', name: 'Recorded supplier' },
    items: [{ inventoryItemId: id, inventoryItemName: 'Recorded ingredient', unitName: 'kg', quantity: '1', unitPrice: '20000', totalAmount: '20000' }],
  }
  await page.route('**/api/v1/inventory/purchase-receipts?*', (route) => route.fulfill({ json: envelope(paged([receipt])) }))
  await page.route('**/api/v1/inventory/purchase-receipts/' + id, (route) => route.fulfill({ json: envelope(receipt) }))
  await page.goto('/staff/inventory')
  await expect(page.getByRole('button', { name: 'Tạo mới', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: receipt.receiptNumber })
  await expect(dialog.getByLabel('Tìm nguyên liệu', { exact: true })).toBeDisabled()
  await expect(dialog.getByRole('combobox', { name: 'Nhà cung cấp', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Lưu phiếu nháp', exact: true })).toBeEnabled()
  expect(unexpected).toEqual([])
})

test('employee tabs and open role dialogs stop showing revoked access and cached data', async ({ page }) => {
  const base = ['/employees_read', '/positions_read', '/positions_update', '/roles_read', '/roles_update']
  const { unexpected, replace } = await staff(page, base)
  await page.route('**/api/v1/employees?*', (route) => route.fulfill({ json: envelope(paged()) }))
  await page.route('**/api/v1/positions/dropdown', (route) => route.fulfill({ json: envelope([{ id, name: 'Private position' }]) }))
  await page.route('**/api/v1/positions?*', (route) => route.fulfill({ json: envelope(paged([{ id, name: 'Private position', salary: '12000000' }])) }))
  await page.route('**/api/v1/roles?*', (route) => route.fulfill({ json: envelope(paged([{ id, name: 'Private role' }])) }))
  await page.goto('/staff/employees')
  await page.getByRole('button', { name: 'Vai trò & Quyền hạn', exact: true }).click()
  await page.getByRole('button', { name: 'Sửa vai trò Private role' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await replace(base.filter((key) => key !== '/roles_update'))
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await replace(['/employees_read', '/positions_read', '/positions_update'])
  await expect(page.getByRole('button', { name: /Danh sách Nhân sự/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Private role', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /Vị trí Công việc/ }).click()
  await page.getByRole('row').filter({ hasText: 'Private position' }).getByRole('button').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await replace(['/employees_read'])
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Danh sách Nhân sự/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Private position', { exact: true })).toHaveCount(0)
  expect(unexpected).toEqual([])
})

test('settings closes a revoked create dialog and selects the remaining readable tab', async ({ page }) => {
  const { unexpected, replace } = await staff(page, ['/equipment_read', '/equipment_create', '/system-settings_read'])
  await page.route('**/api/v1/equipment?*', (route) => route.fulfill({ json: envelope(paged()) }))
  await page.route('**/api/v1/system-settings?*', (route) => route.fulfill({ json: envelope(paged()) }))
  await page.goto('/staff/settings')
  await page.getByRole('button', { name: 'Thêm thiết bị mới' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await replace(['/equipment_read', '/system-settings_read'])
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await replace(['/system-settings_read'])
  await expect(page.getByRole('button', { name: /Cấu hình Tham số Quán/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Trang thiết bị & Máy móc/ })).toHaveCount(0)
  await expect(page.getByText('Không tìm thấy cấu hình', { exact: false })).toBeVisible()
  expect(unexpected).toEqual([])
})

test('reconciliation follows URL navigation and falls back after partial revocation', async ({ page }) => {
  const { unexpected, replace } = await staff(page, ['/payment-reconciliation_read', '/reports_read'])
  await page.route('**/api/v1/payment-reconciliation/incidents?*', (route) => route.fulfill({ json: envelope(paged()) }))
  await page.route('**/api/v1/orders/takeaway/feedback/cases?*', (route) => route.fulfill({ json: envelope(paged()) }))
  await page.goto('/staff/reconciliation')
  await page.getByRole('tab', { name: 'Phản hồi khách', exact: true }).click()
  await expect(page).toHaveURL(/tab=feedback/)
  await page.goBack()
  await expect(page.getByRole('tab', { name: 'Sự cố thanh toán', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.goForward()
  await expect(page.getByRole('tab', { name: 'Phản hồi khách', exact: true })).toHaveAttribute('aria-selected', 'true')
  await replace(['/payment-reconciliation_read'])
  await expect(page.getByRole('tab', { name: 'Sự cố thanh toán', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tab', { name: 'Phản hồi khách', exact: true })).toHaveCount(0)
  expect(unexpected).toEqual([])
})

test('inventory and procurement tabs fall back without fetching revoked collections', async ({ page }) => {
  const { unexpected, replace, has } = await staff(page, ['/inventory_read', '/inventory_suppliers_read', '/inventory_purchase-receipts_read'])
  await page.route('**/api/v1/inventory/**', (route) => {
    const resource = new URL(route.request().url()).pathname.split('/')[4]!
    const required = ['suppliers', 'purchase-receipts', 'stocktakes'].includes(resource)
      ? `/inventory_${resource}_read` : '/inventory_read'
    if (!has(required)) {
      unexpected.push(route.request().url())
      return route.fulfill({ status: 403 })
    }
    return route.fulfill({ json: envelope(paged()) })
  })
  await page.goto('/staff/inventory')
  await page.getByRole('button', { name: 'Mua hàng & Kiểm kê', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Nhà cung cấp', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await replace(['/inventory_read', '/inventory_purchase-receipts_read'])
  await expect(page.getByRole('button', { name: 'Phiếu nhập', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await replace(['/inventory_suppliers_read'])
  await expect(page.getByRole('button', { name: 'Nhà cung cấp', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Kho hàng & Tồn kho', exact: true })).toHaveCount(0)
  await replace(['/inventory_read'])
  await expect(page.getByRole('button', { name: 'Kho hàng & Tồn kho', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Mua hàng & Kiểm kê', exact: true })).toHaveCount(0)
  expect(unexpected).toEqual([])
})
