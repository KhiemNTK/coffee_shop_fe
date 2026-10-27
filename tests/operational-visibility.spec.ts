import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const id = '92000000-0000-4000-8000-000000000001'
const itemId = '92000000-0000-4000-8000-000000000002'
const paged = (list: unknown[]) => ({
  list,
  currentPage: 1,
  totalPages: 1,
  totalItems: list.length,
})
async function staff(page: Page, keys: string[]) {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminEmployee) }),
  )
  await page.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminAuth(keys)) }),
  )
}

test('stock visibility distinguishes reservations and prevents exporting held ingredients', async ({
  page,
}, info) => {
  await staff(page, ['/inventory_read', '/inventory_stock_adjust'])
  await page.route('**/api/v1/inventory/**', (route) => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill({
      json: envelope(
        paged(
          path.endsWith('/items')
            ? [
                {
                  id: itemId,
                  name: 'Reserved beans',
                  stock: '10.1234',
                  reservedStock: '8.1233',
                  categoryId: id,
                  unitId: id,
                  unit: { id, name: 'kg' },
                },
              ]
            : [],
        ),
      ),
    })
  })
  let exports = 0
  await page.route('**/api/v1/inventory/items/*/export', (route) => {
    exports++
    return route.abort()
  })
  await page.goto('/staff/inventory')
  const row = page.getByRole('row').filter({ hasText: 'Reserved beans' })
  await expect(row).toContainText('10,1234 kg')
  await expect(row).toContainText('8,1233 kg')
  await expect(row).toContainText('2,0001 kg')
  await row.getByRole('button', { name: 'Xuất', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Tồn khả dụng lúc mở phiếu: 2,0001 kg')
  await dialog.getByLabel('Số lượng (kg)', { exact: true }).fill('2.0002')
  await dialog.getByLabel('Lý do / Nguồn gốc', { exact: true }).fill('Xuất nguyên liệu cho ca')
  await dialog.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }).click()
  await expect(dialog).toContainText('Số lượng xuất vượt tồn khả dụng')
  expect(exports).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('reserved-stock.png'), fullPage: true })
})

test('scheduled KDS preview is URL-scoped, paginated correctly and cannot start cooking early', async ({
  page,
}, info) => {
  await staff(page, ['/kitchen-tickets_read', '/orders_items_update-status'])
  await page.route('**/api/v1/kitchen/events', (route) => route.abort())
  await page.route('**/api/v1/kitchen/workload', (route) =>
    route.fulfill({
      json: envelope({ asOf: new Date().toISOString(), dueSoonWindowSeconds: 60, stations: [] }),
    }),
  )
  const queries: URLSearchParams[] = []
  await page.route('**/api/v1/kitchen/tickets?*', (route) => {
    const params = new URL(route.request().url()).searchParams
    queries.push(params)
    return route.fulfill({
      json: envelope(
        paged(
          params.get('includeScheduled') === 'true'
            ? [
                {
                  id,
                  sequence: 10,
                  ticketNumber: 'BAR-10',
                  state: 'PENDING',
                  isOverdue: false,
                  isScheduled: true,
                  availableAt: new Date(Date.now() + 3600000).toISOString(),
                  createdAt: new Date().toISOString(),
                  dueAt: new Date(Date.now() + 3900000).toISOString(),
                  station: { id, code: 'BAR', name: 'Bar' },
                  table: null,
                  orderSessionId: id,
                  items: [
                    {
                      id: itemId,
                      orderItemId: itemId,
                      itemName: 'Scheduled latte',
                      quantity: 1,
                      serveStatus: 'PENDING',
                      selectedOptions: [],
                      currentTable: null,
                    },
                  ],
                },
              ]
            : [],
        ),
      ),
    })
  })
  let writes = 0
  await page.route('**/api/v1/orders/items/*/status', (route) => {
    writes++
    return route.abort()
  })
  await page.goto('/staff/kitchen?page=2')
  const toggle = page.getByRole('checkbox', { name: 'Xem cả đơn hẹn giờ', exact: true })
  await expect(toggle).not.toBeChecked()
  await toggle.check()
  await expect(page).toHaveURL(/includeScheduled=true/)
  const preview = page.getByRole('region', { name: 'Hẹn giờ · Chưa đến giờ chế biến', exact: true })
  await expect(preview).toContainText('Scheduled latte')
  await expect(preview.getByRole('button', { name: 'Bắt đầu làm', exact: true })).toBeDisabled()
  await expect(preview).toContainText('Bắt đầu lúc')
  expect(queries.at(-1)?.get('page')).toBe('1')
  expect(writes).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('scheduled-kds.png'), fullPage: true })
  await toggle.uncheck()
  await expect(preview).toHaveCount(0)
})
