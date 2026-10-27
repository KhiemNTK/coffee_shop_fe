import { expect, test } from '@playwright/test'
import { envelope } from './helpers.js'

const item = {
  id: '70000000-0000-4000-8000-000000000001',
  name: 'Catalog fixture',
  price: '35000.25',
  category: { id: '70000000-0000-4000-8000-000000000002', name: 'Catalog' },
  optionGroups: [],
}
const line = {
  id: item.id, menuItem: item, quantity: 2, note: '',
  selectedOptionIds: [], calculatedUnitPrice: item.price,
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/customers/me')) return route.fulfill({ status: 401, json: {} })
    if (path.endsWith('/menu/public/store'))
      return route.fulfill({ json: envelope({ name: 'Coffee Homes', address: null, phone: null }) })
    if (path.endsWith('/menu/public/categories')) return route.fulfill({ json: envelope([item.category]) })
    if (path.endsWith('/menu/public/items'))
      return route.fulfill({ json: envelope({ list: [item], totalItems: 1, totalPages: 1, currentPage: 1 }) })
    return route.fulfill({ status: 404, json: {} })
  })
})

test('invalid persisted carts recover without a render failure or reload loop', async ({ page }) => {
  await page.goto('/cart')
  for (const raw of ['{broken', '{}', 'null', JSON.stringify([{ ...line, quantity: -1 }]),
    JSON.stringify([{ ...line, calculatedUnitPrice: 'not-money' }])]) {
    await page.evaluate(value => sessionStorage.setItem('coffee_shop_storefront_cart', value), raw)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Giỏ hàng mang đi', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Thực đơn', exact: true })).toBeVisible()
    expect(await page.evaluate(() => sessionStorage.getItem('coffee_shop_storefront_cart'))).toBeNull()
  }
})

test('a valid persisted cart preserves its items and exact total', async ({ page }) => {
  await page.addInitScript(value => sessionStorage.setItem('coffee_shop_storefront_cart', JSON.stringify(value)), [line])
  await page.goto('/cart')
  await expect(page.getByRole('heading', { name: item.name, exact: true })).toBeVisible()
  await expect(page.getByText('70.000,50 ₫', { exact: true })).toBeVisible()
})

test('cards, detail and cart use a neutral placeholder for missing or failed images', async ({ page }) => {
  const broken = 'https://images.example.test/missing.webp'
  await page.route(broken, route => route.fulfill({ status: 404, body: '' }))
  for (const imageUrl of [null, broken]) {
    await page.route('**/api/v1/menu/public/items?*', route => route.fulfill({
      json: envelope({ list: [{ ...item, imageUrl }], totalItems: 1, totalPages: 1, currentPage: 1 }),
    }))
    await page.goto('/menu')
    await expect(page.getByRole('article').getByRole('img', { name: `Chưa có ảnh cho ${item.name}` })).toBeVisible()
    await page.getByRole('article').getByRole('button', { name: 'Thêm', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('img', { name: `Chưa có ảnh cho ${item.name}` })).toBeVisible()
    await expect(dialog).not.toContainText('120 kcal')
    await dialog.getByRole('button', { name: /^Thêm vào giỏ hàng/ }).click()
    await page.goto('/cart')
    await expect(page.getByRole('img', { name: `Chưa có ảnh cho ${item.name}` })).toBeVisible()
    await page.getByRole('button', { name: 'Xóa tất cả', exact: true }).click()
  }
})

test('storefront localizes its controls and loads responsive WebP artwork', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem('coffee_shop_language', 'en'))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'A cup of coffee, a wonderful day.' })).toBeVisible()
  await expect(page.getByRole('article').getByText('Price', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Customer sign-in', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Address & contact' })).toBeVisible()
  const hero = page.locator('.menu-cover img')
  await expect.poll(() => hero.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  expect(await hero.evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(/hero-coffee(?:-640)?\.webp$/)
  for (const width of info.project.name === 'mobile' ? [320, 390] : [768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.screenshot({ path: info.outputPath('storefront-english.png'), fullPage: true })
  await page.getByRole('article').getByRole('button', { name: 'Add', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Special instructions (optional)')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Increase quantity' })).toBeVisible()
  for (const width of info.project.name === 'mobile' ? [320, 390] : [768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const add = dialog.getByRole('button', { name: /^Add to cart/ })
    await add.scrollIntoViewIfNeeded()
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    expect(await add.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  }
  await page.screenshot({ path: info.outputPath('product-detail-english.png'), fullPage: true })
})
