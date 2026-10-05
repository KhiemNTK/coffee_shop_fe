import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const category = { id: '20000000-0000-4000-8000-000000000010', name: 'Original category' }
const station = { id: '20000000-0000-4000-8000-000000000020', name: 'Original bar', code: 'BAR', isActive: true }
const nextCategory = { id: '20000000-0000-4000-8000-000000000011', name: 'Category beyond 100' }
const nextStation = { ...station, id: '20000000-0000-4000-8000-000000000021', name: 'Station beyond 100' }
const item = { id: '30000000-0000-4000-8000-000000000001', name: 'Catalog drink', price: '35000.25', isAvailable: true,
  categoryId: category.id, category, kitchenStationId: station.id, kitchenStation: station }
const paged = (list: unknown[], page = 1, totalItems = list.length, size = 15) => ({ list, currentPage: page, totalItems, totalPages: Math.ceil(totalItems / size) })

async function open(page: Page, keys = ['/menu_read', '/menu_update', '/menu_create', '/kitchen-stations_read']) {
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: envelope(defaultMockAdminEmployee) }))
  await page.route('**/api/v1/auth/me/permissions', route => route.fulfill({ json: envelope(defaultMockAdminAuth(keys)) }))
  await page.route('**/api/v1/menu/items?**', route => route.fulfill({ json: envelope(paged([item])) }))
  await page.route('**/api/v1/menu/items/' + item.id, route => route.fulfill({ json: envelope(item) }))
  await page.route('**/api/v1/menu/categories?**', route => {
    const params = new URL(route.request().url()).searchParams
    return route.fulfill({ json: envelope(paged(params.get('page') === '3' ? [nextCategory] : [category], Number(params.get('page') ?? 1), 101, Number(params.get('itemPerPage')))) })
  })
  await page.route('**/api/v1/kitchen/stations?**', route => {
    const params = new URL(route.request().url()).searchParams
    expect(params.get('isActive')).toBe('true')
    return route.fulfill({ json: envelope(paged(params.get('page') === '6' ? [nextStation] : [station], Number(params.get('page') ?? 1), 101, 20)) })
  })
  await page.goto('/staff/menu')
  await expect(page.getByText(item.name, { exact: true })).toBeVisible()
}

for (const tab of ['categories', 'stock'] as const) {
  test(`${tab} failed reads are not empty or healthy stock and retry stays in scope`, async ({ page }) => {
    await open(page)
    let fail = true
    const url = tab === 'categories' ? 'menu/categories' : 'menu/items/stock-status'
    await page.route(`**/api/v1/${url}?**`, route => route.fulfill({ status: fail ? 503 : 200,
      json: envelope(fail ? {} : paged(tab === 'categories' ? [category] : [{ ...item, stockStatus: 'UNTRACKED', atRiskIngredients: [] }])) }))
    await page.getByRole('tab', { name: tab === 'categories' ? 'Danh mục' : 'Nguyên liệu theo món', exact: true }).click()
    const panel = page.getByRole('tabpanel')
    await expect(panel.getByRole('alert')).toBeVisible()
    await expect(page.getByText('Tất cả các món đều đủ nguyên liệu!')).toHaveCount(0)
    await expect(panel.getByText('Không có danh mục trong trang này.')).toHaveCount(0)
    await expect(panel.getByText('Không có món trong trang này.')).toHaveCount(0)
    fail = false
    await panel.getByRole('button', { name: tab === 'categories' ? 'Tải lại danh mục' : 'Tải lại tồn nguyên liệu' }).click()
    await expect(panel.getByRole('row').filter({ hasText: tab === 'categories' ? category.name : item.name })).toBeVisible()
  })
}

