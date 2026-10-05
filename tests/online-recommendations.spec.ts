import { expect, test, type Page } from '@playwright/test'
import { envelope } from './helpers.js'

const category = { id: '50000000-0000-4000-8000-000000000001', name: 'Coffee' }
const anchor = { id: '50000000-0000-4000-8000-000000000002', name: 'Coffee fixture', price: '35000.10', category, optionGroups: [] }
const candidate = { id: '50000000-0000-4000-8000-000000000003', name: 'Cake fixture', price: '12000.25', category,
  optionGroups: [{ id: '50000000-0000-4000-8000-000000000004', name: 'Size', minSelected: 1, maxSelected: 1,
    options: [{ id: '50000000-0000-4000-8000-000000000005', name: 'Large', priceDelta: '3000.50' }] }] }
const created = { requestId: '50000000-0000-4000-8000-000000000006', status: 'PENDING',
  expiresAt: '2026-10-05T12:00:00.000Z', quotedSubtotal: '50000.85', items: [], accessToken: 'a'.repeat(64) }

test.beforeEach(async ({ context }) => {
  await context.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', route => route.fulfill({
    contentType: 'application/javascript', body: `let attempt = 0; window.turnstile = {
      render(element, options) {
        if (!['online_order', 'login'].includes(options.action)) throw new Error('Wrong CAPTCHA action');
        const id = 'fixture-' + (++attempt); options.callback(id); return id;
      }, remove() {}
    };`,
  }))
})

async function openCheckout(page: Page) {
  await page.route('**/api/v1/menu/public/categories', route => route.fulfill({ json: envelope([category]) }))
  await page.route('**/api/v1/menu/public/items?*', route => route.fulfill({ json: envelope({
    list: [anchor], currentPage: 1, totalPages: 1, totalItems: 1,
  }) }))
  await page.route('**/api/v1/online-orders/requests/status', route => route.fulfill({ json: envelope({
    ...created, isPaid: false, orderItems: [],
  }) }))
  await page.goto('/order')
  await page.getByRole('button', { name: 'Chọn món', exact: true }).click()
  await page.getByRole('button', { name: 'Thêm vào giỏ', exact: true }).click()
  await page.getByRole('textbox', { name: 'Tên người nhận' }).fill('Customer fixture')
  await page.getByRole('textbox', { name: 'Số điện thoại' }).fill('0901234567')
}

