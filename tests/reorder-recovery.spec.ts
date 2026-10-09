import { expect, test, type Page } from '@playwright/test'
import { envelope } from './helpers.js'

const itemId = '62000000-0000-4000-8000-000000000001'
const created = { requestId: '62000000-0000-4000-8000-000000000002', status: 'PENDING',
  expiresAt: '2026-10-10T00:00:00Z', quotedSubtotal: '30000.25', items: [], accessToken: 'a'.repeat(64) }

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', route => route.fulfill({ status: 503, json: { message: 'Unmocked API' } }))
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', route => route.fulfill({
    contentType: 'application/javascript', body: `let attempt = 0; window.turnstile = {
      render(element, options) { const id = 'captcha-' + (++attempt); options.callback(id); return id }, remove() {}
    };`,
  }))
  await page.route('**/api/v1/online-orders/requests/reorder-template', route => route.fulfill({ json: envelope({
    items: [{ menuItemId: itemId, quantity: 1, optionIds: [] }],
    quote: { previousSubtotal: '30000.00', currentSubtotal: '30000.25', canSubmit: true,
      lines: [{ lineNumber: 1, previousName: 'Coffee', previousUnitPrice: '30000.00', available: true,
        currentName: 'Coffee', currentUnitPrice: '30000.25', reason: null }] },
  }) }))
  await page.route('**/api/v1/online-orders/requests/status', route => route.fulfill({ json: envelope({ ...created, isPaid: false, orderItems: [] }) }))
})

async function openReorder(page: Page) {
  await page.goto('/reorder#requestId=old-order&key=' + 'b'.repeat(64))
  await page.getByRole('button', { name: 'Kiểm tra đơn và giá hiện tại', exact: true }).click()
  await page.getByLabel('Tên người nhận', { exact: true }).fill('Customer fixture')
  await page.getByLabel('Điện thoại', { exact: true }).fill('0901234567')
}

test('unknown reorder and a rejected retry retain the same request and freeze edits', async ({ page }, info) => {
  const bodies: Record<string, unknown>[] = []
  await page.route('**/api/v1/online-orders/requests', route => {
    bodies.push(route.request().postDataJSON())
    if (bodies.length === 1) return route.abort()
    if (bodies.length === 2) return route.fulfill({ status: 403, json: { message: 'Temporarily rejected' } })
    return route.fulfill({ json: envelope(created) })
  })
  await openReorder(page)
  await page.getByRole('button', { name: 'Đặt lại · Trả khi nhận', exact: true }).click()
  const retry = page.getByRole('button', { name: 'Kiểm tra lại đơn đã gửi', exact: true })
  await expect(retry).toBeEnabled()
  await expect(page.getByLabel('Điện thoại', { exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Thu hồi khóa đặt lại', exact: true })).toBeDisabled()
  await retry.click()
  await expect(page.getByRole('alert')).toContainText('Yêu cầu bị từ chối')
  await expect(page.getByLabel('Tên người nhận', { exact: true })).toBeDisabled()
  await expect(retry).toBeEnabled()
  const storage = await page.evaluate(() => JSON.stringify(Object.entries(sessionStorage)))
  expect(storage).not.toContain('Customer fixture')
  expect(storage).not.toContain('0901234567')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('reorder-recovery.png') })
  await retry.click()
  await expect(page).toHaveURL(/\/order$/)
  expect(bodies).toHaveLength(3)
  for (const body of bodies.slice(1)) expect({ ...body, turnstileToken: bodies[0]!.turnstileToken }).toEqual(bodies[0])
  expect(bodies[1]!.turnstileToken).not.toBe(bodies[0]!.turnstileToken)
})

test('rapid repeated form submission creates only one request', async ({ page }) => {
  let writes = 0
  await page.route('**/api/v1/online-orders/requests', async route => {
    writes++
    await route.fulfill({ json: envelope(created) })
  })
  await openReorder(page)
  await expect(page.getByRole('button', { name: 'Đặt lại · Trả khi nhận', exact: true })).toBeEnabled()
  await page.getByLabel('Điện thoại', { exact: true }).evaluate(input => {
    const form = (input as HTMLInputElement).form!
    form.requestSubmit()
    form.requestSubmit()
  })
  await expect(page).toHaveURL(/\/order$/)
  expect(writes).toBe(1)
})

test('a definitive first rejection releases the form without leaving a pending key', async ({ page }) => {
  await page.route('**/api/v1/online-orders/requests', route => route.fulfill({ status: 400, json: { message: 'Invalid order' } }))
  await openReorder(page)
  await page.getByRole('button', { name: 'Đặt lại · Trả khi nhận', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Invalid order')
  await expect(page.getByLabel('Điện thoại', { exact: true })).toBeEnabled()
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('coffee-shop:pending:')))).toEqual([])
})

test('tracking storage failure still displays the created order without a second POST', async ({ page }, info) => {
  let writes = 0
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'coffee_shop_takeaway_order') throw new DOMException('Storage unavailable', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  await page.route('**/api/v1/online-orders/requests', route => { writes++; return route.fulfill({ json: envelope(created) }) })
  await openReorder(page)
  await page.getByRole('button', { name: 'Đặt lại · Trả khi nhận', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Đơn đã được gửi' })).toBeVisible()
  await expect(page.getByText('Chờ duyệt', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Đặt lại · Trả khi nhận', exact: true })).toHaveCount(0)
  expect(writes).toBe(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('reorder-storage-fallback.png') })
})
