import { expect, test } from '@playwright/test'
import type { ApiError as ClientApiError } from '../src/shared/api/client.js'
import vi from '../src/shared/i18n/locales/vi.js'
import en from '../src/shared/i18n/locales/en.js'
import { i18n } from '../src/shared/i18n/index.js'
import { formatVnd, formatLineAmount } from '../src/shared/lib/format.js'
import { formatQuantity } from '../src/features/inventory/quantity.js'
import { formatStoreDateTime, toStoreLocal, fromStoreLocal } from '../src/shared/lib/store-time.js'
import { envelope, onlineAvailability } from './helpers.js'

const itemId = '82000000-0000-4000-8000-000000000001'
const orderId = '82000000-0000-4000-8000-000000000002'
const categoryId = '82000000-0000-4000-8000-000000000003'
const future = '2099-01-01T00:00:00Z'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({ status: 503, json: { message: 'Unmocked API' } }),
  )
  await page.route('**/api/v1/online-orders/availability', (route) =>
    route.fulfill({ json: envelope(onlineAvailability) }),
  )
  await page.route('**/api/v1/menu/public/store', (route) =>
    route.fulfill({
      json: envelope({
        name: 'Coffee Homes',
        address: '3 Phố Nhổn, Từ Liêm, Hà Nội',
        phone: '0973336850',
      }),
    }),
  )
  await page.route('**/api/v1/menu/public/categories', (route) =>
    route.fulfill({ json: envelope([{ id: categoryId, name: 'Cà phê' }]) }),
  )
  await page.route('**/api/v1/menu/public/items?*', (route) =>
    route.fulfill({
      json: envelope({
        list: [
          {
            id: itemId,
            name: 'Thực đơn',
            price: '30000.25',
            category: { id: categoryId, name: 'Cà phê' },
            optionGroups: [],
          },
        ],
        totalItems: 1,
        totalPages: 1,
        currentPage: 1,
      }),
    }),
  )
})

test('catalogs have identical keys and interpolation variables', () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(vi).sort())
  for (const key of Object.keys(vi) as (keyof typeof vi)[]) {
    const variables = (value: string) =>
      [...value.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map((match) => match[1]).sort()
    expect(variables(en[key]), key).toEqual(variables(vi[key]))
    expect(en[key].trim(), key).not.toBe('')
  }
})

test('database failures keep safe localized messages and never automatically replay writes', async ({ page }) => {
  const calls: { path: string; body: Record<string, unknown> }[] = []
  await page.route('**/api/v1/prisma-error-*', route => {
    const path = new URL(route.request().url()).pathname
    const busy = !calls.some(call => call.path === path)
    calls.push({ path, body: route.request().postDataJSON() as Record<string, unknown> })
    return route.fulfill({ status: busy ? 503 : 409, headers: busy ? { 'retry-after': '1' } : {},
      json: { data: null, message: 'ERROR', code: busy ? 'DATABASE_BUSY' : 'TRANSACTION_CONFLICT', requestId: 'db-operation-request' } })
  })
  await page.goto('/')
  const messages = await page.evaluate(async () => {
    const clientPath = '/src/shared/api/client.ts'
    const idempotencyPath = '/src/shared/api/idempotency.ts'
    const localePath = '/src/shared/i18n/index.ts'
    const schemaPath = '/src/features/operations/operations.api.ts'
    const { ApiError, errorMessage } = await import(clientPath)
    const { apiIdempotentMutate } = await import(idempotencyPath)
    const { changeLanguage } = await import(localePath)
    const { ManagementExceptionsSummarySchema } = await import(schemaPath)
    const messages = []
    for (const language of ['vi', 'en']) {
      await changeLanguage(language)
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await apiIdempotentMutate('/prisma-error-' + language, ManagementExceptionsSummarySchema, { command: 'same-body' }, { authenticated: false })
          throw new Error('The fixture must reject this command')
        } catch (error) {
          if (!(error instanceof ApiError)) throw error
          const detail = error as ClientApiError
          messages.push({ message: errorMessage(error), code: detail.code, requestId: detail.requestId, hasRetryDeadline: detail.retryAt !== undefined })
        }
      }
    }
    return messages
  })
  expect(messages.map(item => item.message)).toEqual([
    vi['error.databaseBusy'], vi['error.transactionConflict'], en['error.databaseBusy'], en['error.transactionConflict'],
  ])
  expect(messages.every(item => item.requestId === 'db-operation-request')).toBe(true)
  expect(messages.map(item => item.hasRetryDeadline)).toEqual([true, false, true, false])
  expect(calls).toHaveLength(4)
  expect(calls[0]?.body).toEqual(calls[1]?.body)
  expect(calls[2]?.body).toEqual(calls[3]?.body)
})

test('locale formatting keeps exact money, quantities and Vietnam business time', async () => {
  i18n.addResourceBundle('en', 'translation', en)
  await i18n.changeLanguage('vi')
  expect(formatVnd('9999999999999999.99')).toBe('9.999.999.999.999.999,99 ₫')
  expect(formatQuantity('1234.5678')).toBe('1.234,5678')
  const local = toStoreLocal(new Date('2026-10-10T17:30:00Z'))
  await i18n.changeLanguage('en')
  expect(formatVnd('9999999999999999.99')).toBe('9,999,999,999,999,999.99 ₫')
  expect(formatLineAmount('0.01', 3)).toBe('0.03 ₫')
  expect(formatQuantity('1234.5678')).toBe('1,234.5678')
  expect(formatStoreDateTime('2026-10-10T17:30:00Z')).toContain('11/10/2026')
  expect(formatStoreDateTime('2026-10-10T17:30:00Z')).toContain('00:30')
  expect(fromStoreLocal(local).toISOString()).toBe('2026-10-10T17:30:00.000Z')
  expect(i18n.t('menu.count', { count: 1 })).toBe('1 item')
  expect(i18n.t('menu.count', { count: 2 })).toBe('2 items')
  await i18n.changeLanguage('vi')
})

