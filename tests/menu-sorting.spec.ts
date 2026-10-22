import { expect, test } from '@playwright/test'
import { envelope } from './helpers.js'

const category = { id: '10000000-0000-4000-8000-000000000001', name: 'Coffee' }
const coffee = {
  id: '20000000-0000-4000-8000-000000000001',
  name: 'Coffee',
  price: '40000',
  category,
  optionGroups: [],
}
const tea = { ...coffee, id: '20000000-0000-4000-8000-000000000002', name: 'Tea', price: '30000' }

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', (route) => route.fulfill({ status: 503 }))
  await page.route('**/api/v1/customers/me', (route) => route.fulfill({ status: 401 }))
  await page.route('**/api/v1/menu/public/categories', (route) =>
    route.fulfill({ json: envelope([category]) }),
  )
})

test('menu sorting reaches the server, resets pagination and survives filtering', async ({ page }, testInfo) => {
  let latest: URLSearchParams
  await page.route('**/api/v1/menu/public/items?*', (route) => {
    latest = new URL(route.request().url()).searchParams
    return route.fulfill({ json: envelope({
      list: latest.get('sortBy') === 'price' && latest.get('sortOrder') === 'asc' ? [tea, coffee] : [coffee, tea],
      totalItems: 13,
      totalPages: 2,
      currentPage: Number(latest.get('page')),
    }) })
  })
  await page.goto('/')
  const catalog = page.getByRole('region', { name: 'Danh sách món' })
  const sort = page.getByRole('combobox', { name: 'Sắp xếp', exact: true })
  const names = catalog.getByRole('heading')
  await expect(names).toHaveText(['Coffee', 'Tea'])
  await expect(sort).toHaveValue('name-asc')
  await page.getByRole('button', { name: 'Trang sau' }).click()
  await expect(page.getByText('Trang 2 / 2')).toBeVisible()

  await sort.selectOption('price-asc')
  await expect(names).toHaveText(['Tea', 'Coffee'])
  await expect(page.getByText('Trang 1 / 2')).toBeVisible()
  expect(latest!.get('sortBy')).toBe('price')
  expect(latest!.get('sortOrder')).toBe('asc')
  expect(latest!.get('page')).toBe('1')
  await sort.scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await catalog.locator('p.tabular-nums').first().evaluate((node) =>
    node.getBoundingClientRect().height <= Number.parseFloat(getComputedStyle(node).lineHeight) + 1,
  )).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('menu-sorting.png') })

  await page.getByRole('button', { name: 'Trang sau' }).click()
  await expect(page.getByText('Trang 2 / 2')).toBeVisible()
  expect(latest!.get('sortOrder')).toBe('asc')
  await sort.selectOption('price-desc')
  await expect(names).toHaveText(['Coffee', 'Tea'])
  await expect(page.getByText('Trang 1 / 2')).toBeVisible()
  expect(latest!.get('sortOrder')).toBe('desc')

  await page.getByRole('tab', { name: category.name, exact: true }).click()
  await expect.poll(() => latest?.get('categoryId')).toBe(category.id)
  expect(latest!.get('sortBy')).toBe('price')
  expect(latest!.get('sortOrder')).toBe('desc')
  await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Xóa bộ lọc', exact: true })).toHaveCount(0)
  await expect(sort).toHaveValue('price-desc')
  await page.getByRole('button', { name: 'Trang sau' }).click()
  await expect(page.getByText('Trang 2 / 2')).toBeVisible()
  expect(latest!.get('categoryId')).toBe(null)
  expect(latest!.get('sortBy')).toBe('price')
  expect(latest!.get('sortOrder')).toBe('desc')
  await sort.selectOption('name-asc')
  await expect(sort).toHaveValue('name-asc')
  await expect(names).toHaveText(['Coffee', 'Tea'])
  await expect(sort.getByRole('option')).toHaveCount(3)
})

test('a failed sort request shows an error instead of an empty catalog', async ({ page }) => {
  await page.route('**/api/v1/menu/public/items?*', (route) => {
    const query = new URL(route.request().url()).searchParams
    return query.get('sortBy') === 'price'
      ? route.fulfill({ status: 503 })
      : route.fulfill({ json: envelope({ list: [coffee], totalItems: 1, totalPages: 1, currentPage: 1 }) })
  })
  await page.goto('/')
  const catalog = page.getByRole('region', { name: 'Danh sách món' })
  const sort = page.getByRole('combobox', { name: 'Sắp xếp', exact: true })
  await expect(catalog.getByRole('heading')).toHaveText('Coffee')
  await sort.selectOption('price-desc')
  await expect(catalog.getByRole('alert')).toContainText('Chưa tải được thực đơn')
  await expect(sort).toHaveValue('price-desc')
  await sort.selectOption('name-asc')
  await expect(catalog.getByRole('heading')).toHaveText('Coffee')
})

test('menu sorting has translated labels in English', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('coffee_shop_language', 'en'))
  await page.route('**/api/v1/menu/public/items?*', (route) =>
    route.fulfill({ json: envelope({ list: [coffee], totalItems: 1, totalPages: 1, currentPage: 1 }) }),
  )
  await page.goto('/')
  const sort = page.getByRole('combobox', { name: 'Sort by', exact: true })
  await expect(sort).toBeVisible()
  await expect(sort.getByRole('option')).toHaveText(['Name A-Z', 'Price: low to high', 'Price: high to low'])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