test('stock pagination does not hide untracked or sufficient recipes and search resets page', async ({ page }, info) => {
  await open(page)
  const reads: string[] = []
  await page.route('**/api/v1/menu/items/stock-status?**', route => {
    const params = new URL(route.request().url()).searchParams
    reads.push(route.request().url())
    return route.fulfill({ json: envelope(paged([{ ...item, name: params.get('page') === '2' ? 'Later drink' : item.name,
      stockStatus: params.get('page') === '2' ? 'INSUFFICIENT' : 'UNTRACKED', atRiskIngredients: params.get('page') === '2' ? [category] : [] }], Number(params.get('page')), 16)) })
  })
  await page.getByRole('tab', { name: 'Nguyên liệu theo món' }).click()
  const panel = page.getByRole('tabpanel')
  await expect(panel).toContainText('Chưa có công thức')
  await expect(panel.getByRole('heading', { name: 'Món theo bộ lọc (16)' })).toBeVisible()
  expect(await panel.getByRole('table').evaluate(table => table.getBoundingClientRect().width)).toBeGreaterThanOrEqual(720)
  await panel.getByRole('button', { name: 'Trang sau' }).click()
  await expect(panel).toContainText('Later drink')
  await expect(panel).toContainText('Không đủ một suất')
  const response = page.waitForResponse(r => r.url().includes('keyword=milk'))
  await panel.getByLabel('Tìm món theo nguyên liệu').fill('milk')
  await response
  expect(new URL(reads.at(-1)!).searchParams.get('page')).toBe('1')
  await page.screenshot({ path: info.outputPath('stock-scope.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
})

test('category management is paged, searchable and refresh never reads a disabled tab', async ({ page }) => {
  await open(page)
  let stockReads = 0
  await page.route('**/api/v1/menu/items/stock-status?**', route => { stockReads++; return route.abort() })
  await page.getByRole('tab', { name: 'Danh mục', exact: true }).click()
  const panel = page.getByRole('tabpanel')
  await panel.getByRole('button', { name: 'Trang sau' }).click()
  await expect(panel.getByText('2 / 7')).toBeVisible()
  const response = page.waitForResponse(r => r.url().includes('keyword=coffee') && r.url().includes('page=1'))
  await panel.getByLabel('Tìm danh mục', { exact: true }).fill('coffee')
  await response
  const refresh = page.waitForResponse(r => r.url().includes('/menu/categories?') && r.url().includes('keyword=coffee'))
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await refresh
  expect(stockReads).toBe(0)
})

for (const failure of ['http', 'malformed'] as const) {
  test(`item detail ${failure} fails closed and reloads before editing`, async ({ page }) => {
    await open(page)
    let fail = true
    let writes = 0
    await page.route('**/api/v1/menu/items/' + item.id, route => {
      if (route.request().method() !== 'GET') writes++
      return route.fulfill({ status: fail && failure === 'http' ? 503 : 200, json: envelope(fail ? {} : item) })
    })
    await page.getByTitle('Sửa thông tin món').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('alert')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Lưu thay đổi' })).toHaveCount(0)
    fail = false
    await dialog.getByRole('button', { name: 'Tải lại món' }).click()
    await expect(dialog.getByLabel('Tên món', { exact: true })).toHaveValue(item.name)
    expect(writes).toBe(0)
  })
}

test('editing with no station permission never reads stations or clears routing', async ({ page }) => {
  await open(page, ['/menu_read', '/menu_update'])
  let stationReads = 0
  let writes = 0
  await page.route('**/api/v1/kitchen/stations?**', route => { stationReads++; return route.abort() })
  await page.route('**/api/v1/menu/items/' + item.id, route => {
    if (route.request().method() === 'PATCH') { writes++; expect(route.request().postDataJSON()).toEqual({ name: 'Renamed drink' }) }
    return route.fulfill({ json: envelope(item) })
  })
  await page.getByTitle('Sửa thông tin món').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText(station.name)
  await dialog.getByLabel('Tên món', { exact: true }).fill('Renamed drink')
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(dialog).not.toBeVisible()
  expect(writes).toBe(1); expect(stationReads).toBe(0)
})

test('failed lookup preserves routing and category while patching only price', async ({ page }) => {
  await open(page)
  await page.route('**/api/v1/menu/categories?**', route => route.fulfill({ status: 503, json: envelope({}) }))
  await page.route('**/api/v1/kitchen/stations?**', route => route.fulfill({ status: 503, json: envelope({}) }))
  let writes = 0
  await page.route('**/api/v1/menu/items/' + item.id, route => {
    if (route.request().method() === 'PATCH') { writes++; expect(route.request().postDataJSON()).toEqual({ price: '40000.25' }) }
    return route.fulfill({ json: envelope(item) })
  })
  await page.getByTitle('Sửa thông tin món').click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Tìm danh mục món').fill('failed')
  await expect(dialog.getByRole('combobox', { name: 'Quầy chế biến phụ trách', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('combobox', { name: 'Quầy chế biến phụ trách', exact: true })).toHaveValue(station.id)
  await expect(dialog.getByRole('combobox', { name: 'Danh mục món', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('combobox', { name: 'Danh mục món', exact: true })).toHaveValue(category.id)
  await dialog.getByLabel('Đơn giá (VNĐ)').fill('40000.25')
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(dialog).not.toBeVisible(); expect(writes).toBe(1)
})

test('catalog pickers reach records beyond 100 and retain chosen records across searches', async ({ page }, info) => {
  await open(page)
  await page.getByTitle('Sửa thông tin món').click()
  const dialog = page.getByRole('dialog')
  const categories = dialog.getByRole('group', { name: 'Danh mục món', exact: true })
  const stations = dialog.getByRole('group', { name: 'Quầy chế biến phụ trách', exact: true })
  for (let i = 0; i < 2; i++) await categories.getByRole('button', { name: 'Trang sau' }).click()
  await categories.getByLabel('Danh mục món', { exact: true }).selectOption(nextCategory.id)
  for (let i = 0; i < 5; i++) await stations.getByRole('button', { name: 'Trang sau' }).click()
  await stations.getByLabel('Quầy chế biến phụ trách', { exact: true }).selectOption(nextStation.id)
  await categories.getByLabel('Tìm danh mục món').fill('Original')
  await stations.getByLabel('Tìm quầy chế biến phụ trách').fill('BAR')
  await expect(categories.getByLabel('Danh mục món', { exact: true })).toHaveValue(nextCategory.id)
  await expect(stations.getByLabel('Quầy chế biến phụ trách', { exact: true })).toHaveValue(nextStation.id)
  let writes = 0
  await page.route('**/api/v1/menu/items/' + item.id, route => {
    writes++; expect(route.request().postDataJSON()).toEqual({ categoryId: nextCategory.id, kitchenStationId: nextStation.id })
    return route.fulfill({ json: envelope(item) })
  })
  await page.screenshot({ path: info.outputPath('paged-catalog-picker.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(dialog).not.toBeVisible(); expect(writes).toBe(1)
})

test('uncertain item update freezes draft and reconciles through GET without another write', async ({ page }) => {
  await open(page)
  let writes = 0
  await page.route('**/api/v1/menu/items/' + item.id, route => {
    if (route.request().method() === 'PATCH') { writes++; return route.abort() }
    return route.fulfill({ json: envelope(item) })
  })
  await page.getByTitle('Sửa thông tin món').click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Tên món', { exact: true }).fill('Unknown write')
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(dialog.getByLabel('Tên món', { exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Đọc lại món' }).click()
  await expect(dialog.getByLabel('Tên món', { exact: true })).toHaveValue(item.name)
  await expect(dialog.getByLabel('Tên món', { exact: true })).toBeEnabled()
  expect(writes).toBe(1)
})

test('create cannot invent a category when lookup fails, and unknown POST cannot be retried blindly', async ({ page }) => {
  await open(page)
  let fail = true
  let writes = 0
  await page.route('**/api/v1/menu/categories?**', route => route.fulfill({ status: fail ? 503 : 200, json: envelope(fail ? {} : paged([category])) }))
  await page.route('**/api/v1/menu/items', route => { writes++; return route.abort() })
  await page.reload()
  await expect(page.getByText(item.name, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Tạo món mới', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Tạo món', exact: true })).toBeDisabled()
  fail = false
  await dialog.getByRole('button', { name: 'Tải lại danh mục món' }).click()
  await dialog.getByRole('combobox', { name: 'Danh mục món', exact: true }).selectOption(category.id)
  await dialog.getByLabel('Tên món', { exact: true }).fill('New drink')
  await dialog.getByLabel('Đơn giá (VNĐ)').fill('35000.25')
  await dialog.getByRole('button', { name: 'Tạo món', exact: true }).click()
  await expect(dialog.getByLabel('Tên món', { exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Tạo món', exact: true })).toHaveCount(0)
  expect(writes).toBe(1)
})

test('fresh detail wins over the list, unchanged save writes nothing and clearing routing is explicit', async ({ page }) => {
  await open(page)
  let writes = 0
  await page.route('**/api/v1/menu/items/' + item.id, route => {
    if (route.request().method() === 'PATCH') { writes++; expect(route.request().postDataJSON()).toEqual({ kitchenStationId: null }) }
    return route.fulfill({ json: envelope({ ...item, name: 'Fresh catalog name' }) })
  })
  await page.getByTitle('Sửa thông tin món').click()
  let dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Tên món', { exact: true })).toHaveValue('Fresh catalog name')
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(dialog).not.toBeVisible(); expect(writes).toBe(0)
  await page.getByTitle('Sửa thông tin món').click()
  dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: 'Quầy chế biến phụ trách', exact: true }).selectOption('')
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(dialog).not.toBeVisible(); expect(writes).toBe(1)
})

test('invalid price cannot reach API and the validation summary receives focus', async ({ page }) => {
  await open(page)
  let writes = 0
  await page.route('**/api/v1/menu/items/' + item.id, route => {
    if (route.request().method() === 'PATCH') { writes++; expect(route.request().postDataJSON()).toEqual({ price: '40000.25' }) }
    return route.fulfill({ json: envelope(item) })
  })
  await page.getByTitle('Sửa thông tin món').click()
  const dialog = page.getByRole('dialog')
  for (const price of ['-1', '1e3', '1.001']) {
    await dialog.getByLabel('Đơn giá (VNĐ)').fill(price)
    await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click()
    await expect(dialog.getByRole('alert')).toBeFocused()
    expect(writes).toBe(0)
  }
  await dialog.getByLabel('Đơn giá (VNĐ)').fill('40000.25')
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(dialog).not.toBeVisible(); expect(writes).toBe(1)
})

test('picker navigation stays inside the form without submitting even for cached pages', async ({ page }) => {
  await open(page)
  let writes = 0
  await page.route('**/api/v1/menu/items/' + item.id, route => {
    if (route.request().method() !== 'GET') writes++
    return route.fulfill({ json: envelope(item) })
  })
  await page.getByTitle('Sửa thông tin món').click()
  const dialog = page.getByRole('dialog')
  const picker = dialog.getByRole('group', { name: 'Danh mục món', exact: true })
  const next = picker.getByRole('button', { name: 'Trang sau' })
  await expect(next).toBeEnabled()
  expect(await next.evaluate(button => (button as HTMLButtonElement).type)).toBe('button')
  await next.click()
  await expect(picker.getByText('2 / 3')).toBeVisible()
  await picker.getByRole('button', { name: 'Trang trước' }).click()
  await expect(picker.getByText('1 / 3')).toBeVisible()
  await next.click()
  await expect(picker.getByText('2 / 3')).toBeVisible()
  await expect(dialog).toBeVisible(); expect(writes).toBe(0)
})
