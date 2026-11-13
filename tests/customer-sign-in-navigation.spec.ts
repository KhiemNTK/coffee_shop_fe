import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const customerId = '80000000-0000-4000-8000-000000000001'

async function mockCustomer(page: Page, signedIn = true) {
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.turnstile = { render() { return 'navigation-fixture' }, remove() {} }`,
    }),
  )
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/customers/me'))
      return signedIn
        ? route.fulfill({ json: envelope({ id: customerId, email: 'customer@example.test' }) })
        : route.fulfill({ status: 401, json: {} })
    if (path.endsWith('/menu/public/store'))
      return route.fulfill({ json: envelope({ name: 'Coffee Homes', address: null, phone: null }) })
    return route.fulfill({ status: 404, json: {} })
  })
}

for (const returnTo of ['/reservations?guests=2#request', '/menu?search=latte#drinks']) {
  test(`public header preserves the complete sign-in destination ${returnTo}`, async ({ page }) => {
    await mockCustomer(page, false)
    await page.goto(returnTo)
    const signIn = page.getByRole('link', { name: 'Đăng nhập khách hàng', exact: true })
    await expect(signIn).toHaveText('Đăng nhập khách hàng')
    await signIn.click()
    await expect(page).toHaveURL(/\/customer\/sign-in$/)
    expect(await page.evaluate(() => history.state.usr.returnTo)).toBe(returnTo)
  })
}

test('customer and staff sign-in have separate, visible entry points', async ({ page }, info) => {
  await mockCustomer(page, false)
  await page.goto('/sign-in')
  await expect(page.getByRole('heading', { name: 'Đăng nhập nhân viên', level: 1 })).toBeVisible()
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible()
  await page.screenshot({ path: info.outputPath('staff-sign-in.png'), fullPage: true })
  await page.getByRole('link', { name: 'Đăng nhập khách hàng', exact: true }).click()
  await expect(page).toHaveURL(/\/customer\/sign-in$/)
  await expect(page.getByRole('region', { name: 'Đăng nhập khách hàng' })).toBeVisible()
  await expect(page.locator('input[type="password"]')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('customer-sign-in.png'), fullPage: true })
  for (const width of info.project.name === 'mobile' ? [320, 390] : [640, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const signIn = page.locator('header').getByRole('link', { name: 'Đăng nhập khách hàng' })
    await expect(signIn).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const brand = await page.locator('header').getByRole('link', { name: 'Coffee Homes', exact: true }).boundingBox()
    const account = await signIn.boundingBox()
    expect(brand).not.toBeNull()
    expect(account).not.toBeNull()
    expect(brand!.y + brand!.height <= account!.y || brand!.x + brand!.width <= account!.x).toBe(true)
  }
  await page.getByRole('link', { name: 'Khu vực nhân viên', exact: true }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.getByRole('heading', { name: 'Đăng nhập nhân viên', level: 1 })).toBeVisible()
})

for (const [returnTo, destination] of [
  ['/reservations?guests=2#request', '/reservations?guests=2#request'],
  ['/pickup?code=123#lookup', '/pickup?code=123#lookup'],
  ['/reorder?token=fixture#basket', '/reorder?token=fixture#basket'],
  ['https://outside.invalid/menu', '/account'],
  ['//outside.invalid/menu', '/account'],
  ['/staff', '/account'],
]) {
  test(`customer sign-in validates the return destination ${returnTo}`, async ({ page }) => {
    await mockCustomer(page)
    await page.addInitScript((target) => {
      if (location.pathname === '/customer/sign-in')
        history.replaceState({ usr: { returnTo: target }, key: 'fixture', idx: 0 }, '')
    }, returnTo)
    await page.goto('/customer/sign-in')
    await expect(page.getByText('customer@example.test', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click()
    await expect(page).toHaveURL(`http://localhost:4173${destination}`)
  })
}

