import { expect, test } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

test.describe('Theme Switching (Dark / Light / System)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/store/public', (route) =>
      route.fulfill({ json: envelope({ name: 'Coffee Homes' }) }),
    )
    await page.route('**/api/v1/menu/**', (route) =>
      route.fulfill({
        json: envelope({ list: [], totalPages: 0, totalItems: 0, currentPage: 1 }),
      }),
    )
    await page.route('**/api/v1/customers/me', (route) =>
      route.fulfill({ status: 401, json: { message: 'Unauthorized' } }),
    )
  })

  test('customer header toggles dark mode, updates html class, and persists to localStorage', async ({ page }) => {
    await page.goto('/')

    // Toggle button should be visible in header
    const themeBtn = page.getByRole('button', { name: /Chuyển đổi giao diện|Switch theme/i })
    await expect(themeBtn).toBeVisible()

    // Initially light mode (or default)
    await expect(page.locator('html')).not.toHaveClass(/dark/)

    // Click toggle button to open dropdown
    await themeBtn.click()

    // Options should be visible
    const darkOption = page.getByRole('menuitem', { name: /Tối|Dark/i })
    await expect(darkOption).toBeVisible()

    // Select Dark mode
    await darkOption.click()

    // Verify .dark is added to <html>
    await expect(page.locator('html')).toHaveClass(/dark/)

    // Verify localStorage has 'dark'
    const storedTheme = await page.evaluate(() => localStorage.getItem('coffee_theme'))
    expect(storedTheme).toBe('dark')

    // Reload page and ensure anti-FOUC maintains dark mode immediately
    await page.reload()
    await expect(page.locator('html')).toHaveClass(/dark/)

    // Verify public dark mode has neutral obsidian background
    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(bodyBg).toBe('rgb(9, 9, 11)')

    // Switch back to Light mode
    await page.getByRole('button', { name: /Chuyển đổi giao diện|Switch theme/i }).click()
    await page.getByRole('menuitem', { name: /Sáng|Light/i }).click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)

    const updatedStored = await page.evaluate(() => localStorage.getItem('coffee_theme'))
    expect(updatedStored).toBe('light')
  })

  test('staff layout header includes theme toggle and switches themes smoothly with professional neutral dark surfaces', async ({ page }) => {
    await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: envelope(defaultMockAdminEmployee) }))
    await page.route('**/api/v1/auth/me/permissions', (route) =>
      route.fulfill({ json: envelope(defaultMockAdminAuth(['/dining-tables_read'])) }),
    )

    await page.goto('/staff')

    const staffThemeBtn = page.getByRole('button', { name: /Chuyển đổi giao diện|Switch theme/i })
    await expect(staffThemeBtn).toBeVisible()

    // Click toggle button in staff layout
    await staffThemeBtn.click()

    const darkOption = page.getByRole('menuitem', { name: /Tối|Dark/i })
    await expect(darkOption).toBeVisible()
    await darkOption.click()

    // Check dark mode active on html and inside staff workspace
    await expect(page.locator('html')).toHaveClass(/dark/)
    const stored = await page.evaluate(() => localStorage.getItem('coffee_theme'))
    expect(stored).toBe('dark')

    // Verify neutral obsidian background and preserved contract
    const workspace = page.locator('.staff-workspace')
    await expect(workspace).toHaveCSS('background-color', 'rgb(9, 9, 11)')
    await expect(workspace).toHaveCSS('--color-primary', '#116149')
  })
})
