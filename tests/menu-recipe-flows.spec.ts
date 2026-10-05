import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const menu = { id: '30000000-0000-4000-8000-000000000001', name: 'Fixture drink', price: '35000', isAvailable: true }
const unit = { id: '40000000-0000-4000-8000-000000000001', name: 'kg' }
const bean = { id: '50000000-0000-4000-8000-000000000001', name: 'Fixture beans', stock: '1.2345', unit, categoryId: 'category', unitId: unit.id }
const milk = { ...bean, id: '50000000-0000-4000-8000-000000000002', name: 'Fixture milk' }
const recipe = { id: menu.id, name: menu.name, ingredients: [{ inventoryItemId: bean.id, quantity: '0.1234', inventoryItem: bean }] }
const options = { id: menu.id, name: menu.name, optionGroups: [{ name: 'Topping', minSelected: 0, maxSelected: 1,
  options: [{ name: 'Extra shot', priceDelta: '1500.25', ingredients: [{ inventoryItemId: bean.id, quantity: '0.0001', inventoryItem: bean }] }] }] }
const permissions = ['/menu_read', '/menu_update', '/inventory_read']
const paginated = (list: unknown[], currentPage = 1, totalPages = 1) => ({ list, currentPage, totalPages, totalItems: totalPages === 1 ? list.length : 51 })

async function openMenu(page: Page, keys = permissions) {
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: envelope(defaultMockAdminEmployee) }))
  await page.route('**/api/v1/auth/me/permissions', route => route.fulfill({ json: envelope(defaultMockAdminAuth(keys)) }))
  await page.route('**/api/v1/menu/items?**', route => route.fulfill({ json: envelope(paginated([menu])) }))
  await page.route('**/api/v1/menu/categories?**', route => route.fulfill({ json: envelope(paginated([])) }))
  await page.route('**/api/v1/menu/items/*/recipe', route => route.fulfill({ json: envelope(recipe) }))
  await page.route('**/api/v1/menu/items/*/options', route => route.fulfill({ json: envelope(options) }))
  await page.route('**/api/v1/inventory/items?**', route => {
    const params = new URL(route.request().url()).searchParams
    return route.fulfill({ json: envelope(paginated(params.get('keyword') === 'none' ? [] : params.get('page') === '2' ? [milk] : [bean], Number(params.get('page') ?? 1), 2)) })
  })
  await page.goto('/staff/menu')
  await expect(page.getByText(menu.name, { exact: true })).toBeVisible()
}

for (const kind of ['recipe', 'options'] as const) {
  const title = kind === 'recipe' ? 'Công thức nguyên liệu' : 'Tùy chọn món (Size, Topping...)'
  const save = kind === 'recipe' ? 'Lưu công thức' : 'Lưu tùy chọn'
  const reload = kind === 'recipe' ? 'Đọc lại công thức' : 'Đọc lại tùy chọn'
  const detail = kind === 'recipe' ? recipe : options
  for (const failure of ['http', 'malformed'] as const) {
    test(`${kind} read failure ${failure} cannot replace configuration with an empty array`, async ({ page }) => {
      await openMenu(page)
      let allowRead = false
      let writes = 0
      await page.route(`**/api/v1/menu/items/${menu.id}/${kind}`, route => {
        if (route.request().method() === 'PUT') { writes++; return route.fulfill({ json: envelope(detail) }) }
        return !allowRead ? route.fulfill({ status: failure === 'http' ? 503 : 200, json: envelope({}) }) : route.fulfill({ json: envelope(detail) })
      })
      await page.getByTitle(title).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByRole('alert')).toBeVisible()
      await expect(dialog.getByRole('button', { name: save, exact: true })).toHaveCount(0)
      allowRead = true
      await dialog.getByRole('button', { name: kind === 'recipe' ? 'Tải lại công thức' : 'Tải lại tùy chọn' }).click()
      await expect(dialog.getByRole('button', { name: save, exact: true })).toBeEnabled()
      expect(writes).toBe(0)
    })
  }
  test(`${kind} is read-only without menu update and never queries inventory without permission`, async ({ page }) => {
    await openMenu(page, ['/menu_read'])
    let inventoryReads = 0
    await page.route('**/api/v1/inventory/items?**', route => { inventoryReads++; return route.abort() })
    await page.getByTitle(title).click()
    const dialog = page.getByRole('dialog')
    if (kind === 'options') await dialog.getByRole('button', { name: 'Định lượng tùy chọn Extra shot' }).click()
    await expect(dialog).toContainText(bean.name)
    await expect(dialog.getByRole('button', { name: save, exact: true })).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: /Xóa nguyên liệu/ })).toHaveCount(0)
    expect(inventoryReads).toBe(0)
  })
  test(`${kind} uncertain replacement freezes editing and recovers through a read, not another PUT`, async ({ page }) => {
    await openMenu(page)
    let writes = 0
    await page.route(`**/api/v1/menu/items/${menu.id}/${kind}`, route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: envelope(detail) })
      writes++
      return route.abort()
    })
    await page.getByTitle(title).click()
    const dialog = page.getByRole('dialog')
    const input = kind === 'recipe' ? dialog.getByLabel('Định lượng Fixture beans', { exact: true }) : dialog.getByLabel('Giá cộng thêm', { exact: true })
    await expect(input).toBeEnabled()
    await input.fill(kind === 'recipe' ? '0.2345' : '2500.25')
    await dialog.getByRole('button', { name: save, exact: true }).click()
    await expect(input).toBeDisabled()
    await dialog.getByRole('button', { name: reload, exact: true }).click()
    await expect(input).toHaveValue(kind === 'recipe' ? '0.1234' : '1500.25')
    await expect(input).toBeEnabled()
    expect(writes).toBe(1)
  })
}