for (const customerSignedIn of [false, true]) {
  test(`staff storefront preview keeps the staff session with customer signed in = ${customerSignedIn}`, async ({ page, context }, info) => {
    let customerActive = customerSignedIn
    let staffReads = 0
    let staffMutations = 0
    const staffCookies = ['accessToken', 'refreshToken', 'csrfToken']
    await context.addCookies(staffCookies.map(name => ({
      name, value: `staff-fixture-${name}`, domain: 'localhost', path: '/',
      httpOnly: name !== 'csrfToken', sameSite: 'Strict' as const,
    })))
    await context.route('**/api/v1/**', route => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (path.startsWith('/api/v1/auth/')) {
        if (request.method() !== 'GET') {
          staffMutations++
          return route.fulfill({ status: 401, json: {} })
        }
        staffReads++
        if (!request.headers().cookie?.includes('accessToken=staff-fixture-accessToken'))
          return route.fulfill({ status: 401, json: {} })
        return route.fulfill({ json: envelope(path.endsWith('/permissions') ? defaultMockAdminAuth([]) : defaultMockAdminEmployee) })
      }
      if (path.endsWith('/customers/me')) return customerActive
        ? route.fulfill({ json: envelope({ id: customerId, email: 'customer@example.test' }) })
        : route.fulfill({ status: 401, json: {} })
      if (path.endsWith('/customers/wishlist')) return route.fulfill({ json: envelope({ customerId, items: [] }) })
      if (path.endsWith('/customers/auth/logout')) {
        customerActive = false
        return route.fulfill({ json: envelope({ success: true }) })
      }
      if (path.endsWith('/menu/public/store')) return route.fulfill({ json: envelope({ name: 'Coffee Homes', address: null, phone: null }) })
      if (path.endsWith('/menu/public/categories')) return route.fulfill({ json: envelope([]) })
      if (path.endsWith('/menu/public/items')) return route.fulfill({ json: envelope({ list: [], totalItems: 0, totalPages: 0, currentPage: 1 }) })
      return route.fulfill({ status: 404, json: {} })
    })
    await page.goto('/staff')
    await expect(page.getByRole('heading', { name: defaultMockAdminEmployee.fullName, exact: true })).toBeVisible()
    if (info.project.name === 'desktop' && customerSignedIn) {
      for (const width of [640, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 })
        const header = page.locator('header')
        await expect(header.getByTitle(defaultMockAdminEmployee.username, { exact: true })).toBeInViewport()
        const logout = await header.getByRole('button', { name: 'Đăng xuất khu vực nhân viên', exact: true }).boundingBox()
        const menu = await header.getByRole('link', { name: 'Mở website khách', exact: true }).boundingBox()
        expect(logout!.x).toBeGreaterThanOrEqual(menu!.x + menu!.width)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      }
    }
    const marker = 'coffee-shop:pending:private:navigation-fixture'
    await page.evaluate(key => sessionStorage.setItem(key, 'preserve'), marker)
    if (info.project.name === 'mobile') await page.getByRole('button', { name: 'Mở danh mục điều hướng', exact: true }).click()
    await page.screenshot({ path: info.outputPath('staff-session-identity.png'), animations: 'disabled' })
    const menu = page.getByRole('link', { name: 'Mở website khách', exact: true })
    await expect(menu).toHaveAttribute('target', '_blank')
    await expect(menu).toHaveAttribute('rel', /noopener/)
    const readsBeforePreview = staffReads
    const popupPromise = page.waitForEvent('popup')
    await menu.click()
    const preview = await popupPromise
    await preview.waitForLoadState('domcontentloaded')
    await expect(preview.locator('header').getByRole('link', { name: customerSignedIn ? 'Tài khoản của tôi' : 'Đăng nhập khách hàng', exact: true })).toBeVisible()
    if (customerSignedIn)
      await expect(preview.locator('header').getByText('Khách: customer@example.test', { exact: true })).toBeVisible()
    const back = preview.getByRole('link', { name: 'Quay lại khu vực nhân viên', exact: true })
    await expect(back).toBeVisible()
    expect(staffReads).toBe(readsBeforePreview)
    await expect(page).toHaveURL(/\/staff$/)
    expect(await page.evaluate(key => sessionStorage.getItem(key), marker)).toBe('preserve')
    expect(await preview.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await preview.screenshot({ path: info.outputPath('staff-storefront-preview.png'), animations: 'disabled' })
    if (customerSignedIn) {
      await preview.getByRole('button', { name: 'Chuyển đổi giao diện', exact: true }).click()
      await preview.getByRole('menuitem', { name: 'Giao diện tối', exact: true }).click()
      await expect(preview.locator('html')).toHaveClass(/dark/)
      await preview.screenshot({ path: info.outputPath('staff-storefront-preview-dark.png'), animations: 'disabled' })
      expect(await preview.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    if (customerSignedIn) {
      await preview.goto('/wishlist')
      await preview.getByRole('button', { name: 'Đăng xuất tài khoản khách', exact: true }).click()
      await expect(preview.locator('header').getByRole('link', { name: 'Đăng nhập khách hàng', exact: true })).toBeVisible()
      await expect(back).toBeVisible()
    }
    await back.click()
    await expect(preview.getByRole('heading', { name: defaultMockAdminEmployee.fullName, exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: defaultMockAdminEmployee.fullName, exact: true })).toBeVisible()
    const cookies = await context.cookies()
    for (const name of staffCookies) expect(cookies.find(cookie => cookie.name === name)?.value).toBe(`staff-fixture-${name}`)
    expect(staffMutations).toBe(0)
    await preview.close()
  })
}

test('a storefront staff shortcut does not treat the CSRF cookie as authentication', async ({ page, context }) => {
  await context.addCookies([{ name: 'csrfToken', value: 'stale-navigation-hint', domain: 'localhost', path: '/' }])
  await mockCustomer(page, false)
  let authRequests = 0
  await page.route('**/api/v1/auth/**', route => {
    authRequests++
    return route.fulfill({ status: 401, json: {} })
  })
  await page.goto('/menu')
  const back = page.getByRole('link', { name: 'Quay lại khu vực nhân viên', exact: true })
  await expect(back).toBeVisible()
  expect(authRequests).toBe(0)
  await back.click()
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.getByRole('heading', { name: 'Đăng nhập nhân viên', exact: true })).toBeVisible()
  expect(authRequests).toBeGreaterThan(0)
  await expect(page.getByText(defaultMockAdminEmployee.fullName, { exact: true })).toHaveCount(0)
})
