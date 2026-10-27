import { expect, test } from '@playwright/test'
import { envelope } from './helpers.js'

const customerId = '80000000-0000-4000-8000-000000000001'
const secondId = '80000000-0000-4000-8000-000000000002'
const category = { id: '81000000-0000-4000-8000-000000000001', name: 'Coffee' }
const item = {
  id: '82000000-0000-4000-8000-000000000001',
  name: 'Wishlist Latte',
  price: '35000',
  category,
  optionGroups: [],
  isAvailable: true,
}

test('wishlist is server-owned, survives reload, uses customer CSRF, and never refreshes employee auth', async ({
  page,
  context,
}, info) => {
  let saved = true
  const commands: string[] = []
  let employeeCalls = 0
  const pictured = { ...item, imageUrl: 'https://images.fixture.test/wishlist-latte.jpg' }
  if (info.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 844 })
  await page.route(pictured.imageUrl, (route) => route.fulfill({
    contentType: 'image/png',
    body: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1sAAAAASUVORK5CYII=',
      'base64',
    ),
  }))
  await context.addCookies([
    { name: 'customerCsrfToken', value: 'customer-csrf', url: 'http://localhost:4173' },
  ])
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.startsWith('/api/v1/auth/')) employeeCalls++
    if (path === '/api/v1/customers/me')
      return route.fulfill({
        json: envelope({ id: customerId, email: 'customer@example.test' }),
      })
    if (path === '/api/v1/customers/wishlist')
      return route.fulfill({
        json: envelope({ customerId, items: saved ? [{ menuItemId: item.id, item: pictured }] : [] }),
      })
    if (path === `/api/v1/customers/wishlist/${item.id}`) {
      expect(request.headers()['x-csrf-token']).toBe('customer-csrf')
      expect(request.postDataJSON()).toEqual({ expectedCustomerId: customerId })
      commands.push(request.method())
      saved = request.method() === 'PUT'
      return route.fulfill({ json: envelope({ success: true }) })
    }
    if (path === '/api/v1/menu/public/store')
      return route.fulfill({
        json: envelope({ name: 'Coffee Homes', address: null, phone: null }),
      })
    return route.fulfill({
      status: 404,
      json: { errors: [{ message: 'Not found' }], data: null },
    })
  })
  await page.goto('/wishlist')
  await expect(page.getByRole('heading', { name: item.name })).toBeVisible()
  const image = page.locator(`img[src="${pictured.imageUrl}"]`)
  await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Bỏ yêu thích' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.screenshot({ path: info.outputPath('customer-wishlist.png'), fullPage: true })
  await page.getByRole('button', { name: 'Bỏ yêu thích' }).click()
  await expect(page.getByText('Chưa có món yêu thích.')).toBeVisible()
  expect(commands).toEqual(['DELETE'])
  expect(employeeCalls).toBe(0)
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain('customer@example.test')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  )
})

test('an uncertain removal replays DELETE instead of toggling the saved state', async ({
  page,
  context,
}) => {
  let requests = 0
  let saved = true
  await context.addCookies([
    { name: 'customerCsrfToken', value: 'csrf', url: 'http://localhost:4173' },
  ])
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/customers/me'))
      return route.fulfill({
        json: envelope({ id: customerId, email: 'customer@example.test' }),
      })
    if (path.endsWith('/customers/wishlist'))
      return route.fulfill({
        json: envelope({ customerId, items: saved ? [{ menuItemId: item.id, item }] : [] }),
      })
    if (path.endsWith(`/wishlist/${item.id}`)) {
      expect(route.request().method()).toBe('DELETE')
      saved = false
      requests++
      return requests === 1
        ? route.fulfill({
            status: 503,
            json: { data: null, errors: [{ message: 'Uncertain result' }] },
          })
        : route.fulfill({ json: envelope({ success: true }) })
    }
    return route.fulfill({
      json: envelope({ name: 'Coffee Homes', address: null, phone: null }),
    })
  })
  await page.goto('/wishlist')
  await page.getByRole('button', { name: 'Bỏ yêu thích' }).click()
  await page.getByRole('button', { name: /Dịch vụ.*Thử lại/ }).click()
  await expect(page.getByText('Chưa có món yêu thích.')).toBeVisible()
  expect(requests).toBe(2)
})