test('English is lazy, persists on reload, sends language headers and never translates menu data', async ({
  page,
}, info) => {
  const englishRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/shared/i18n/locales/en')) englishRequests.push(request.url())
  })
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Thực đơn đồ uống & Bánh', exact: true }),
  ).toBeVisible()
  expect(englishRequests).toHaveLength(0)
  await page.getByRole('combobox', { name: 'Ngôn ngữ', exact: true }).selectOption('en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(
    page.getByRole('heading', { name: 'Drinks & Bakery Menu', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('article')).toContainText('Thực đơn')
  await expect(page.getByRole('article')).toContainText('30,000.25 ₫')
  expect(englishRequests.length).toBeGreaterThan(0)
  const next = page.waitForRequest((request) => request.url().includes('/menu/public/items?'))
  await page.reload()
  expect((await next).headers()['accept-language']).toBe('en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('menu-english.png'), fullPage: true })
})

test('a failed English chunk keeps Vietnamese and exposes an explicit retryable error', async ({
  page,
}) => {
  await page.route('**/src/shared/i18n/locales/en.ts*', (route) => route.abort())
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Ngôn ngữ', exact: true }).selectOption('en')
  await expect(page.getByRole('alert')).toContainText('Chưa tải được ngôn ngữ')
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi')
  await expect(page.getByRole('combobox', { name: 'Ngôn ngữ', exact: true })).toBeEnabled()
})

test('unsupported preferences and blocked storage cannot break startup or switching', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('coffee_shop_language', 'not-supported')
    Storage.prototype.setItem = () => {
      throw new Error('Storage disabled')
    }
  })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi')
  await page.getByRole('combobox', { name: 'Ngôn ngữ', exact: true }).selectOption('en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(
    page.getByRole('heading', { name: 'Drinks & Bakery Menu', exact: true }),
  ).toBeVisible()
})

test('switching languages never resubmits an uncertain order and keeps the same idempotency payload', async ({
  page,
}) => {
  await page.route('**/api/v1/customers/me', (route) =>
    route.fulfill({ status: 401, json: { message: 'Guest' } }),
  )
  await page.route(
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `let count = 0; window.turnstile = { render(element, options) { const id = 'captcha-' + (++count); options.callback(id); return id }, remove() {} };`,
      }),
  )
  await page.route('**/api/v1/online-orders/requests/reorder-template', (route) =>
    route.fulfill({
      json: envelope({
        items: [{ menuItemId: itemId, quantity: 1, optionIds: [] }],
        quote: {
          previousSubtotal: '30000.00',
          currentSubtotal: '30000.25',
          canSubmit: true,
          lines: [
            {
              lineNumber: 1,
              previousName: 'Cà phê',
              previousUnitPrice: '30000.00',
              available: true,
              currentName: 'Cà phê',
              currentUnitPrice: '30000.25',
              reason: null,
            },
          ],
        },
      }),
    }),
  )
  const bodies: Record<string, unknown>[] = []
  const languages: string[] = []
  const created = {
    requestId: orderId,
    status: 'PENDING',
    expiresAt: future,
    quotedSubtotal: '30000.25',
    items: [],
    accessToken: 'a'.repeat(64),
  }
  await page.route('**/api/v1/online-orders/requests', (route) => {
    bodies.push(route.request().postDataJSON())
    languages.push(route.request().headers()['accept-language'] ?? '')
    return bodies.length === 1 ? route.abort() : route.fulfill({ json: envelope(created) })
  })
  await page.route('**/api/v1/online-orders/requests/recover', (route) => {
    bodies.push(route.request().postDataJSON())
    languages.push(route.request().headers()['accept-language'] ?? '')
    return route.fulfill({ json: envelope(created) })
  })
  await page.route('**/api/v1/online-orders/requests/status', (route) =>
    route.fulfill({ json: envelope({ ...created, isPaid: false, orderItems: [] }) }),
  )
  await page.goto('/reorder#requestId=old-order&key=' + 'b'.repeat(64))
  await page.getByRole('button', { name: 'Kiểm tra đơn và giá hiện tại', exact: true }).click()
  await page.getByLabel('Tên người nhận', { exact: true }).fill('Khách kiểm thử')
  await page.getByLabel('Điện thoại', { exact: true }).fill('0901234567')
  await page.getByRole('button', { name: 'Đặt lại · Trả khi nhận', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Kiểm tra lại đơn đã gửi', exact: true }),
  ).toBeEnabled()
  await page.getByRole('combobox', { name: 'Ngôn ngữ', exact: true }).selectOption('en')
  await expect(page.getByLabel('Pickup name', { exact: true })).toHaveValue('Khách kiểm thử')
  await expect(page.getByLabel('Pickup name', { exact: true })).toBeDisabled()
  await expect(page.getByLabel('Phone', { exact: true })).toHaveValue('0901234567')
  expect(bodies).toHaveLength(1)
  await page.getByRole('button', { name: 'Check the submitted order', exact: true }).click()
  await expect(page).toHaveURL(/\/order$/)
  expect(bodies).toHaveLength(2)
  expect({ ...bodies[1], turnstileToken: bodies[0]!.turnstileToken }).toEqual(bodies[0])
  expect(languages).toEqual(['vi', 'en'])
})
