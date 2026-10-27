import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope, onlineAvailability } from './helpers.js'

const id = (n: number) => `98000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const category = { id: id(1), name: 'Cà phê' }
const timestamp = '2026-10-26T01:00:00Z'
const item = {
  id: id(2), name: 'Safety coffee', price: '35000', category,
  optionGroups: [
    { id: id(3), name: 'Optional shot', minSelected: 0, maxSelected: 1,
      options: [{ id: id(4), name: 'Extra espresso', priceDelta: '10000' }] },
    { id: id(5), name: 'Required size', minSelected: 1, maxSelected: 1,
      options: [{ id: id(6), name: 'Regular', priceDelta: '0' }] },
  ],
}
const paged = (list: unknown[]) => ({ list, totalItems: list.length, totalPages: list.length ? 1 : 0, currentPage: 1 })

test('failed setting deletion is an accessible error, successful deletion is a status', async ({ page }, info) => {
  await mockApi(page, ['/system-settings_read', '/system-settings_delete'])
  let failed = true
  await page.route('**/api/v1/system-settings**', route => {
    if (route.request().method() === 'DELETE') return route.fulfill(failed
      ? { status: 503, json: { code: 'SERVICE_UNAVAILABLE' } }
      : { json: envelope({ success: true, key: 'store.audit', version: 1 }) })
    return route.fulfill({ json: envelope(paged([{ id: id(8), key: 'store.audit', value: 'value', valueType: 'STRING', version: 1 }])) })
  })
  page.on('dialog', dialog => dialog.accept())
  await page.goto('/staff/settings')
  await page.getByTitle('Xóa cấu hình', { exact: true }).click()
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Dịch vụ tạm thời không khả dụng')
  await expect(alert).toHaveClass(/text-destructive/)
  await expect(alert.locator('svg.lucide-circle-check-big')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('settings-delete-error.png'), fullPage: true })
  failed = false
  await page.getByTitle('Xóa cấu hình', { exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Đã xóa cấu hình' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('catalog keeps only the compact category filter on mobile', async ({ page }, info) => {
  await mockApi(page)
  const categories = ['Cà phê', 'Trà', 'Trà sữa', 'Trà trái cây', 'Matcha', 'Bánh ngọt'].map((name, i) => ({ id: id(20 + i), name }))
  await page.route('**/api/v1/menu/public/categories', route => route.fulfill({ json: envelope(categories) }))
  await page.goto('/menu')
  await expect(page.getByRole('heading', { name: item.name, exact: true })).toBeVisible()
  const sidebar = page.locator('aside').filter({ has: page.getByRole('navigation', { name: 'Danh mục món', exact: true }) })
  if (info.project.name === 'mobile') {
    await expect(sidebar).toBeHidden()
    await page.evaluate(() => scrollTo(0, 0))
    const title = await page.getByRole('heading', { name: item.name, exact: true }).boundingBox()
    expect(title!.y).toBeLessThan(844)
  } else await expect(sidebar).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Trà', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('menu-category-layout.png'), fullPage: true })
})

async function mockApi(page: Page, permissions: string[] = []) {
  await page.route('**/api/v1/**', route => route.fulfill({ status: 503, json: { code: 'SERVICE_UNAVAILABLE' } }))
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: envelope(defaultMockAdminEmployee) }))
  await page.route('**/api/v1/auth/me/permissions', route => route.fulfill({ json: envelope(defaultMockAdminAuth(permissions)) }))
  await page.route('**/api/v1/customers/me', route => route.fulfill({ status: 401 }))
  await page.route('**/api/v1/menu/public/store', route => route.fulfill({ json: envelope({ name: 'Coffee Homes', address: null, phone: null }) }))
  await page.route('**/api/v1/menu/public/categories', route => route.fulfill({ json: envelope([category]) }))
  await page.route('**/api/v1/menu/public/items?*', route => route.fulfill({ json: envelope(paged([item])) }))
  await page.route('**/api/v1/online-orders/availability', route => route.fulfill({ json: envelope(onlineAvailability) }))
}

test('workdesk never claims healthy while loading or after a failed refresh', async ({ page }, info) => {
  await mockApi(page, ['/kitchen-tickets_read'])
  let failed = false
  let release = () => {}
  const ready = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/v1/kitchen/workload', async route => {
    await ready
    return route.fulfill(failed ? { status: 503, json: { code: 'SERVICE_UNAVAILABLE' } }
      : { json: envelope({ asOf: timestamp, dueSoonWindowSeconds: 300, stations: [] }) })
  })
  await page.goto('/staff')
  await expect(page.getByText('Đang kiểm tra trạng thái vận hành…', { exact: true })).toBeVisible()
  await expect(page.getByText('Mọi vận hành đang trơn tru', { exact: true })).toHaveCount(0)
  release()
  await expect(page.getByText('Mọi vận hành đang trơn tru', { exact: true })).toBeVisible()
  failed = true
  await page.getByTitle('Làm mới toàn bộ chỉ số vận hành', { exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Chưa thể xác nhận trạng thái vận hành' })).toBeVisible()
  await expect(page.getByText('Mọi vận hành đang trơn tru', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Không có trạm pha chế nào đang hoạt động.', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('workdesk-read-failure.png'), fullPage: true })
})

test('workdesk does not describe permission-hidden data as healthy', async ({ page }) => {
  await mockApi(page)
  await page.goto('/staff')
  await expect(page.getByText('Bạn chưa có quyền xem dữ liệu tổng quan vận hành.', { exact: true })).toBeVisible()
  await expect(page.getByText('Mọi vận hành đang trơn tru', { exact: true })).toHaveCount(0)
})

for (const flow of ['menu', 'order', 'pos'] as const) {
  test(`${flow} can remove optional paid extras without clearing required choices`, async ({ page }, info) => {
    await mockApi(page, ['/orders_sessions_read', '/orders_items_create'])
    if (flow === 'pos') {
      await page.route(`**/api/v1/orders/sessions/${id(7)}`, route => route.fulfill({ json: envelope({
        id: id(7), sessionStatus: 'ACTIVE', createdAt: timestamp, table: null,
        employee: defaultMockAdminEmployee, orderItems: [],
      }) }))
    }
    await page.goto(flow === 'pos' ? `/staff/pos/sessions/${id(7)}` : `/${flow}`)
    if (flow === 'pos') await page.getByRole('button', { name: /Safety coffee/ }).click()
    else await page.getByRole('button', { name: flow === 'menu' ? 'Tùy chọn' : 'Chọn món', exact: true }).click()
    const dialog = page.getByRole('dialog')
    const extra = dialog.getByRole(flow === 'pos' ? 'radio' : 'button', { name: /Extra espresso/ })
    const none = dialog.getByRole(flow === 'pos' ? 'radio' : 'button', { name: 'Không thêm', exact: true })
    await expect(none).toHaveCount(1)
    await extra.click()
    if (flow === 'pos') await expect(extra).toBeChecked()
    else await expect(extra).toHaveAttribute('aria-pressed', 'true')
    await none.click()
    if (flow === 'pos') {
      await expect(extra).not.toBeChecked()
      await expect(none).toBeChecked()
      await dialog.getByRole('radio', { name: /Regular/ }).check()
      await expect(none).toBeChecked()
    } else {
      await expect(extra).toHaveAttribute('aria-pressed', 'false')
      await expect(none).toHaveAttribute('aria-pressed', 'true')
      await expect(dialog.getByRole('button', { name: 'Regular', exact: true })).toHaveAttribute('aria-pressed', 'true')
    }
    await expect(dialog.getByText('35.000 ₫', { exact: true }).first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`${flow}-optional-extra.png`) })
  })
}