test('account changes cannot store a new customer response under the old wishlist cache key', async ({
  page,
}) => {
  let me = customerId
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/customers/me'))
      return route.fulfill({ json: envelope({ id: me, email: `${me}@example.test` }) })
    if (path.endsWith('/customers/wishlist')) {
      me = secondId
      return route.fulfill({ json: envelope({ customerId: secondId, items: [] }) })
    }
    return route.fulfill({
      json: envelope({ name: 'Coffee Homes', address: null, phone: null }),
    })
  })
  await page.goto('/wishlist')
  await expect(page.getByText(`${secondId}@example.test`)).toBeVisible()
  await expect(page.getByText('Chưa có món yêu thích.')).toBeVisible()
  await expect(page.getByText(`${customerId}@example.test`)).toHaveCount(0)
})

test('unavailable and archived favorites remain removable without adding them to the cart', async ({
  page,
}) => {
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/customers/me'))
      return route.fulfill({
        json: envelope({ id: customerId, email: 'customer@example.test' }),
      })
    if (path.endsWith('/customers/wishlist'))
      return route.fulfill({
        json: envelope({
          customerId,
          items: [
            { menuItemId: item.id, item: { ...item, isAvailable: false } },
            { menuItemId: '82000000-0000-4000-8000-000000000002', item: null },
          ],
        }),
      })
    return route.fulfill({
      json: envelope({ name: 'Coffee Homes', address: null, phone: null }),
    })
  })
  await page.goto('/wishlist')
  await expect(page.getByRole('heading', { name: 'Món đã ngừng kinh doanh' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Bỏ yêu thích' })).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Chọn món' })).toHaveCount(0)
})

for (const placement of ['menu', 'details']) {
  test(`wishlist limit feedback is visible and readable in ${placement}`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.addInitScript(() => localStorage.setItem('coffee_theme', 'dark'))
    let writes = 0
    await page.route('**/api/v1/**', (route) => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/customers/me'))
        return route.fulfill({ json: envelope({ id: customerId, email: 'customer@example.test' }) })
      if (path.endsWith('/customers/wishlist'))
        return route.fulfill({ json: envelope({ customerId, items: [] }) })
      if (path.endsWith(`/customers/wishlist/${item.id}`)) {
        writes++
        return route.fulfill({ status: 409, json: { code: 'WISHLIST_LIMIT_REACHED' } })
      }
      if (path.endsWith('/menu/public/categories'))
        return route.fulfill({ json: envelope([category]) })
      if (path.endsWith('/menu/public/items'))
        return route.fulfill({ json: envelope({ list: [item], totalPages: 1, currentPage: 1, totalItems: 1 }) })
      return route.fulfill({ json: envelope({ name: 'Coffee Homes', address: null, phone: null }) })
    })
    await page.goto('/menu')
    const card = page.getByRole('article').filter({
      has: page.getByRole('heading', { name: item.name, exact: true }),
    })
    if (placement === 'details')
      await card.getByRole('button', { name: 'Thêm', exact: true }).click()
    const scope = placement === 'details' ? page.getByRole('dialog') : card
    const favorite = scope.getByRole('button', { name: 'Thêm vào yêu thích', exact: true })
    await expect(favorite).toHaveCSS('background-color', 'rgb(18, 18, 21)')
    await expect(favorite).toHaveCSS('color', 'rgb(250, 250, 250)')
    const bounds = await favorite.boundingBox()
    expect(bounds!.width).toBeGreaterThanOrEqual(44)
    expect(bounds!.height).toBeGreaterThanOrEqual(44)
    await favorite.click()
    const feedback = scope.getByRole('alert')
    await expect(feedback).toHaveText('Đã đạt giới hạn 100 món yêu thích. Hãy bỏ một món trước khi thêm.')
    expect((await feedback.boundingBox())!.height).toBeLessThan(180)
    await expect(scope.getByRole('button', { name: /Đã đạt giới hạn/ })).not.toHaveAccessibleName(/Thử lại/)
    expect(await feedback.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
      return hit === element || element.contains(hit)
    })).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`wishlist-limit-${placement}.png`), fullPage: true })
    expect(writes).toBe(1)
  })
}
