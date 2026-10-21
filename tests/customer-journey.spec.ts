import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { envelope, onlineAvailability } from './helpers.js'

const customerId = '80000000-0000-4000-8000-000000000001'
const secondId = '80000000-0000-4000-8000-000000000002'
const orderId = '83000000-0000-4000-8000-000000000001'
const category = { id: '81000000-0000-4000-8000-000000000001', name: 'Coffee' }
const item = {
  id: '82000000-0000-4000-8000-000000000001',
  name: 'Customer Latte',
  price: '35000',
  category,
  optionGroups: [],
}
const detail = {
  requestId: orderId,
  status: 'ACCEPTED',
  expiresAt: '2030-01-01T00:00:00Z',
  pickupAt: null,
  quotedSubtotal: '30000',
  isPaid: true,
  fulfillmentStatus: 'COLLECTED',
  orderItems: [],
  invoices: [],
  pickupAccessToken: null,
  items: [
    {
      menuItemId: item.id,
      lineNumber: 1,
      quantity: 1,
      quotedName: item.name,
      quotedUnitPrice: '30000',
      quotedOptions: [],
    },
  ],
}

async function setup(page: Page, context: BrowserContext, signedIn = true) {
  const state = {
    customerId: signedIn ? customerId : '',
    mismatch: false,
    uncertain: false,
    ready: false,
    expired: false,
    resolvedFeedback: false,
    posts: [] as Record<string, unknown>[],
    employeeCalls: 0,
  }
  await context.addCookies([
    { name: 'customerCsrfToken', value: 'customer-csrf', url: 'http://localhost:4173' },
  ])
  await context.route(
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `let count=0; window.turnstile={render(element,options){options.callback('customer-human-'+(++count));return String(count)},remove(){}}`,
      }),
  )
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/api/v1', '')
    if (path.startsWith('/auth/')) state.employeeCalls++
    if (path === '/customers/me')
      return state.customerId
        ? route.fulfill({
            json: envelope({ id: state.customerId, email: `${state.customerId}@example.test` }),
          })
        : route.fulfill({ status: 401, json: { message: 'Sign in required' } })
    if (path === '/customers/auth/logout') {
      expect(request.headers()['x-csrf-token']).toBe('customer-csrf')
      state.customerId = ''
      return route.fulfill({ json: envelope({ success: true }) })
    }
    if (path === '/customers/orders' && request.method() === 'POST') {
      const payload = request.postDataJSON()
      state.posts.push(payload)
      expect(request.headers()['x-csrf-token']).toBe('customer-csrf')
      if (payload.expectedCustomerId !== state.customerId)
        return route.fulfill({ status: 409, json: { code: 'CUSTOMER_SESSION_CHANGED' } })
      if (state.uncertain && state.posts.length === 1) return route.abort()
      return route.fulfill({
        json: envelope({ ...detail, status: 'PENDING', accessToken: 'a'.repeat(64) }),
      })
    }
    if (path === '/online-orders/requests')
      throw new Error('Signed-in orders must never fall back to guest checkout')
    if (path === '/customers/orders')
      return route.fulfill({
        json: envelope({
          customerId: state.customerId,
          list: [
            {
              id: orderId,
              status: 'ACCEPTED',
              createdAt: '2026-09-01T08:00:00Z',
              quotedSubtotal: '30000',
              pickupAt: null,
            },
          ],
          currentPage: 1,
          totalPages: 1,
          totalItems: 1,
        }),
      })
    if (path === `/customers/orders/${orderId}/reorder-template`)
      return route.fulfill({
        json: envelope({
          customerId: state.customerId,
          items: [{ menuItemId: item.id, quantity: 1, optionIds: [] }],
          quote: {
            previousSubtotal: '30000',
            currentSubtotal: '35000',
            canSubmit: true,
            stockAvailable: true,
            lines: [
              {
                lineNumber: 1,
                previousName: item.name,
                previousUnitPrice: '30000',
                currentName: item.name,
                currentUnitPrice: '35000',
                available: true,
                reason: null,
              },
            ],
          },
        }),
      })
    if (path === `/customers/orders/${orderId}`)
      return route.fulfill({
        json: envelope({
          ...detail,
          feedback: state.resolvedFeedback ? [{
            id: orderId, invoiceId: orderId, rating: 1, comment: 'Nhận món chậm',
            createdAt: '2026-09-01T08:00:00Z', resolvedAt: '2026-09-02T08:00:00Z',
            customerReply: 'Quán đã liên hệ và giải quyết việc giao món chậm.',
            resolutionNote: 'Internal staff note must never be displayed',
          }] : [],
          ...(state.ready ? {
            fulfillmentStatus: 'READY',
            isPaid: false,
            pickupAccessToken: 'b'.repeat(64),
            accessExpiresAt: new Date(Date.now() + (state.expired ? -1 : 3600000)).toISOString(),
          } : {}),
          customerId: state.mismatch ? secondId : state.customerId,
        }),
      })
    if (path === '/customers/wishlist')
      return route.fulfill({ json: envelope({ customerId: state.customerId, items: [] }) })
    if (path === '/online-orders/availability')
      return route.fulfill({ json: envelope(onlineAvailability) })
    if (path === '/online-orders/quote')
      return route.fulfill({ json: envelope({
        canFulfill: true,
        reason: null,
        subtotal: '35000.00',
        items: [{ menuItemId: item.id, quantity: 1, unitPrice: '35000.00', selectedOptions: [] }],
      }) })
    if (path === '/online-orders/requests/status') return route.fulfill({ json: envelope(detail) })
    if (path === '/recommendations/online')
      return route.fulfill({ json: envelope({ variant: 'CONTROL', recommendations: [] }) })
    if (path === '/menu/public/store')
      return route.fulfill({ json: envelope({ name: 'Coffee Homes', address: null, phone: null }) })
    if (path === '/menu/public/categories') return route.fulfill({ json: envelope([category]) })
    if (path === '/menu/public/items')
      return route.fulfill({
        json: envelope({ list: [item], currentPage: 1, totalPages: 1, totalItems: 1 }),
      })
    return route.fulfill({ status: 404, json: { message: `Unmocked ${path}` } })
  })
  return state
}

