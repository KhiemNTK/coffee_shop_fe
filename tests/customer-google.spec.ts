import { expect, test } from '@playwright/test'
import { envelope } from './helpers.js'

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
