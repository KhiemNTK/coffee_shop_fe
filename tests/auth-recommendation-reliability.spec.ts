import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee as employee, envelope } from './helpers.js'

const sessionId = '97000000-0000-4000-8000-000000000001'
const itemId = '97000000-0000-4000-8000-000000000002'
const otherId = '97000000-0000-4000-8000-000000000003'
const returnKey = 'coffee_shop_staff_return_to'
const target = `/staff/pos/sessions/${sessionId}?source=tables#current`
const category = { id: sessionId, name: 'Coffee' }
const item = { id: itemId, name: 'Audit coffee', price: '35000', category, optionGroups: [] }
const session = { id: sessionId, sessionStatus: 'ACTIVE', createdAt: new Date().toISOString(), table: null, employee,
  orderItems: [{ id: otherId, quantity: 1, priceAtTime: '35000', serveStatus: 'PENDING', isPaid: false, selectedOptions: [], menuItem: item }] }

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', route => route.fulfill({ status: 503, json: { message: 'Unmocked API' } }))
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', route => route.fulfill({
    contentType: 'application/javascript',
    body: `window.turnstile={render(el,o){const id=crypto.randomUUID();el.dataset.widget=id;const b=document.createElement('button');b.type='button';b.textContent='Verify audit';b.onclick=()=>o.callback('audit-captcha');el.append(b);return id},remove(id){document.querySelector('[data-widget="'+id+'"]')?.replaceChildren()}}`,
  }))
})

async function pos(page: Page, recommendations: unknown[] = []) {
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: envelope(employee) }))
  await page.route('**/api/v1/auth/me/permissions', route => route.fulfill({ json: envelope(defaultMockAdminAuth(['/orders_sessions_read', '/orders_items_create'])) }))
  await page.route(`**/api/v1/orders/sessions/${sessionId}`, route => route.fulfill({ json: envelope(session) }))
  await page.route('**/api/v1/menu/public/categories', route => route.fulfill({ json: envelope([category]) }))
  await page.route('**/api/v1/menu/public/items?*', route => route.fulfill({ json: envelope({ list: [item], currentPage: 1, totalPages: 1, totalItems: 1 }) }))
  await page.route(`**/api/v1/recommendations/pos/${sessionId}`, route => route.fulfill({ json: envelope({ recommendations }) }))
}

test('staff login restores the full observed POS URL without replaying an order', async ({ page }) => {
  await page.route('**/api/v1/auth/me', route => route.fulfill({ status: 401, json: {} }))
  await page.route('**/api/v1/auth/me/permissions', route => route.fulfill({ status: 401, json: {} }))
  await page.goto(target)
  await expect(page).toHaveURL(/\/sign-in$/)
  expect(await page.evaluate(key => sessionStorage.getItem(key), returnKey)).toBe(target)
  await page.reload()
  await page.route('**/api/v1/auth/sign-in', route => route.fulfill({ json: envelope({}) }))
  await pos(page)
  let writes = 0
  await page.route(`**/api/v1/orders/sessions/${sessionId}/items`, route => { writes++; return route.abort() })
  await page.getByLabel('Email', { exact: true }).fill(employee.email)
  await page.locator('input[name=password]').fill('audit-password-only')
  await page.getByRole('button', { name: 'Verify audit' }).click()
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page).toHaveURL(`http://localhost:4173${target}`)
  expect(await page.evaluate(key => sessionStorage.getItem(key), returnKey)).toBeNull()
  expect(writes).toBe(0)
})

test('staff return destinations reject external, normalized escape and malformed paths', async ({ page }) => {
  await page.goto('/sign-in')
  const results = await page.evaluate(async ({ returnKey, target }) => {
    const path = '/src/shared/auth/staff-destination.ts'
    const { rememberStaffDestination, takeStaffDestination, clearStaffDestination } = await import(path)
    const rejected = ['https://outside.invalid/staff', '//outside.invalid/staff', '//localhost:4173/staff', '/staff/../../menu', '/staff\\..\\menu', '/staffish', '/menu', '/st\naff', null, {}].map(value => takeStaffDestination(value))
    rememberStaffDestination(target)
    const restored = takeStaffDestination()
    rememberStaffDestination(target)
    clearStaffDestination()
    const cleared = sessionStorage.getItem(returnKey)
    const methods = { getItem: Storage.prototype.getItem, setItem: Storage.prototype.setItem, removeItem: Storage.prototype.removeItem }
    let withoutStorage
    try {
      Storage.prototype.getItem = Storage.prototype.setItem = Storage.prototype.removeItem = () => { throw new Error('Storage blocked') }
      rememberStaffDestination(target)
      withoutStorage = takeStaffDestination()
    } finally { Object.assign(Storage.prototype, methods) }
    return { rejected, restored, cleared, withoutStorage }
  }, { returnKey, target })
  expect(results.rejected.every(value => value === '/staff')).toBe(true)
  expect(results.restored).toBe(target)
  expect(results.cleared).toBeNull()
  expect(results.withoutStorage).toBe('/staff')
})

test('password recovery honors Retry-After in the button and submit handler', async ({ page }) => {
  let calls = 0
  await page.route('**/api/v1/auth/forgot-password', route => {
    calls++
    return route.fulfill({ status: 429, headers: { 'retry-after': '60', 'x-request-id': 'audit-reset-429' }, json: { message: 'Too many requests' } })
  })
  await page.goto('/forgot-password')
  await page.locator('input[name=email]').fill(employee.email)
  await page.getByRole('button', { name: 'Verify audit' }).click()
  await page.clock.install()
  const submit = page.locator('form button[type=submit]')
  await submit.click()
  await expect(page.getByRole('alert')).toContainText('audit-reset-429')
  await page.getByRole('button', { name: 'Verify audit' }).click()
  await expect(submit).toBeDisabled()
  await page.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  await page.clock.runFor(59_000)
  expect(calls).toBe(1)
  await expect(submit).toBeDisabled()
  await page.clock.runFor(2_000)
  await expect(submit).toBeEnabled()
  await submit.click()
  await expect.poll(() => calls).toBe(2)
})

test('POS suggestions show distinct long names in full on mobile and desktop', async ({ page }, info) => {
  const names = ['Cà phê sữa hạt đặc biệt vị hạnh nhân', 'Cà phê sữa hạt đặc biệt vị hạt dẻ']
  await pos(page, names.map((name, i) => ({ ...item, id: i ? otherId : sessionId, menuItemId: i ? otherId : sessionId, name })))
  await page.goto(`/staff/pos/sessions/${sessionId}`)
  const strip = page.getByText('Gợi ý món gọi kèm thông minh').locator('..').locator('..')
  await expect(strip).toBeVisible()
  await strip.scrollIntoViewIfNeeded()
  const dimensions = await strip.locator('span[title]').evaluateAll(nodes => nodes.map(node => ({ width: node.clientWidth, content: node.scrollWidth, height: node.clientHeight, contentHeight: node.scrollHeight })))
  expect(dimensions).toHaveLength(2)
  expect(dimensions.every(value => value.width >= value.content && value.height >= value.contentHeight)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('pos-full-recommendation-names.png') })
})
