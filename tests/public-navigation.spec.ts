import { expect, test, type Page } from '@playwright/test'
import { envelope, onlineAvailability } from './helpers.js'

const profile = {
  name: 'Coffee Homes',
  address: '3 Phố Nhổn, Từ Liêm, Hà Nội',
  phone: '0973336850',
}
const category = { id: '10000000-0000-4000-8000-000000000001', name: 'Cà phê' }
const item = {
  id: '20000000-0000-4000-8000-000000000001',
  name: 'Cà phê sữa đá',
  price: '35000',
  category,
  optionGroups: [],
}

async function setup(page: Page) {
  const state = {
    failed: false,
    store: { ...profile } as { name: string | null; address: string | null; phone: string | null },
    customer: false,
  }
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/v1/menu/public/store')
      return state.failed
        ? route.fulfill({ status: 503, json: {} })
        : route.fulfill({ json: envelope(state.store) })
    if (path === '/api/v1/menu/public/categories')
      return route.fulfill({ json: envelope([category]) })
    if (path === '/api/v1/menu/public/items')
      return route.fulfill({
        json: envelope({ list: [item], totalItems: 1, totalPages: 1, currentPage: 1 }),
      })
    if (path === '/api/v1/online-orders/availability')
      return route.fulfill({ json: envelope(onlineAvailability) })
    if (path === '/api/v1/customers/me')
      return state.customer
        ? route.fulfill({
            json: envelope({
              id: '80000000-0000-4000-8000-000000000001',
              email: 'customer@example.test',
            }),
          })
        : route.fulfill({ status: 401, json: {} })
    return route.fulfill({ status: 404, json: {} })
  })
  return state
}

async function navigation(page: Page) {
  const toggle = page.getByRole('button', { name: 'Mở menu điều hướng', exact: true })
  if (await toggle.isVisible()) await toggle.click()
  return page.getByRole('navigation', { name: 'Chính', exact: true })
}

test('public navigation opens real pages and menu opens the working catalog', async ({
  page,
}, info) => {
  await setup(page)
  if (info.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/')
  let nav = await navigation(page)
  const mainLinks = nav.getByRole('link', { name: /^(Trang chủ|Menu|Về quán|Liên hệ)$/ })
  await expect(mainLinks).toHaveCount(4)
  expect(
    await mainLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
  ).toEqual(['/', '/menu', '/about', '/contact'])
  await nav.getByRole('link', { name: 'Về quán', exact: true }).click()
  await expect(page).toHaveURL(/\/about$/)
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(profile.name)
  await expect
    .poll(() =>
      page
        .getByRole('main')
        .locator('img')
        .first()
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0)
  await page.screenshot({ path: info.outputPath('about.png'), fullPage: true })
  nav = await navigation(page)
  await expect(nav.getByRole('link', { name: 'Về quán', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await nav.getByRole('link', { name: 'Liên hệ', exact: true }).click()
  await expect(page).toHaveURL(/\/contact$/)
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(
    'Liên hệ Coffee Homes',
  )
  await expect(page.getByRole('main')).toContainText(profile.address)
  await expect(page.getByRole('main').getByRole('link', { name: 'Gọi cho quán' })).toHaveAttribute(
    'href',
    'tel:0973336850',
  )
  const directions = page.getByRole('main').getByRole('link', { name: 'Chỉ đường đến quán' })
  expect(new URL((await directions.getAttribute('href'))!).searchParams.get('query')).toBe(
    profile.address,
  )
  await expect(directions).toHaveAttribute('rel', 'noopener noreferrer')
  await page.reload()
  await expect(page.getByRole('main')).toContainText(profile.phone)
  await page.screenshot({ path: info.outputPath('contact.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  nav = await navigation(page)
  await nav.getByRole('link', { name: 'Menu', exact: true }).click()
  await expect(page).toHaveURL(/\/menu$/)
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(
    'Thực đơn đồ uống & Bánh',
  )
  await expect(page.locator('#page-title')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: item.name, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Thêm', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText(item.name)
})

test('contact read failure has a retry and never fabricates store information', async ({
  page,
}) => {
  const state = await setup(page)
  state.failed = true
  await page.goto('/contact')
  const main = page.getByRole('main')
  await expect(main.getByRole('alert')).toBeVisible()
  await expect(main.getByRole('link', { name: 'Gọi cho quán' })).toHaveCount(0)
  state.failed = false
  await main.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(main).toContainText(profile.address)
  state.store = { name: null, address: null, phone: null }
  await page.reload()
  await expect(main).toContainText('Địa chỉ quán chưa được công bố.')
  await expect(main).toContainText('Số điện thoại chưa được công bố.')
  await expect(main.locator('a[href^="tel:"], a[href*="google.com/maps"]')).toHaveCount(0)
})

test('store information pages support English without translating business data', async ({
  page,
}, info) => {
  await page.addInitScript(() => localStorage.setItem('coffee_shop_language', 'en'))
  await setup(page)
  await page.goto('/about')
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(profile.name)
  await expect(page.getByRole('heading', { name: 'A little coffee. A better day.' })).toBeVisible()
  await page.goto('/contact')
  await expect(page.getByRole('heading', { name: 'Contact Coffee Homes' })).toBeVisible()
  await expect(page.getByRole('main')).toContainText(profile.address)
  await expect(page.getByRole('link', { name: 'Call the shop' })).toHaveAttribute(
    'href',
    'tel:0973336850',
  )
  await page.getByRole('button', { name: 'Toggle theme', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Dark mode', exact: true }).click()
  await page.screenshot({ path: info.outputPath('contact-en-theme.png'), fullPage: true })
})

for (const path of ['/about', '/contact']) {
  test(`customer sign-in returns to ${path} instead of losing the destination`, async ({
    page,
  }) => {
    const state = await setup(page)
    await page.goto(path)
    await page
      .getByRole('banner')
      .getByRole('link', { name: 'Đăng nhập khách hàng', exact: true })
      .click()
    await expect(page).toHaveURL(/\/customer\/sign-in$/)
    state.customer = true
    await page.reload()
    await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${path}$`))
  })
}
