import { expect, test } from '@playwright/test'
import { envelope } from './helpers.js'

test('Google customer login uses a separate endpoint and never exposes a session token', async ({
  page,
  context,
}) => {
  const customerId = '80000000-0000-4000-8000-000000000001'
  let signedIn = false
  await context.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.google = { accounts: { id: { initialize(options) { window.customerCredentialCallback = options.callback }, renderButton(element) { const button = document.createElement('button'); button.textContent = 'Google customer fixture'; button.onclick = () => window.customerCredentialCallback({ credential: 'customer-' + 'a'.repeat(100) }); element.append(button) } } } }`,
    }),
  )
  await context.route(
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `window.turnstile = { render(element, options) { setTimeout(() => options.callback('fixture-human'), 0); return 'fixture' }, remove() {} }`,
      }),
  )
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
    if (path.endsWith('/customers/wishlist'))
      return route.fulfill({ json: envelope({ customerId, items: [] }) })
    return route.fulfill({
      json: envelope({ name: 'Coffee Homes', address: null, phone: null }),
    })
  })
  await page.goto('/wishlist')
  await page.getByRole('button', { name: 'Google customer fixture' }).click()
  await expect(page.getByText('Chưa có món yêu thích.')).toBeVisible()
  await expect(page.getByText('customer@example.test')).toBeVisible()
  const storage = await page.evaluate(() => ({ ...localStorage, ...sessionStorage }))
  expect(Object.keys(storage).every((key) => key === 'coffee_shop_language')).toBe(true)
  expect(JSON.stringify(storage)).not.toContain('customer@example.test')
  expect(JSON.stringify(storage)).not.toContain('customer-' + 'a'.repeat(100))
})
