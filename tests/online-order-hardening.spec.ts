import { createHash } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const id = '97000000-0000-4000-8000-000000000001'
const itemId = '97000000-0000-4000-8000-000000000002'
const token = 'd'.repeat(64)
const payload = {
  clientRequestId: id,
  pickupName: 'Recovery customer',
  phoneNumber: '0912345678',
  maxSubtotal: '35000.10',
  items: [{ menuItemId: itemId, quantity: 2, note: 'Less ice' }],
}
const created = {
  requestId: id,
  status: 'PENDING',
  expiresAt: '2099-01-01T00:00:00.000Z',
  quotedSubtotal: '35000.10',
  items: [],
  accessToken: token,
}
const pageOf = (list: unknown[]) => ({
  list,
  currentPage: 1,
  totalPages: 1,
  totalItems: list.length,
})

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', (route) => route.fulfill({ status: 503, json: {} }))
  await page.route('**/api/v1/customers/me', (route) => route.fulfill({ status: 401, json: {} }))
  await page.route('**/api/v1/online-orders/requests/status', (route) =>
    route.fulfill({ json: envelope({ ...created, isPaid: false, orderItems: [] }) }),
  )
  await page.route(
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: "window.turnstile={render(el,o){o.callback('fresh-human');return 'fixture'},remove(){}}",
      }),
  )
})

async function unknownSubmission(page: Page) {
  await page.goto('/order')
  return page.evaluate(async (body) => {
    const path = '/src/features/online-orders/online-orders.api.ts'
    const api = await import(path)
    try {
      await api.createOnlineOrder(body)
    } catch {
      /* Lost response is the fixture. */
    }
    return api.readOnlineOrderRecovery()
  }, payload)
}

test('reload recovers a saved order with no contacts, quote, CAPTCHA or second write while intake is paused', async ({
  page,
}, info) => {
  let writes = 0
  let reads = 0
  await page.route('**/api/v1/online-orders/requests', (route) => {
    writes++
    return route.abort()
  })
  await page.route('**/api/v1/online-orders/availability', (route) =>
    route.fulfill({ json: envelope({ acceptingOrders: false, acceptingAsap: false }) }),
  )
  await page.route('**/api/v1/online-orders/requests/recover-by-key', (route) => {
    reads++
    expect(route.request().postDataJSON()).toEqual({
      clientRequestId: id,
      requestHash: createHash('sha256')
        .update(
          JSON.stringify({
            pickupName: payload.pickupName,
            phoneNumber: payload.phoneNumber,
            maxSubtotal: payload.maxSubtotal,
            items: payload.items,
          }),
        )
        .digest('hex'),
    })
    return route.fulfill({ json: envelope(created) })
  })
  await page.route('**/api/v1/online-orders/quote', () => {
    throw new Error('Recovery must not re-quote')
  })
  const saved = await unknownSubmission(page)
  expect(JSON.stringify(saved)).not.toContain(payload.pickupName)
  expect(JSON.stringify(saved)).not.toContain(payload.phoneNumber)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Kiểm tra đơn đã gửi' })).toBeVisible()
  await page.getByRole('button', { name: 'Kiểm tra lại đơn đã gửi', exact: true }).click()
  await expect(page.getByText(id, { exact: true }).first()).toBeVisible()
  expect(writes).toBe(1)
  expect(reads).toBe(1)
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem('coffee-shop:pending:public:intent:online-order'),
    ),
  ).toBeNull()
  await page.screenshot({ path: info.outputPath('online-order-recovered.png'), fullPage: true })
})

