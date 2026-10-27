import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const id = '71000000-0000-4000-8000-000000000001'
const itemId = '71000000-0000-4000-8000-000000000002'
const paged = (list: unknown[]) => ({ list, totalItems: list.length, totalPages: list.length ? 1 : 0, currentPage: 1 })

async function kitchen(page: Page, ready = false) {
  await page.route('**/api/v1/**', route => route.fulfill({ status: 503 }))
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: envelope(defaultMockAdminEmployee) }))
  await page.route('**/api/v1/auth/me/permissions', route => route.fulfill({ json: envelope(defaultMockAdminAuth(['/kitchen-tickets_read', '/orders_items_update-status'])) }))
  await page.route('**/api/v1/kitchen/events', route => route.abort())
  await page.route('**/api/v1/kitchen/workload', route => route.fulfill({ json: envelope({ asOf: new Date().toISOString(), dueSoonWindowSeconds: 60, stations: [] }) }))
  const ticket = {
    id, sequence: 1, ticketNumber: 'BAR-1', state: ready ? 'COMPLETED' : 'PENDING', isOverdue: false,
    createdAt: new Date().toISOString(), dueAt: new Date(Date.now() + 900_000).toISOString(),
    station: { id, code: 'BAR', name: 'Pha chế' }, orderSessionId: id, table: null,
    items: [{ id: itemId, orderItemId: itemId, itemName: 'Reliability latte', quantity: 1, selectedOptions: [], serveStatus: ready ? 'READY' : 'PENDING', currentTable: null }],
  }
  await page.route('**/api/v1/kitchen/tickets?*', route => route.fulfill({ json: envelope(paged([ticket])) }))
  await page.goto('/staff/kitchen')
  await expect(page.getByText('1x Reliability latte', { exact: true })).toBeVisible()
  return ticket
}

test('READY tickets render in the handoff lane without including historical tickets', async ({ page }) => {
  await kitchen(page, true)
  await expect(page.getByRole('region', { name: 'Sẵn sàng bàn giao', exact: true })).toContainText('Reliability latte')
  await expect(page.getByRole('checkbox', { name: 'Xem cả món đã xong', exact: true })).not.toBeChecked()
})

test('failed KDS refresh keeps read-only tickets, recovers, then hides them on permission denial', async ({ page }) => {
  const ticket = await kitchen(page)
  let status = 503
  let writes = 0
  await page.route('**/api/v1/orders/items/*/status', route => { writes++; return route.abort() })
  await page.route('**/api/v1/kitchen/tickets?*', route => status === 200
    ? route.fulfill({ json: envelope(paged([ticket])) })
    : route.fulfill({ status, json: { code: status === 403 ? 'FORBIDDEN' : 'SERVICE_UNAVAILABLE', message: 'Refresh unavailable' } }))
  await page.getByRole('button', { name: 'Làm mới màn hình bếp', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('chỉ để đối chiếu')
  await expect(page.getByText('1x Reliability latte', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Bắt đầu làm', exact: true })).toBeDisabled()
  expect(writes).toBe(0)
  status = 200
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Bắt đầu làm', exact: true })).toBeEnabled()
  status = 403
  await page.getByRole('button', { name: 'Làm mới màn hình bếp', exact: true }).click()
  await expect(page.getByText('1x Reliability latte', { exact: true })).toHaveCount(0)
  expect(writes).toBe(0)
})

test('KDS dark mode lanes stay readable on desktop and mobile', async ({ page }, info) => {
  await kitchen(page)
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  const lane = page.getByRole('region', { name: 'Đang chế biến', exact: true })
  const colors = await lane.evaluate(node => ({ color: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor }))
  expect(colors.background).not.toContain('240, 249, 255')
  expect(colors.color).not.toBe(colors.background)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('kitchen-dark.png'), fullPage: true })
})

test('all public category controls clear both search text and keyword while preserving sorting', async ({ page }, info) => {
  const category = { id, name: 'Trà' }
  let latest = new URLSearchParams()
  await page.route('**/api/v1/**', route => route.fulfill({ status: 503 }))
  await page.route('**/api/v1/customers/me', route => route.fulfill({ status: 401 }))
  await page.route('**/api/v1/menu/public/categories', route => route.fulfill({ json: envelope([category]) }))
  await page.route('**/api/v1/menu/public/items?*', route => {
    latest = new URL(route.request().url()).searchParams
    return route.fulfill({ json: envelope(paged([{ id: itemId, name: latest.has('keyword') ? 'Search result latte' : 'Menu tea', price: '35000', category, optionGroups: [] }])) })
  })
  await page.goto('/')
  const search = page.getByRole('searchbox')
  await page.getByRole('combobox', { name: 'Sắp xếp', exact: true }).selectOption('price-desc')
  const controls = [page.getByRole('tab', { name: 'Trà', exact: true }),
    ...(info.project.name === 'desktop' ? [page.locator('aside').getByRole('button', { name: 'Trà', exact: true })] : []),
    page.getByRole('button', { name: 'Khám phá danh mục Trà', exact: true })]
  for (const [index, control] of controls.entries()) {
    await search.fill('latte')
    await page.getByRole('search').getByRole('button', { name: 'Tìm', exact: true }).click()
    await expect.poll(() => latest.get('keyword')).toBe('latte')
    await expect(page.getByRole('region', { name: 'Danh sách món' }).getByRole('heading')).toHaveText('Search result latte')
    await control.click()
    await expect(search).toHaveValue('')
    await expect(page.getByRole('region', { name: 'Danh sách món' }).getByRole('heading')).toHaveText('Menu tea')
    if (index === 0) {
      expect(latest.get('keyword')).toBe(null)
      expect(latest.get('categoryId')).toBe(id)
      expect(latest.get('sortOrder')).toBe('desc')
      expect(latest.get('page')).toBe('1')
    }
    await expect(page.getByRole('combobox', { name: 'Sắp xếp', exact: true })).toHaveValue('price-desc')
  }
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await search.fill('Trà')
  const styles = await search.evaluate(node => ({ color: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor }))
  expect(styles.color).not.toBe(styles.background)
  await search.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('menu-dark.png') })
})
