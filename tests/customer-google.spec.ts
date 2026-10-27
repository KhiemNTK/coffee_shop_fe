import { expect, test, type BrowserContext } from '@playwright/test'
import { envelope } from './helpers.js'

async function mockIdentity(context: BrowserContext) {
  await context.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.google = { accounts: { id: { initialize(options) { window.customerCredentialCallback = options.callback }, renderButton(element) { const button = document.createElement('button'); button.textContent = 'Google customer fixture'; button.onclick = () => window.customerCredentialCallback({ credential: 'customer-' + 'a'.repeat(100) }); element.append(button) } } } }`,
    }),
  )
  await context.route(
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    (route) => route.fulfill({
      contentType: 'application/javascript',
      body: `window.turnstile = { render(element, options) { setTimeout(() => options.callback('fixture-human'), 0); return 'fixture' }, remove() {} }`,
    }),
  )
}

for (const entry of ['/wishlist', '/menu', '/order']) {
  test(`Google customer login from ${entry} preserves the action without exposing a session token`, async ({
    page,
    context,
  }) => {
    const customerId = '80000000-0000-4000-8000-000000000001'
    let signedIn = false
    let saved = false
    let favoriteWrites = 0
    const item = {
      id: '82000000-0000-4000-8000-000000000001',
      name: 'Google customer latte',
      price: '35000',
      category: { id: '81000000-0000-4000-8000-000000000001', name: 'Coffee' },
      optionGroups: [],
      isAvailable: true,
    }
    await mockIdentity(context)
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      expect(path.startsWith('/api/v1/auth/')).toBe(false)
      if (path.endsWith('/customers/me'))
        return signedIn
          ? route.fulfill({ json: envelope({ id: customerId, email: 'customer@example.test' }) })
          : route.fulfill({
              status: 401,
              json: { data: null, errors: [{ message: 'Sign-in required' }] },
            })
      if (path.endsWith('/customers/auth/google')) {
        expect(route.request().postDataJSON()).toEqual({
          idToken: 'customer-' + 'a'.repeat(100),
          turnstileToken: 'fixture-human',
        })
        signedIn = true
        await context.addCookies([
          { name: 'customerCsrfToken', value: 'customer-csrf', url: 'http://localhost:4173' },
        ])
        return route.fulfill({
          json: envelope({ customer: { id: customerId, email: 'customer@example.test' } }),
        })
      }
      if (path.endsWith(`/customers/wishlist/${item.id}`)) {
        expect(route.request().method()).toBe('PUT')
        expect(route.request().headers()['x-csrf-token']).toBe('customer-csrf')
        expect(route.request().postDataJSON()).toEqual({ expectedCustomerId: customerId })
        saved = true
        favoriteWrites++
        return route.fulfill({ json: envelope({ success: true }) })
      }
      if (path.endsWith('/customers/wishlist'))
        return route.fulfill({
          json: envelope({ customerId, items: saved ? [{ menuItemId: item.id, item }] : [] }),
        })
      if (path.endsWith('/menu/public/categories'))
        return route.fulfill({ json: envelope([item.category]) })
      if (path.endsWith('/menu/public/items'))
        return route.fulfill({
          json: envelope({ list: [item], currentPage: 1, totalPages: 1, totalItems: 1 }),
        })
      return route.fulfill({
        json: envelope({ name: 'Coffee Homes', address: null, phone: null }),
      })
    })
    await page.goto(entry)
    if (entry === '/menu') {
      await page.getByRole('button', { name: 'Thêm vào yêu thích', exact: true }).first().click()
      await expect(page).toHaveURL(/\/customer\/sign-in$/)
    }
    if (entry === '/order') {
      await page.getByRole('button', { name: 'Chọn món', exact: true }).click()
      await page.getByRole('button', { name: 'Thêm vào giỏ', exact: true }).click()
      await page.getByRole('link', { name: 'Đăng nhập khách hàng', exact: true }).click()
      await expect(page).toHaveURL(/\/customer\/sign-in$/)
    }
    await page.getByRole('button', { name: 'Google customer fixture' }).click()
    if (entry === '/wishlist') {
      await expect(page.getByText('Chưa có món yêu thích.')).toBeVisible()
      await expect(page.getByText('customer@example.test')).toBeVisible()
      expect(favoriteWrites).toBe(0)
    } else if (entry === '/menu') {
      await expect(page).toHaveURL(/\/menu$/)
      await expect(
        page.getByRole('button', { name: 'Bỏ yêu thích', exact: true }).first(),
      ).toHaveAttribute('aria-pressed', 'true')
      expect(favoriteWrites).toBe(1)
    } else {
      await expect(page).toHaveURL(/\/cart$/)
      await expect(page.getByRole('heading', { name: item.name, exact: true })).toBeVisible()
      expect(favoriteWrites).toBe(0)
    }
    const storage = await page.evaluate(() => ({ ...localStorage, ...sessionStorage }))
    expect(
      Object.keys(storage).every(
        (key) =>
          key === 'coffee_shop_language' ||
          (entry === '/order' && key === 'coffee_shop_storefront_cart'),
      ),
    ).toBe(true)
    expect(JSON.stringify(storage)).not.toContain('customer@example.test')
    expect(JSON.stringify(storage)).not.toContain('customer-' + 'a'.repeat(100))
  })
}

test('customer Google sign-in respects Retry-After and exposes the support ID', async ({ page, context }) => {
  await mockIdentity(context)
  let calls = 0
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/customers/me')) return route.fulfill({ status: 401, json: {} })
    if (path.endsWith('/customers/auth/google')) {
      calls++
      return route.fulfill({ status: 429, headers: { 'retry-after': '60', 'x-request-id': 'customer-login-429' }, json: { message: 'Too many requests' } })
    }
    return route.fulfill({ json: envelope({ name: 'Coffee Homes', address: null, phone: null }) })
  })
  await page.goto('/customer/sign-in')
  await expect(page.getByRole('button', { name: 'Google customer fixture' })).toBeVisible()
  await page.clock.install()
  await page.getByRole('button', { name: 'Google customer fixture' }).click()
  await expect(page.getByRole('alert')).toContainText('customer-login-429')
  await expect(page.getByRole('button', { name: 'Google customer fixture' })).toHaveCount(0)
  await page.clock.runFor(59_000)
  expect(calls).toBe(1)
  await expect(page.getByRole('button', { name: 'Google customer fixture' })).toHaveCount(0)
  await page.clock.runFor(2_000)
  await page.getByRole('button', { name: 'Google customer fixture' }).click()
  await expect.poll(() => calls).toBe(2)
})

test('a favorite rate limit does not prevent the customer from signing out', async ({ page, context }) => {
  await mockIdentity(context)
  const customerId = '80000000-0000-4000-8000-000000000001'
  const favoriteItemId = '82000000-0000-4000-8000-000000000001'
  let signedIn = true
  let logouts = 0
  await page.addInitScript(favoriteItemId => {
    history.replaceState({ usr: { returnTo: '/wishlist', favoriteItemId }, key: 'fixture', idx: 0 }, '')
  }, favoriteItemId)
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/customers/me')) return signedIn
      ? route.fulfill({ json: envelope({ id: customerId, email: 'customer@example.test' }) })
      : route.fulfill({ status: 401, json: {} })
    if (path.endsWith('/customers/wishlist/' + favoriteItemId))
      return route.fulfill({ status: 429, headers: { 'retry-after': '60' }, json: { message: 'Too many requests' } })
    if (path.endsWith('/customers/auth/logout')) {
      signedIn = false
      logouts++
      return route.fulfill({ json: envelope({ success: true }) })
    }
    return route.fulfill({ json: envelope({ name: 'Coffee Homes', address: null, phone: null }) })
  })
  await page.goto('/customer/sign-in')
  await page.getByRole('button', { name: 'Thêm vào yêu thích', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('thao tác quá nhanh')
  await expect(page.getByRole('button', { name: 'Thêm vào yêu thích', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Đổi tài khoản', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Google customer fixture' })).toBeVisible()
  expect(logouts).toBe(1)
})

test('switching customer accounts handles logout failure and preserves the pending favorite', async ({ page, context }) => {
  const firstId = '80000000-0000-4000-8000-000000000001'
  const secondId = '80000000-0000-4000-8000-000000000002'
  const itemId = '82000000-0000-4000-8000-000000000001'
  const category = { id: '81000000-0000-4000-8000-000000000001', name: 'Coffee' }
  const item = { id: itemId, name: 'Account switch latte', price: '35000', category, optionGroups: [], isAvailable: true }
  let currentId = firstId
  let logouts = 0
  let writes = 0
  await mockIdentity(context)
  await context.addCookies([{ name: 'customerCsrfToken', value: 'customer-csrf', url: 'http://localhost:4173' }])
  await page.addInitScript((favoriteItemId) => {
    if (location.pathname === '/customer/sign-in')
      history.replaceState({ usr: { returnTo: '/menu?category=coffee#drinks', favoriteItemId }, key: 'fixture', idx: 0 }, '')
  }, itemId)
  await page.route('**/api/v1/**', (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    expect(path.startsWith('/api/v1/auth/')).toBe(false)
    if (path.endsWith('/customers/me'))
      return currentId
        ? route.fulfill({ json: envelope({ id: currentId, email: `${currentId}@example.test` }) })
        : route.fulfill({ status: 401, json: {} })
    if (path.endsWith('/customers/auth/logout')) {
      expect(request.method()).toBe('POST')
      expect(request.headers()['x-csrf-token']).toBe('customer-csrf')
      logouts++
      if (logouts === 1) return route.fulfill({ status: 503, json: {} })
      currentId = ''
      return route.fulfill({ json: envelope({ success: true }) })
    }
    if (path.endsWith('/customers/auth/google')) {
      currentId = secondId
      return route.fulfill({ json: envelope({ customer: { id: secondId, email: `${secondId}@example.test` } }) })
    }
    if (path.endsWith(`/customers/wishlist/${itemId}`)) {
      expect(request.postDataJSON()).toEqual({ expectedCustomerId: secondId })
      writes++
      return route.fulfill({ json: envelope({ success: true }) })
    }
    if (path.endsWith('/customers/wishlist'))
      return route.fulfill({ json: envelope({ customerId: currentId, items: writes ? [{ menuItemId: itemId, item }] : [] }) })
    if (path.endsWith('/menu/public/categories')) return route.fulfill({ json: envelope([category]) })
    if (path.endsWith('/menu/public/items'))
      return route.fulfill({ json: envelope({ list: [item], currentPage: 1, totalPages: 1, totalItems: 1 }) })
    return route.fulfill({ json: envelope({ name: 'Coffee Homes', address: null, phone: null }) })
  })
  await page.goto('/customer/sign-in')
  await expect(page.getByText(`${firstId}@example.test`, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Đổi tài khoản', exact: true }).evaluate((element) => {
    const button = element as HTMLButtonElement
    button.click()
    button.click()
  })
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByText(`${firstId}@example.test`, { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Thêm vào yêu thích', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Google customer fixture' })).toHaveCount(0)
  expect(logouts).toBe(1)
  await page.getByRole('button', { name: 'Đổi tài khoản', exact: true }).click()
  await page.getByRole('button', { name: 'Google customer fixture' }).click()
  await expect(page).toHaveURL('http://localhost:4173/menu?category=coffee#drinks')
  await expect(page.getByRole('button', { name: 'Bỏ yêu thích', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('link', { name: 'Tài khoản của tôi', exact: true }).first().click()
  await expect(page.getByText(`${secondId}@example.test`, { exact: true })).toBeVisible()
  await expect(page.getByText(`${firstId}@example.test`, { exact: true })).toHaveCount(0)
  expect(logouts).toBe(2)
  expect(writes).toBe(1)
})

test('Turnstile follows the selected app theme and discards callbacks from the previous widget', async ({ page, context }) => {
  await mockIdentity(context)
  await page.emulateMedia({ colorScheme: 'light' })
  await page.addInitScript(() => localStorage.setItem('coffee_theme', 'dark'))
  await context.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `window.removedWidgets = [];
      window.turnstile = {
        render(element, options) {
          const id = crypto.randomUUID(); element.dataset.widget = id; element.dataset.theme = options.theme;
          window.previousCaptchaCallback = window.currentCaptchaCallback;
          window.currentCaptchaCallback = options.callback;
          const button = document.createElement('button'); button.textContent = 'Verify theme fixture';
          button.onclick = () => options.callback('theme-' + id); element.append(button); return id;
        },
        remove(id) { window.removedWidgets.push(id); document.querySelector('[data-widget="' + id + '"]')?.replaceChildren() }
      }`,
  }))
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/customers/me')) return route.fulfill({ status: 401, json: {} })
    return route.fulfill({ json: envelope({ name: 'Coffee Homes', address: null, phone: null }) })
  })
  await page.goto('/customer/sign-in')
  const widget = page.locator('[data-widget]')
  await expect(widget).toHaveAttribute('data-theme', 'dark')
  const oldId = await widget.getAttribute('data-widget')
  await page.getByRole('button', { name: 'Verify theme fixture' }).click()
  await expect(page.getByRole('button', { name: 'Google customer fixture' })).toBeVisible()
  await page.getByRole('button', { name: /Chuyển đổi giao diện/ }).click()
  await page.getByRole('menuitem', { name: 'Giao diện sáng', exact: true }).click()
  await expect(widget).toHaveAttribute('data-theme', 'light')
  expect(await page.evaluate(() => Reflect.get(window, 'removedWidgets'))).toContain(oldId)
  await expect(page.getByRole('button', { name: 'Google customer fixture' })).toHaveCount(0)
  await page.evaluate(() => (Reflect.get(window, 'previousCaptchaCallback') as (token: string) => void)('stale-token'))
  await expect(page.getByRole('button', { name: 'Google customer fixture' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Verify theme fixture' }).click()
  await expect(page.getByRole('button', { name: 'Google customer fixture' })).toBeVisible()
})