async function openCart(page: Page) {
  await page.addInitScript(
    ({ item }) =>
      sessionStorage.setItem(
        'coffee_shop_storefront_cart',
        JSON.stringify([
          {
            id: item.id,
            menuItem: item,
            quantity: 1,
            note: '',
            selectedOptionIds: [],
            calculatedUnitPrice: item.price,
          },
        ]),
      ),
    { item },
  )
  await page.goto('/cart')
  await page.getByRole('button', { name: 'Thông tin nhận món', exact: true }).click()
  await page.getByRole('textbox', { name: 'Tên người nhận', exact: true }).fill('Customer fixture')
  await page.getByRole('textbox', { name: 'Số điện thoại', exact: true }).fill('0901234567')
  await page.getByRole('button', { name: 'Xem lại đơn', exact: true }).click()
}

test('public account entry is for customers and missing Google configuration is explicit', async ({
  page,
  context,
}, info) => {
  await setup(page, context, false)
  if (info.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/menu')
  await page.getByRole('link', { name: 'Đăng nhập khách hàng', exact: true }).click()
  await expect(page).toHaveURL(/\/customer\/sign-in$/)
  await expect(
    page.getByRole('status').filter({ hasText: 'Đăng nhập khách hàng hiện chưa sẵn sàng' }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Khu vực nhân viên', exact: true })).toHaveAttribute(
    'href',
    '/sign-in',
  )
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('customer-sign-in.png'), fullPage: true })
  if (info.project.name === 'desktop') for (const width of [768, 1024]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const account = await page.getByRole('link', { name: 'Đăng nhập khách hàng', exact: true }).boundingBox()
    expect(account).not.toBeNull()
    expect(account!.x + account!.width).toBeLessThanOrEqual(width)
  }
})

test('customer history supports old orders and reorders at current prices without a public token', async ({
  page,
  context,
}, info) => {
  const state = await setup(page, context)
  await page.goto('/account')
  await page.getByRole('link').filter({ hasText: '#83000000' }).click()
  await expect(page.getByRole('heading', { name: `1 × ${item.name}` })).toBeVisible()
  await page.screenshot({ path: info.outputPath('customer-order.png'), fullPage: true })
  await page.getByRole('link', { name: 'Đặt lại đơn này', exact: true }).click()
  await expect(page.getByLabel('Khóa đặt lại', { exact: true })).toHaveCount(0)
  await page.getByLabel('Tên người nhận', { exact: true }).fill('Customer fixture')
  await page.getByLabel('Điện thoại', { exact: true }).fill('0901234567')
  await page.getByRole('button', { name: 'Đặt lại · Trả khi nhận', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/account/orders/${orderId}$`))
  expect(state.posts).toHaveLength(1)
  expect(state.posts[0]).toMatchObject({ expectedCustomerId: customerId, maxSubtotal: '35000' })
  expect(state.employeeCalls).toBe(0)
})

test('signed-in checkout retains its customer and request key across an uncertain retry', async ({
  page,
  context,
}, info) => {
  const state = await setup(page, context)
  state.uncertain = true
  await openCart(page)
  await page.screenshot({ path: info.outputPath('customer-checkout.png'), fullPage: true })
  await page.getByRole('button', { name: 'Gửi đơn mang đi', exact: true }).click()
  await page.getByRole('button', { name: 'Gửi lại đơn', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/account/orders/${orderId}$`))
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain('a'.repeat(64))
  expect(state.posts).toHaveLength(2)
  expect(state.posts[0]?.expectedCustomerId).toBe(customerId)
  expect(state.posts[1]?.clientRequestId).toBe(state.posts[0]?.clientRequestId)
  expect({ ...state.posts[1], turnstileToken: null }).toEqual({
    ...state.posts[0],
    turnstileToken: null,
  })
  expect(state.employeeCalls).toBe(0)
})