test('missing recovery permits only the same basket, contacts and key with a fresh CAPTCHA', async ({
  page,
}) => {
  const writes: Record<string, unknown>[] = []
  await page.route('**/api/v1/online-orders/requests', (route) => {
    writes.push(route.request().postDataJSON())
    return writes.length === 1 ? route.abort() : route.fulfill({ json: envelope(created) })
  })
  await page.route('**/api/v1/online-orders/requests/recover-by-key', (route) =>
    route.fulfill({ status: 404, json: { code: 'ONLINE_ORDER_RECOVERY_NOT_FOUND' } }),
  )
  await unknownSubmission(page)
  await page.reload()
  await page.getByRole('button', { name: 'Kiểm tra lại đơn đã gửi', exact: true }).click()
  await page.getByLabel('Tên người nhận').fill('Different customer')
  await page.getByLabel('Số điện thoại', { exact: true }).fill(payload.phoneNumber)
  await page.getByRole('button', { name: 'Gửi lại đơn', exact: true }).click()
  await expect(page.getByRole('alert').last()).toContainText('chưa rõ kết quả')
  expect(writes).toHaveLength(1)
  await page.getByLabel('Tên người nhận').fill(payload.pickupName)
  await page.getByRole('button', { name: 'Gửi lại đơn', exact: true }).click()
  await expect.poll(() => writes.length).toBe(2)
  expect(writes[1]).toMatchObject({ ...payload, turnstileToken: 'fresh-human' })
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(sessionStorage).filter((key) => key.startsWith('coffee-shop:pending:')),
      ),
    )
    .toEqual([])
})

test('a changed customer account cannot recover a prior customer order', async ({ page }) => {
  await page.route('**/api/v1/customers/orders', (route) => route.abort())
  await page.goto('/order')
  await page.evaluate(async (body) => {
    const path = '/src/features/online-orders/online-orders.api.ts'
    try {
      await (
        await import(path)
      ).createOnlineOrder({ ...body, expectedCustomerId: '97000000-0000-4000-8000-000000000003' })
    } catch {}
  }, payload)
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Kiểm tra lại đơn đã gửi', exact: true }),
  ).toBeDisabled()
  await expect(page.getByRole('alert')).toContainText('Tài khoản')
})

test('a guest proof remains recoverable after sign-in without attaching the order to that account', async ({
  page,
}) => {
  await page.route('**/api/v1/online-orders/requests', (route) => route.abort())
  await unknownSubmission(page)
  await page.route('**/api/v1/customers/me', (route) =>
    route.fulfill({ json: envelope({ id: itemId, email: 'other@example.test' }) }),
  )
  let guestReads = 0
  await page.route('**/api/v1/online-orders/requests/recover-by-key', (route) => {
    guestReads++
    expect(route.request().postDataJSON().expectedCustomerId).toBeUndefined()
    return route.fulfill({ json: envelope(created) })
  })
  await page.reload()
  await page.getByRole('button', { name: 'Kiểm tra lại đơn đã gửi', exact: true }).click()
  await expect(page.getByText(id, { exact: true }).first()).toBeVisible()
  expect(guestReads).toBe(1)
  await expect(page).toHaveURL(/\/order$/)
})

test('an online session cannot open POS checkout even with pay and cancel permissions', async ({
  page,
}) => {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminEmployee) }),
  )
  await page.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill({
      json: envelope(
        defaultMockAdminAuth([
          '/orders_sessions_read',
          '/online-orders_read',
          '/orders_items_cancel',
          '/invoices_create',
          '/invoices_pay',
        ]),
      ),
    }),
  )
  await page.route(`**/api/v1/orders/sessions/${id}`, (route) =>
    route.fulfill({
      json: envelope({
        id,
        onlineOrderRequest: { id },
        sessionStatus: 'ACTIVE',
        createdAt: '2026-10-24T00:00:00Z',
        table: null,
        employee: { id: defaultMockAdminEmployee.id, fullName: 'Cashier' },
        orderItems: [
          {
            id: itemId,
            quantity: 1,
            priceAtTime: '35000',
            selectedOptions: [],
            serveStatus: 'PENDING',
            isPaid: false,
            invoiceId: null,
            menuItem: { id: itemId, name: 'Coffee', price: '35000' },
          },
        ],
      }),
    }),
  )
  await page.goto(`/staff/pos/sessions/${id}`)
  await expect(
    page.getByRole('status').filter({ hasText: 'Đơn online được thu tiền' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /^Thanh toán/ })).toHaveCount(0)
  await page.keyboard.press('F2')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