test('recipe saves exact four-decimal quantities and keeps draft edits on window focus', async ({ page }, info) => {
  await openMenu(page)
  let writes = 0
  await page.route(`**/api/v1/menu/items/${menu.id}/recipe`, route => {
    if (route.request().method() === 'PUT') { writes++; expect(route.request().postDataJSON()).toEqual({ ingredients: [{ inventoryItemId: bean.id, quantity: '0.2345' }] }) }
    return route.fulfill({ json: envelope(recipe) })
  })
  await page.getByTitle('Công thức nguyên liệu').click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Định lượng Fixture beans', { exact: true }).fill('0.2345')
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(dialog.getByLabel('Định lượng Fixture beans', { exact: true })).toHaveValue('0.2345')
  await page.screenshot({ path: info.outputPath('recipe-editor.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  await dialog.getByRole('button', { name: 'Lưu công thức', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(writes).toBe(1)
})

test('recipe picker paginates and preserves the selected ingredient across a search', async ({ page }) => {
  await openMenu(page)
  await page.getByTitle('Công thức nguyên liệu').click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Trang sau' }).click()
  await dialog.getByLabel('Nguyên liệu kho', { exact: true }).selectOption(milk.id)
  const search = page.waitForResponse(response => response.url().includes('keyword=none'))
  await dialog.getByLabel('Tìm nguyên liệu công thức').fill('none')
  await search
  await expect(dialog.getByLabel('Nguyên liệu kho', { exact: true })).toHaveValue(milk.id)
  await dialog.getByLabel('Định lượng thêm', { exact: true }).fill('0.0001')
  await dialog.getByRole('button', { name: 'Thêm nguyên liệu', exact: true }).click()
  await expect(dialog.getByLabel('Định lượng Fixture milk', { exact: true })).toHaveValue('0.0001')
})

test('saving options preserves and edits topping ingredients instead of deleting them', async ({ page }, info) => {
  await openMenu(page)
  let writes = 0
  await page.route(`**/api/v1/menu/items/${menu.id}/options`, route => {
    if (route.request().method() === 'PUT') {
      writes++
      expect(route.request().postDataJSON()).toEqual({ groups: [{ name: 'Topping', minSelected: 0, maxSelected: 1, options: [{ name: 'Extra shot', priceDelta: '2500.25', ingredients: [{ inventoryItemId: bean.id, quantity: '0.0002' }] }] }] })
    }
    return route.fulfill({ json: envelope(options) })
  })
  await page.getByTitle('Tùy chọn món (Size, Topping...)').click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Định lượng tùy chọn Extra shot' }).click()
  await dialog.getByLabel('Định lượng Fixture beans', { exact: true }).fill('0.0002')
  await dialog.getByLabel('Giá cộng thêm', { exact: true }).fill('2500.25')
  await page.screenshot({ path: info.outputPath('option-ingredients.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  await dialog.getByRole('button', { name: 'Lưu tùy chọn', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(writes).toBe(1)
})

test('clearing an existing recipe requires explicit confirmation', async ({ page }) => {
  await openMenu(page)
  let writes = 0
  await page.route(`**/api/v1/menu/items/${menu.id}/recipe`, route => {
    if (route.request().method() === 'PUT') { writes++; expect(route.request().postDataJSON()).toEqual({ ingredients: [] }) }
    return route.fulfill({ json: envelope(route.request().method() === 'GET' ? recipe : { ...recipe, ingredients: [] }) })
  })
  await page.getByTitle('Công thức nguyên liệu').click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Xóa nguyên liệu Fixture beans' }).click()
  await dialog.getByRole('button', { name: 'Lưu công thức', exact: true }).click()
  expect(writes).toBe(0)
  await dialog.getByRole('checkbox', { name: 'Xác nhận bỏ toàn bộ công thức' }).check()
  await dialog.getByRole('button', { name: 'Lưu công thức', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(writes).toBe(1)
})
