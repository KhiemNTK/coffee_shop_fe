import { expect, test } from '@playwright/test'
import { envelope } from './helpers.js'

for (const theme of ['light', 'dark'] as const) {
  for (const path of ['/sign-in', '/customer/sign-in']) {
    test(`${path} is readable, responsive and respects reduced motion in ${theme} mode`, async ({
      page,
    }, info) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme })
      await page.addInitScript((value) => localStorage.setItem('coffee_theme', value), theme)
      await page.route('**/api/v1/**', (route) => {
        const endpoint = new URL(route.request().url()).pathname
        if (endpoint.endsWith('/customers/me')) return route.fulfill({ status: 401, json: {} })
        if (endpoint.endsWith('/menu/public/store'))
          return route.fulfill({
            json: envelope({ name: 'Coffee Homes', address: null, phone: null }),
          })
        return route.fulfill({ status: 404, json: {} })
      })
      await page.route(
        'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
        (route) =>
          route.fulfill({
            contentType: 'application/javascript',
            body: `window.turnstile = { render() { return 'design-fixture' }, remove() {} }`,
          })
      )
      await page.goto(path)
      const panel = page.locator('.sign-in-scene__panel')
      await expect(panel).toBeVisible()
      await expect(panel).toHaveCSS('animation-name', 'none')
      await expect(page.locator('.sign-in-scene__welcome')).toHaveCSS('animation-name', 'none')
      await expect(panel).toHaveCSS('opacity', '1')
      await expect(panel).toHaveCSS(
        'background-color',
        theme === 'dark' ? 'rgb(18, 18, 21)' : 'rgb(255, 255, 255)'
      )
      await expect
        .poll(() =>
          page
            .locator('.sign-in-scene__photo img')
            .evaluate((node: HTMLImageElement) => node.naturalWidth)
        )
        .toBeGreaterThan(0)
      const narrow = info.project.name === 'mobile'
      if (narrow) await page.setViewportSize({ width: 320, height: 700 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      )
      await expect(panel).toHaveCSS('border-radius', '8px')
      if (path === '/sign-in') {
        const email = page.getByLabel('Email', { exact: true })
        const password = page.locator('input[autocomplete="current-password"]')
        await expect(email).toHaveAttribute('autocomplete', 'username')
        await expect(email).toHaveCSS('height', '48px')
        await email.fill('staff@example.test')
        await password.fill('design-fixture-not-a-real-password')
        await password.focus()
        await page.keyboard.press('Tab')
        const reveal = page.getByRole('button', { name: 'Hiện mật khẩu', exact: true })
        await expect(reveal).toBeFocused()
        await reveal.click()
        await expect(password).toHaveAttribute('type', 'text')
        await expect(
          page.getByRole('button', { name: 'Ẩn mật khẩu', exact: true })
        ).toHaveAttribute('aria-pressed', 'true')
        await page.getByRole('button', { name: 'Ẩn mật khẩu', exact: true }).click()
        await expect(password).toHaveAttribute('type', 'password')
      } else {
        if (theme === 'dark') {
          await expect(
            page.locator('header').getByRole('link', { name: 'Đăng nhập khách hàng', exact: true })
          ).toHaveCSS('color', 'rgb(166, 216, 194)')
        }
        await expect(page.locator('input[type="password"]')).toHaveCount(0)
        await expect(page.getByRole('region', { name: 'Đăng nhập khách hàng' })).toBeVisible()
        await expect(
          page.getByRole('link', { name: 'Tiếp tục xem thực đơn', exact: true })
        ).toBeVisible()
      }
      await page.screenshot({
        path: info.outputPath(`${path === '/sign-in' ? 'staff' : 'customer'}-${theme}.png`),
        fullPage: true,
        animations: 'disabled',
      })
      expect(errors).toEqual([])
    })
  }
}