async function openCollection(page: Page) {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminEmployee) }),
  )
  await page.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill({
      json: envelope(
        defaultMockAdminAuth([
          '/online-orders_read',
          '/orders_items_handoff',
          '/invoices_create',
          '/invoices_pay',
        ]),
      ),
    }),
  )
  await page.route('**/api/v1/online-orders/requests/fulfillment?*', (route) =>
    route.fulfill({
      json: envelope(
        pageOf([
          {
            id,
            pickupName: 'QR pickup',
            phoneNumber: '0912345678',
            quotedSubtotal: '35000.10',
            createdAt: '2026-10-24T00:00:00Z',
            isOverdue: false,
            isNoShowEligible: false,
            fulfillmentStatus: 'READY',
            orderSessionId: id,
            sessionStatus: 'ACTIVE',
            orderItems: [
              {
                id: itemId,
                quantity: 1,
                priceAtTime: '35000.10',
                serveStatus: 'READY',
                isPaid: false,
                selectedOptions: [],
                menuItem: { name: 'Coffee' },
              },
            ],
          },
        ]),
      ),
    }),
  )
  await page.goto('/staff/online-orders?tab=fulfillment')
  await page.getByRole('button', { name: 'Khách nhận & Thu tiền' }).click()
}

test('QR camera fills the credential, stops its tracks and never auto-collects money', async ({
  page,
}, info) => {
  await page.addInitScript((code) => {
    const state = window as unknown as { cameraStops: number; BarcodeDetector: unknown }
    state.cameraStops = 0
    state.BarcodeDetector = class {
      static async getSupportedFormats() {
        return ['qr_code']
      }
      async detect() {
        return [{ rawValue: code }]
      }
    }
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => {
        const stream = document.createElement('canvas').captureStream()
        for (const track of stream.getTracks()) {
          const stop = track.stop.bind(track)
          track.stop = () => {
            state.cameraStops++
            stop()
          }
        }
        return stream
      },
    })
    HTMLMediaElement.prototype.play = async () => {}
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { get: () => 4 })
  }, token)
  let collections = 0
  await page.route(`**/api/v1/online-orders/requests/${id}/collect`, (route) => {
    collections++
    return route.fulfill({ status: 409, json: {} })
  })
  await openCollection(page)
  await page.getByRole('button', { name: 'Quét QR nhận món', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Mã xác thực khách hàng')).toHaveValue(token)
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { cameraStops: number }).cameraStops))
    .toBe(1)
  await dialog.getByLabel('Mã xác thực khách hàng').press('Enter')
  expect(collections).toBe(0)
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('pickup-scanned.png'), fullPage: true })
})

test('unsupported camera keeps manual pickup entry usable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'BarcodeDetector', { value: undefined })
  })
  await openCollection(page)
  await page.getByRole('button', { name: 'Quét QR nhận món', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('chưa hỗ trợ')
  await page.getByLabel('Mã xác thực khách hàng').fill(token)
  await expect(page.getByLabel('Mã xác thực khách hàng')).toHaveValue(token)
})

test('pending accepted items show awaiting preparation and render a nonblank private QR', async ({
  page,
}, info) => {
  await page.addInitScript(
    (access) => sessionStorage.setItem('coffee_shop_takeaway_order', JSON.stringify([access])),
    { requestId: id, accessToken: token },
  )
  await page.route('**/api/v1/online-orders/requests/status', (route) =>
    route.fulfill({
      json: envelope({
        ...created,
        status: 'ACCEPTED',
        fulfillmentStatus: 'PREPARING',
        pickupAt: '2099-01-01T10:00:00Z',
        isPaid: false,
        orderItems: [
          {
            id: itemId,
            menuItemId: itemId,
            quantity: 1,
            selectedOptions: [],
            serveStatus: 'PENDING',
            isPaid: false,
          },
        ],
      }),
    }),
  )
  await page.goto('/order')
  await expect(page.getByText('Đã xác nhận, chờ chế biến', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Hiện QR nhận món', exact: true }).click()
  const qr = page.getByRole('img', { name: 'Mã QR nhận hàng' })
  await expect(qr).toBeVisible()
  await expect
    .poll(() =>
      qr.evaluate((element: HTMLCanvasElement) => {
        const pixels = element
          .getContext('2d')!
          .getImageData(0, 0, element.width, element.height).data
        let black = 0
        let white = 0
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3] === 255 && pixels[i] === 0) black++
          if (pixels[i + 3] === 255 && pixels[i] === 255) white++
        }
        return black > 1000 && white > 1000
      }),
    )
    .toBe(true)
  await page.screenshot({ path: info.outputPath('pickup-private-qr.png'), fullPage: true })
})
