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
  test(`public header preserves the complete sign-in destination ${returnTo}`, async ({ page }, info) => {
    await mockCustomer(page, false)
    await page.goto(returnTo)
    if (info.project.name === 'mobile') {
      await page.getByRole('button', { name: 'Mở menu điều hướng' }).click()
      await page.locator('#mobile-navigation-menu').getByRole('link', { name: 'Đăng nhập khách hàng', exact: true }).click()
    } else {
      await page.getByRole('link', { name: 'Đăng nhập khách hàng', exact: true }).click()
    }
    await expect(page).toHaveURL(/\/customer\/sign-in$/)
    expect(await page.evaluate(() => history.state.usr.returnTo)).toBe(returnTo)
  })
}

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