test('online offer options, exact price and checkout share one request identity', async ({ page }, info) => {
  const offers: Record<string, unknown>[] = []
  const orders: Record<string, unknown>[] = []
  await page.route('**/api/v1/recommendations/online', route => {
    offers.push(route.request().postDataJSON())
    return route.fulfill({ json: envelope({ variant: 'TREATMENT', recommendations: [{ ...candidate, menuItemId: candidate.id }] }) })
  })
  await page.route('**/api/v1/online-orders/requests', route => {
    orders.push(route.request().postDataJSON())
    return route.fulfill({ json: envelope(created) })
  })
  await openCheckout(page)
  await page.getByRole('button', { name: 'Xem lại đơn', exact: true }).click()
  await page.getByRole('button', { name: 'Thêm Cake fixture', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Large', exact: false })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Thêm vào giỏ', exact: true }).click()
  await expect(page.getByText('50.000,85', { exact: false })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const submitBox = await page.getByRole('button', { name: 'Gửi đơn mang đi', exact: true }).boundingBox()
  expect(submitBox).not.toBeNull()
  expect(submitBox!.y + submitBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height)
  await page.screenshot({ path: info.outputPath('online-recommendation-checkout.png') })
  await page.getByRole('button', { name: 'Gửi đơn mang đi', exact: true }).click()
  await expect.poll(() => orders.length).toBe(1)
  expect(offers).toHaveLength(1)
  expect(orders[0]!.clientRequestId).toBe(offers[0]!.clientRequestId)
  expect(offers[0]!.menuItemIds).toEqual([anchor.id])
  expect(orders[0]!.maxSubtotal).toBe('50000.85')
  expect(orders[0]!.items).toEqual([
    { menuItemId: anchor.id, quantity: 1 },
    { menuItemId: candidate.id, quantity: 1, optionIds: [candidate.optionGroups[0]!.options[0]!.id] },
  ])
})

test('control checkout gets no offer and sends the same assignment key', async ({ page }) => {
  let assignment: Record<string, unknown> | undefined
  let order: Record<string, unknown> | undefined
  await page.route('**/api/v1/recommendations/online', route => {
    assignment = route.request().postDataJSON()
    return route.fulfill({ json: envelope({ variant: 'CONTROL', recommendations: [] }) })
  })
  await page.route('**/api/v1/online-orders/requests', route => {
    order = route.request().postDataJSON()
    return route.fulfill({ json: envelope(created) })
  })
  await openCheckout(page)
  await page.getByRole('button', { name: 'Xem lại đơn', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Xem lại đơn', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Gọi kèm', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Gửi đơn mang đi', exact: true }).click()
  await expect.poll(() => order?.clientRequestId).toBe(assignment!.clientRequestId)
})

test('offer failure does not block ordering or trigger automatic retries', async ({ page }) => {
  let offers = 0
  let orders = 0
  await page.route('**/api/v1/recommendations/online', route => { offers++; return route.fulfill({ status: 503, json: { message: 'Unavailable' } }) })
  await page.route('**/api/v1/online-orders/requests', route => { orders++; return route.fulfill({ json: envelope(created) }) })
  await openCheckout(page)
  await page.getByRole('button', { name: 'Xem lại đơn', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Gợi ý tạm thời' })).toBeVisible()
  await page.getByRole('button', { name: 'Gửi đơn mang đi', exact: true }).click()
  await expect.poll(() => orders).toBe(1)
  expect(offers).toBe(1)
})

test('uncertain response freezes checkout and explicitly retries the identical payload', async ({ page }) => {
  const orders: Record<string, unknown>[] = []
  let offers = 0
  await page.route('**/api/v1/recommendations/online', route => { offers++; return route.fulfill({ json: envelope({ variant: 'CONTROL', recommendations: [] }) }) })
  await page.route('**/api/v1/online-orders/requests', route => {
    orders.push(route.request().postDataJSON())
    return route.fulfill({ json: envelope(orders.length === 1 ? { ...created, status: 'INVALID' } : created) })
  })
  await openCheckout(page)
  await page.getByRole('button', { name: 'Xem lại đơn', exact: true }).click()
  await page.getByRole('button', { name: 'Gửi đơn mang đi', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Phản hồi không hợp lệ')
  await expect(page.getByRole('textbox', { name: 'Tên người nhận' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Chỉnh sửa đơn', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Đóng giỏ hàng', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Gửi lại đơn', exact: true }).click()
  await expect.poll(() => orders.length).toBe(2)
  expect({ ...orders[1], turnstileToken: orders[0]!.turnstileToken }).toEqual(orders[0])
  expect(orders[1]!.turnstileToken).not.toBe(orders[0]!.turnstileToken)
  expect(offers).toBe(1)
})

test('supplied public key survives reload without storing contact details', async ({ page }) => {
  const keys: string[] = []
  await page.route('**/api/v1/online-orders/requests', route => {
    keys.push(route.request().postDataJSON().clientRequestId)
    return keys.length === 1 ? route.abort() : route.fulfill({ json: envelope(created) })
  })
  await page.goto('/sign-in')
  const post = (supplied: boolean) => page.evaluate(async suppliedKey => {
    const path = '/src/features/online-orders/online-orders.api.ts'
    const { createOnlineOrder } = await import(path)
    try {
      await createOnlineOrder({ ...(suppliedKey ? { clientRequestId: '50000000-0000-4000-8000-000000000009' } : {}),
        pickupName: 'Customer fixture', phoneNumber: '0901234567',
        items: [{ menuItemId: '50000000-0000-4000-8000-000000000002', quantity: 1 }] })
      return 'success'
    } catch { return 'uncertain' }
  }, supplied)
  expect(await post(true)).toBe('uncertain')
  const stored = await page.evaluate(() => JSON.stringify(Object.entries(sessionStorage)))
  expect(stored).not.toContain('Customer fixture')
  expect(stored).not.toContain('0901234567')
  await page.reload()
  expect(await post(false)).toBe('success')
  expect(keys).toEqual(['50000000-0000-4000-8000-000000000009', '50000000-0000-4000-8000-000000000009'])
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('coffee-shop:pending:')))).toEqual([])
})

test('returning to edit keeps recommended items and starts a new basket assignment', async ({ page }) => {
  const offers: Record<string, unknown>[] = []
  await page.route('**/api/v1/recommendations/online', route => {
    offers.push(route.request().postDataJSON())
    return route.fulfill({ json: envelope({ variant: 'TREATMENT', recommendations: offers.length === 1 ? [{ ...candidate, menuItemId: candidate.id }] : [] }) })
  })
  await openCheckout(page)
  await page.getByRole('button', { name: 'Xem lại đơn', exact: true }).click()
  await page.getByRole('button', { name: 'Thêm Cake fixture', exact: true }).click()
  await page.getByRole('button', { name: 'Thêm vào giỏ', exact: true }).click()
  await page.getByRole('button', { name: 'Chỉnh sửa đơn', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Cake fixture', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Tên người nhận' })).toHaveValue('Customer fixture')
  await page.getByRole('button', { name: 'Xem lại đơn', exact: true }).click()
  await expect.poll(() => offers.length).toBe(2)
  expect(offers[1]!.menuItemIds).toEqual([anchor.id, candidate.id])
  expect(offers[1]!.clientRequestId).not.toBe(offers[0]!.clientRequestId)
})

test('takeaway catalog exposes pages beyond the first twelve items', async ({ page }) => {
  const pages: string[] = []
  await page.route('**/api/v1/menu/public/categories', route => route.fulfill({ json: envelope([category]) }))
  await page.route('**/api/v1/menu/public/items?*', route => {
    const pageNumber = new URL(route.request().url()).searchParams.get('page')!
    pages.push(pageNumber)
    return route.fulfill({ json: envelope({ list: [pageNumber === '2' ? candidate : anchor], currentPage: Number(pageNumber), totalItems: 13, totalPages: 2 }) })
  })
  await page.goto('/order')
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Cake fixture', exact: true })).toBeVisible()
  expect(pages).toContain('2')
  await page.getByRole('button', { name: 'Coffee', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Coffee fixture', exact: true })).toBeVisible()
  expect(pages.at(-1)).toBe('1')
})

test('tracking storage failure does not turn a successful order into a failed checkout', async ({ page }) => {
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'coffee_shop_takeaway_order') throw new DOMException('Quota exceeded', 'QuotaExceededError')
      set.call(this, key, value)
    }
  })
  await page.route('**/api/v1/recommendations/online', route => route.fulfill({ json: envelope({ variant: 'CONTROL', recommendations: [] }) }))
  await page.route('**/api/v1/online-orders/requests', route => route.fulfill({ json: envelope(created) }))
  await openCheckout(page)
  await page.getByRole('button', { name: 'Xem lại đơn', exact: true }).click()
  await page.getByRole('button', { name: 'Gửi đơn mang đi', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Đơn đã gửi nhưng chưa lưu được' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
