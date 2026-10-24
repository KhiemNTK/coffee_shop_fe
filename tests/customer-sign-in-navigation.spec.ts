import { expect, test, type Page } from '@playwright/test'
import { envelope } from './helpers.js'

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
    await expect(signIn).toHaveText(/Đăng nhập/)
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
