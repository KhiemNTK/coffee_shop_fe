import { expect, test, type Page } from '@playwright/test'
import {
  envelope,
  onlineAvailability,
  defaultMockAdminEmployee,
  defaultMockAdminAuth,
} from './helpers.js'

const id = '70000000-0000-4000-8000-000000000001'
const item = {
  id: '20000000-0000-4000-8000-000000000001',
  name: 'Cà phê sữa',
  price: '35000',
  category: { id: '10000000-0000-4000-8000-000000000001', name: 'Cà phê' },
  optionGroups: [],
}
const promotion = {
  id,
  name: 'Ưu đãi cà phê buổi sáng',
  discountType: 'PERCENTAGE',
  discountValue: '15',
  maxDiscount: '40000',
  storefrontDescription: 'Ghé quán thưởng thức cà phê cùng bạn bè.',
  startDate: new Date(Date.now() - 60_000).toISOString(),
  endDate: new Date(Date.now() + 86400_000).toISOString(),
}

async function setup(page: Page) {
  const state = { offer: promotion as typeof promotion | null, fail: false }
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/v1/promotions/public/featured')
      return state.fail
        ? route.fulfill({ status: 503, json: {} })
        : route.fulfill({ json: envelope({ promotion: state.offer }) })
    if (path === '/api/v1/menu/public/store')
      return route.fulfill({ json: envelope({ name: 'Coffee Homes', address: null, phone: null }) })
    if (path === '/api/v1/menu/public/categories') return route.fulfill({ json: envelope([]) })
    if (path === '/api/v1/menu/public/items')
      return route.fulfill({
        json: envelope({ list: [item], totalItems: 1, totalPages: 1, currentPage: 1 }),
      })
    if (path === '/api/v1/online-orders/availability')
      return route.fulfill({ json: envelope(onlineAvailability) })
    return route.fulfill({ status: 401, json: {} })
  })
  return state
}

test('offer is delayed, dismissible, accessible and suppressed after reload but can be reopened', async ({
  page,
}, info) => {
  await setup(page)
  await page.goto('/menu')
  await expect(page.getByRole('button', { name: 'Xem ưu đãi' })).toBeVisible()
  const popup = page.getByRole('dialog', { name: promotion.name })
  await expect(popup).not.toBeVisible()
  await expect(popup).toBeVisible({ timeout: 6000 })
  await expect(popup).toContainText('Giảm 15%')
  await expect(popup).toContainText('Ưu đãi chưa áp dụng cho đơn đặt online.')
  await expect(popup.getByRole('button', { name: 'Đóng ưu đãi' })).toBeFocused()
  expect(
    await popup.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(0)
  const box = await popup.boundingBox()
  expect(box!.width).toBeLessThanOrEqual(page.viewportSize()!.width - 24)
  await page.screenshot({ path: info.outputPath('offer.png'), fullPage: true })
  await page.keyboard.press('Escape')
  await expect(popup).toHaveCount(0)
  await page.reload()
  await page.waitForTimeout(3300)
  await expect(popup).toHaveCount(0)
  await page.getByRole('button', { name: 'Xem ưu đãi' }).click()
  await expect(popup).toBeVisible()
  await popup.getByRole('button', { name: 'Đóng ưu đãi' }).click()
  await expect(page.getByRole('button', { name: 'Xem ưu đãi' })).toBeFocused()
})

test('offer does not interrupt product selection and fails closed when unpublished or unavailable', async ({
  page,
}) => {
  const state = await setup(page)
  await page.goto('/menu')
  await page.getByRole('button', { name: 'Xem ưu đãi' }).waitFor()
  await page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: item.name, exact: true }) })
    .getByRole('button', { name: 'Thêm', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.waitForTimeout(3300)
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(page.getByRole('dialog')).not.toContainText(promotion.name)
  state.offer = null
  await page.goto('/menu')
  await expect(page.getByRole('button', { name: 'Xem ưu đãi' })).toHaveCount(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  state.offer = promotion
  state.fail = true
  await page.reload()
  await expect(page.getByRole('button', { name: 'Xem ưu đãi' })).toHaveCount(0)
})

test('offer expires while visible and is readable in dark mode without horizontal overflow', async ({
  page,
}, info) => {
  const state = await setup(page)
  const now = new Date()
  await page.clock.install({ time: now })
  state.offer = { ...promotion, endDate: new Date(now.getTime() + 60_000).toISOString() }
  await page.addInitScript(() => localStorage.setItem('coffee_theme', 'dark'))
  await page.goto('/menu')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.getByRole('button', { name: 'Xem ưu đãi' }).click()
  const popup = page.getByRole('dialog', { name: promotion.name })
  await expect(popup).toBeVisible()
  expect(await popup.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('offer-dark.png') })
  await page.clock.fastForward(61_000)
  await expect(popup).toHaveCount(0, { timeout: 10000 })
  await expect(page.getByRole('button', { name: 'Xem ưu đãi' })).toHaveCount(0)
})

test('staff publication uses current version and prevents blind resubmission after conflict', async ({
  page,
}) => {
  const detail = {
    ...promotion,
    status: 'ACTIVE',
    usageCount: 0,
    createdAt: promotion.startDate,
    updatedAt: promotion.startDate,
    deletedAt: null,
    showOnStorefront: false,
  }
  let writes = 0
  let payload: unknown
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/v1/auth/me')
      return route.fulfill({ json: envelope(defaultMockAdminEmployee) })
    if (path === '/api/v1/auth/me/permissions')
      return route.fulfill({
        json: envelope(defaultMockAdminAuth(['/promotions_read', '/promotions_update'])),
      })
    if (path === '/api/v1/promotions')
      return route.fulfill({
        json: envelope({ list: [detail], totalItems: 1, totalPages: 1, currentPage: 1 }),
      })
    if (path === `/api/v1/promotions/${id}`) return route.fulfill({ json: envelope(detail) })
    if (path === `/api/v1/promotions/${id}/storefront`) {
      writes++
      payload = route.request().postDataJSON()
      if (writes === 1)
        return route.fulfill({
          status: 409,
          json: { code: 'PROMOTION_STOREFRONT_CHANGED', message: 'Promotion changed' },
        })
      return route.fulfill({ json: envelope({ success: true }) })
    }
    return route.fulfill({ status: 404, json: {} })
  })
  await page.goto('/staff/promotions')
  await page.getByRole('button', { name: `Công bố ưu đãi trên website: ${promotion.name}` }).click()
  await page
    .getByRole('checkbox', { name: 'Hiển thị trên website khi chương trình còn hiệu lực' })
    .check()
  await page.getByLabel('Nội dung công khai', { exact: false }).fill('Ưu đãi tại quầy hôm nay')
  await page.getByRole('button', { name: 'Lưu công bố', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Promotion changed')
  await expect(page.getByRole('button', { name: 'Lưu công bố', exact: true })).toBeDisabled()
  expect(payload).toEqual({
    showOnStorefront: true,
    storefrontDescription: 'Ưu đãi tại quầy hôm nay',
    expectedUpdatedAt: detail.updatedAt,
  })
  await page.getByRole('button', { name: 'Tải lại trạng thái trước khi thử lại' }).click()
  await expect(page.getByRole('button', { name: 'Lưu công bố', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Lưu công bố', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(writes).toBe(2)
})
