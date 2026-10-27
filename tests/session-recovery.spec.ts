import { expect, test } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

test('KDS does not claim sound is enabled until the browser can play it', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { AudioContext: undefined, webkitAudioContext: undefined })
    localStorage.setItem('coffee_kds_sound', 'true')
  })
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: envelope(defaultMockAdminEmployee) }))
  await page.route('**/api/v1/auth/me/permissions', route => route.fulfill({ json: envelope(defaultMockAdminAuth(['/kitchen-tickets_read'])) }))
  await page.route('**/api/v1/kitchen/tickets?*', route => route.fulfill({ json: envelope({ list: [], totalItems: 0, totalPages: 0, currentPage: 1 }) }))
  await page.route('**/api/v1/kitchen/workload', route => route.fulfill({ json: envelope({ asOf: new Date().toISOString(), dueSoonWindowSeconds: 60, stations: [] }) }))
  await page.goto('/staff/kitchen')
  const sound = page.getByRole('button', { name: 'Bật âm báo vé mới', exact: true })
  await expect(sound).toHaveAttribute('aria-pressed', 'false')
  await sound.click()
  await expect(sound).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('status').filter({ hasText: 'âm thanh' })).toBeVisible()
  await page.evaluate(() => {
    class AudioFixture {
      state = 'suspended'
      currentTime = 0
      destination = {}
      async resume() { this.state = 'running' }
      createOscillator() { return { type: '', frequency: { setValueAtTime() {} }, connect() {}, disconnect() {}, start() {}, stop() {} } }
      createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} } }
    }
    Object.assign(window, { AudioContext: AudioFixture })
  })
  await sound.click()
  await expect(page.getByRole('button', { name: 'Tắt âm báo vé mới', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(sound).toHaveAttribute('aria-pressed', 'false')
})

test('customer logout and account changes invalidate other tabs without touching staff sessions', async ({ page, context }) => {
  const first = { id: '80000000-0000-4000-8000-000000000001', email: 'first@example.test' }
  const second = { id: '80000000-0000-4000-8000-000000000002', email: 'second@example.test' }
  let customer: typeof first | null = first
  let staffRequests = 0
  await context.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.startsWith('/api/v1/auth/')) staffRequests++
    if (path.endsWith('/customers/me')) return customer
      ? route.fulfill({ json: envelope(customer) }) : route.fulfill({ status: 401, json: {} })
    if (path.endsWith('/customers/wishlist')) return route.fulfill({ json: envelope({ customerId: customer!.id, items: [] }) })
    if (path.endsWith('/customers/auth/logout')) { customer = null; return route.fulfill({ json: envelope({ success: true }) }) }
    return route.fulfill({ status: 503, json: {} })
  })
  await page.goto('/wishlist')
  const other = await context.newPage()
  await other.goto('/wishlist')
  await expect(other.getByText(first.email, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  await expect(other.getByText(first.email, { exact: true })).toHaveCount(0)
  customer = second
  await page.evaluate(() => {
    const channel = new BroadcastChannel('coffee-shop-customer-session')
    channel.postMessage('changed')
    channel.close()
  })
  await expect(other.getByText(second.email, { exact: true })).toBeVisible()
  expect(staffRequests).toBe(0)
  await other.close()
})

test('payment return uses English and keeps unconfirmed payments unconfirmed', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem('coffee_shop_language', 'en'))
  await page.route('**/api/v1/payments/vnpay/return*', route => route.fulfill({ json: envelope({
    signatureValid: true, attempt: { id: 'attempt-1', invoiceId: 'invoice-1', status: 'PENDING' },
  }) }))
  await page.goto('/payment/vnpay/return?fixture=1')
  await expect(page.getByRole('heading', { name: 'Payment result' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Do not pay again yet')
  await expect(page.getByRole('button', { name: 'Check status' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('payment-return-en.png') })
})

test('cashier page header and navigation use the selected language', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('coffee_shop_language', 'en'))
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: envelope(defaultMockAdminEmployee) }))
  await page.route('**/api/v1/auth/me/permissions', route => route.fulfill({ json: envelope(defaultMockAdminAuth(['/cashier-shifts_current'])) }))
  await page.route('**/api/v1/cashier-shifts/current', route => route.fulfill({ status: 404, json: {} }))
  await page.goto('/staff/shifts')
  await expect(page.getByRole('heading', { name: 'Cashier shifts & funds' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'My current shift', exact: true })).toBeVisible()
})

test('an unverified payment return never shows a successful payment', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('coffee_shop_language', 'en'))
  await page.route('**/api/v1/payments/vnpay/return*', route => route.fulfill({ json: envelope({
    signatureValid: false, attempt: { id: 'attempt-1', invoiceId: 'invoice-1', status: 'SUCCEEDED' },
  }) }))
  await page.goto('/payment/vnpay/return?fixture=unverified')
  const result = page.getByRole('status')
  await expect(result).toContainText('could not be verified')
  await expect(result).not.toHaveClass(/text-emerald/)
})