test('an account switch cannot silently move a reviewed order to another customer', async ({
  page,
  context,
}) => {
  const state = await setup(page, context)
  await openCart(page)
  state.customerId = secondId
  await page.getByRole('button', { name: 'Gửi đơn mang đi', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Tài khoản khách đã thay đổi')
  await expect(page.getByText(`${secondId}@example.test`, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Gửi đơn mang đi', exact: true }).click()
  expect(state.posts).toHaveLength(1)
  expect(state.posts[0]?.expectedCustomerId).toBe(customerId)
})

test('a mismatched customer read never renders another account order', async ({
  page,
  context,
}) => {
  const state = await setup(page, context)
  state.mismatch = true
  await page.goto(`/account/orders/${orderId}`)
  await expect(page.getByRole('alert')).toContainText('Tài khoản khách đã thay đổi')
  await expect(page.getByRole('heading', { name: `1 × ${item.name}` })).toHaveCount(0)
})

test('customer logout clears private history without changing employee authentication', async ({
  page,
  context,
}) => {
  const state = await setup(page, context)
  await page.goto('/account')
  await expect(page.getByRole('link').filter({ hasText: '#83000000' })).toBeVisible()
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Đăng nhập khách hàng', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('link').filter({ hasText: '#83000000' })).toHaveCount(0)
  expect(state.employeeCalls).toBe(0)
})

test('a signed-in customer can reveal a private pickup code without persisting it', async ({ page, context }, info) => {
  const state = await setup(page, context)
  state.ready = true
  await page.goto(`/account/orders/${orderId}`)
  const code = page.getByRole('region', { name: 'Mã nhận món', exact: true })
  await expect(code).toBeVisible()
  await expect(code.getByRole('code')).toHaveCount(0)
  await code.getByRole('button', { name: 'Hiện mã nhận món', exact: true }).click()
  await expect(code.getByRole('code')).toHaveText('b'.repeat(64))
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('b'.repeat(64))
  expect(page.url()).not.toContain('b'.repeat(64))
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('customer-pickup-code.png'), fullPage: true })
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  await expect(code).toHaveCount(0)
})

test('customer history shows public feedback resolution without an active pickup credential', async ({ page, context }, info) => {
  const state = await setup(page, context)
  state.resolvedFeedback = true
  await page.goto(`/account/orders/${orderId}`)
  const response = page.getByRole('region', { name: 'Phản hồi và trả lời từ quán', exact: true })
  await expect(response).toContainText('Quán đã liên hệ và giải quyết việc giao món chậm.')
  await expect(page.getByText('Internal staff note must never be displayed')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Mã nhận món', exact: true })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('customer-feedback-response.png'), fullPage: true })
})

test('an expired pickup code is not displayed', async ({ page, context }) => {
  const state = await setup(page, context)
  state.ready = state.expired = true
  await page.goto(`/account/orders/${orderId}`)
  await expect(page.getByRole('heading', { name: `1 × ${item.name}` })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Mã nhận món', exact: true })).toHaveCount(0)
})

test('signing in cannot resend an uncertain guest order through the customer endpoint', async ({
  page,
  context,
}) => {
  const state = await setup(page, context)
  await page.route('**/api/v1/online-orders/requests', (route) => route.abort())
  await page.goto('/account')
  const code = await page.evaluate(
    async ({ customerId, itemId }) => {
      const path = '/src/features/online-orders/online-orders.api.ts'
      const api = await import(path)
      const payload = {
        pickupName: 'Guest fixture',
        phoneNumber: '0901234567',
        items: [{ menuItemId: itemId, quantity: 1 }],
      }
      try {
        await api.createOnlineOrder(payload)
      } catch {
        /* The first result is deliberately uncertain. */
      }
      try {
        await api.findPendingOnlineOrderKey({ ...payload, expectedCustomerId: customerId })
        return 'unexpected-success'
      } catch (error) {
        return (error as { code?: string }).code
      }
    },
    { customerId, itemId: item.id },
  )
  expect(code).toBe('CLIENT_PENDING_OPERATION')
  expect(state.posts).toHaveLength(0)
})
