import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const sessionId = '92000000-0000-4000-8000-000000000001'
const itemId = '92000000-0000-4000-8000-000000000002'
const invoiceId = '92000000-0000-4000-8000-000000000003'
const date = '2026-10-24T08:00:00Z'
const paged = (list: unknown[]) => ({
  list,
  totalItems: list.length,
  totalPages: 1,
  currentPage: 1,
})
const line = {
  id: itemId,
  quantity: 2,
  priceAtTime: '25000',
  selectedOptions: [],
  serveStatus: 'SERVED',
  isPaid: false,
  menuItem: { id: itemId, name: 'Coffee', price: '25000' },
}
const bill = {
  id: invoiceId,
  invoiceNumber: 'RECOVERY-001',
  orderSessionId: sessionId,
  subTotal: '50000',
  totalAmount: '50000',
  discountAmount: '0',
  taxAmount: '0',
  taxRate: '0',
  paymentMethod: 'CASH',
  paymentStatus: 'PAID',
  amountTendered: '60000',
  changeAmount: '10000',
  createdAt: date,
  updatedAt: date,
  employeeId: defaultMockAdminEmployee.id,
  orderItems: [line],
}

async function setup(page: Page) {
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({ status: 503, json: { message: 'Unmocked API' } })
  )
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminEmployee) })
  )
  await page.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill({
      json: envelope(
        defaultMockAdminAuth([
          '/orders_sessions_read',
          '/invoices_create',
          '/invoices_pay',
          '/invoices_read',
          '/invoices_void',
        ])
      ),
    })
  )
  await page.route('**/api/v1/menu/public/categories', (route) =>
    route.fulfill({ json: envelope([]) })
  )
  await page.route('**/api/v1/menu/public/items?*', (route) =>
    route.fulfill({ json: envelope(paged([])) })
  )
  await page.route('**/api/v1/recommendations/pos/*', (route) =>
    route.fulfill({ json: envelope({ recommendations: [] }) })
  )
  await page.route(`**/api/v1/orders/sessions/${sessionId}`, (route) =>
    route.fulfill({
      json: envelope({
        id: sessionId,
        sessionStatus: 'ACTIVE',
        createdAt: date,
        table: null,
        employee: defaultMockAdminEmployee,
        orderItems: [line],
      }),
    })
  )
  await page.route('**/api/v1/invoices/quote', (route) =>
    route.fulfill({
      json: envelope({
        orderItemIds: [itemId],
        subTotal: '50000',
        totalAmount: '50000',
        discountAmount: '0',
        taxAmount: '0',
        quoteFingerprint: 'a'.repeat(64),
      }),
    })
  )
}

test('reload restores the exact cash command even when the server already completed the session', async ({
  page,
}, info) => {
  await setup(page)
  const writes: Record<string, unknown>[] = []
  await page.route('**/api/v1/invoices/checkout', (route) => {
    writes.push(route.request().postDataJSON())
    return writes.length === 1 ? route.abort() : route.fulfill({ json: envelope(bill) })
  })
  await page.goto(`/staff/pos/sessions/${sessionId}`)
  await page
    .getByRole('button', { name: /^Thanh toán \(/ })
    .first()
    .click()
  await page.getByLabel('Khách đưa (₫)').fill('60000')
  await page.getByRole('button', { name: 'Xác nhận thanh toán tiền mặt', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.route(`**/api/v1/orders/sessions/${sessionId}`, (route) =>
    route.fulfill({
      json: envelope({
        id: sessionId,
        sessionStatus: 'COMPLETED',
        createdAt: date,
        table: null,
        employee: defaultMockAdminEmployee,
        orderItems: [{ ...line, isPaid: true, invoiceId }],
      }),
    })
  )
  await page.reload()
  await page.getByRole('button', { name: 'Khôi phục thanh toán', exact: true }).click()
  await expect(page.getByLabel('Khách đưa (₫)')).toHaveValue('60000')
  await expect(page.getByLabel('Khách đưa (₫)')).toBeDisabled()
  expect(writes).toHaveLength(1)
  await page.getByRole('button', { name: 'Kiểm tra lại thanh toán tiền mặt', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Thanh toán thành công!' })).toBeVisible()
  expect(writes).toHaveLength(2)
  expect(writes[1]).toEqual(writes[0])
  expect(writes[0]).toMatchObject({
    amountTendered: '60000',
    expectedTotal: '50000',
    quoteFingerprint: 'a'.repeat(64),
  })
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter((key) => key.includes('invoice.checkout:'))
    )
  ).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('cash-recovered.png') })
})

test('an uncertain checkout stays frozen after a 409 replay response', async ({ page }) => {
  await setup(page)
  const writes: Record<string, unknown>[] = []
  await page.route('**/api/v1/invoices/checkout', (route) => {
    writes.push(route.request().postDataJSON())
    return writes.length === 1
      ? route.abort()
      : route.fulfill({
          status: 409,
          json: { code: 'IDEMPOTENCY_IN_PROGRESS', message: 'Original command is still running' },
        })
  })
  await page.goto(`/staff/pos/sessions/${sessionId}`)
  await page
    .getByRole('button', { name: /^Thanh toán \(/ })
    .first()
    .click()
  await page.getByRole('button', { name: 'Xác nhận thanh toán tiền mặt', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Khôi phục thanh toán', exact: true }).click()
  await page.getByRole('button', { name: 'Kiểm tra lại thanh toán tiền mặt', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  expect(writes).toHaveLength(2)
  expect(writes[1]).toEqual(writes[0])
  await expect(page.getByLabel('Khách đưa (₫)')).toBeDisabled()
  expect(
    await page.evaluate(
      () => Object.keys(sessionStorage).filter((key) => key.includes('invoice.checkout:')).length
    )
  ).toBe(1)
})

test('a changed quote requires review and never retries payment automatically', async ({
  page,
}) => {
  await setup(page)
  let writes = 0
  await page.route('**/api/v1/invoices/checkout', (route) => {
    writes++
    return route.fulfill({
      status: 409,
      json: { code: 'INVOICE_QUOTE_CHANGED', message: 'Review changed quote' },
    })
  })
  await page.goto(`/staff/pos/sessions/${sessionId}`)
  await page
    .getByRole('button', { name: /^Thanh toán \(/ })
    .first()
    .click()
  await page.getByRole('button', { name: 'Xác nhận thanh toán tiền mặt', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Xác nhận thanh toán tiền mặt', exact: true })
  ).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Xem lại đơn', exact: true })).toBeVisible()
  expect(writes).toBe(1)
  await page.getByRole('button', { name: 'Xem lại đơn', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter((key) => key.includes('invoice.checkout:'))
    )
  ).toEqual([])
})

test('voided invoices render the original document and require a cancellation reason', async ({
  page,
}, info) => {
  await setup(page)
  let reason = ''
  const snapshot = {
    version: 1,
    source: 'ISSUED',
    tableId: sessionId,
    tableName: 'Bàn ban đầu',
    issuedByName: 'Invoice issuer',
    promotionName: null,
    items: [
      {
        orderItemId: itemId,
        menuItemId: itemId,
        name: 'Cà phê ban đầu',
        quantity: 2,
        unitPrice: '25000.00',
        note: null,
        selectedOptions: [],
      },
    ],
  }
  const invoice = () => ({
    ...bill,
    paymentStatus: reason ? 'VOIDED' : 'UNPAID',
    documentSnapshot: snapshot,
    orderItems: reason ? [] : [line],
    orderSession: {
      id: sessionId,
      sessionStatus: 'ACTIVE',
      tableId: sessionId,
      table: { id: sessionId, name: 'Bàn mới', status: 'OCCUPIED' },
    },
  })
  await page.route('**/api/v1/invoices?*', (route) =>
    route.fulfill({ json: envelope(paged([invoice()])) })
  )
  await page.route(`**/api/v1/invoices/${invoiceId}`, (route) =>
    route.fulfill({ json: envelope(invoice()) })
  )
  await page.route(`**/api/v1/invoices/${invoiceId}/void`, (route) => {
    reason = route.request().postDataJSON().reason
    return route.fulfill({ json: envelope(invoice()) })
  })
  await page.goto('/staff/invoices')
  await page.getByRole('row', { name: 'Chi tiết hóa đơn RECOVERY-001', exact: true }).click()
  await expect(page.getByText('Cà phê ban đầu', { exact: true })).toBeVisible()
  await expect(page.getByRole('dialog').getByText('Bàn ban đầu', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Hủy hóa đơn', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Xác nhận hủy', exact: true })).toBeDisabled()
  await page.getByLabel('Lý do hủy hóa đơn').fill('Lập trùng hóa đơn')
  await page.getByRole('button', { name: 'Xác nhận hủy', exact: true }).click()
  await expect.poll(() => reason).toBe('Lập trùng hóa đơn')
  await expect(page.getByText('Cà phê ban đầu', { exact: true })).toBeVisible()
  await expect(page.getByRole('dialog').getByText('Đã hủy', { exact: true }).first()).toBeVisible()
  await page.screenshot({ path: info.outputPath('voided-document.png') })
})

for (const clipboardWorks of [true, false]) {
  test(`uncertain checkout shows a support ID with ${clipboardWorks ? 'clipboard copy' : 'a selectable fallback'}`, async ({
    page,
  }, info) => {
    await setup(page)
    await page.addInitScript((works) => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: (value: string) => {
            if (!works) return Promise.reject(new Error('Clipboard denied'))
            sessionStorage.setItem('copied-support-id', value)
            return Promise.resolve()
          },
        },
      })
    }, clipboardWorks)
    const supportId = 'checkout-request-12345678'
    await page.route('**/api/v1/invoices/checkout', (route) =>
      route.fulfill({
        status: 503,
        headers: { 'x-request-id': supportId },
        json: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Internal payment payload must not be shown',
        },
      })
    )
    await page.goto(`/staff/pos/sessions/${sessionId}`)
    await page
      .getByRole('button', { name: /^Thanh toán \(/ })
      .first()
      .click()
    await page.getByRole('button', { name: 'Xác nhận thanh toán tiền mặt', exact: true }).click()
    const alert = page.getByRole('alert').filter({ hasText: supportId })
    await expect(alert).toBeVisible()
    await expect(alert).not.toContainText('Internal payment payload')
    await alert.getByRole('button', { name: 'Sao chép mã hỗ trợ', exact: true }).click()
    await expect(alert.getByRole('status')).toHaveText(
      clipboardWorks
        ? 'Đã sao chép mã hỗ trợ.'
        : 'Chưa sao chép được. Bạn có thể chọn mã hỗ trợ để sao chép thủ công.'
    )
    if (clipboardWorks)
      expect(await page.evaluate(() => sessionStorage.getItem('copied-support-id'))).toBe(supportId)
    await expect(page.getByLabel('Khách đưa (₫)')).toBeDisabled()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath('checkout-support-id.png') })
  })
}

test('a rate-limited checkout waits and retries only on demand with the exact same payment command', async ({
  page,
}, info) => {
  await setup(page)
  const writes: Record<string, unknown>[] = []
  await page.route('**/api/v1/invoices/checkout', (route) => {
    writes.push(route.request().postDataJSON())
    return writes.length === 1
      ? route.fulfill({
          status: 429,
          headers: { 'Retry-After': '3' },
          json: { message: 'Rate limit' },
        })
      : route.fulfill({ json: envelope(bill) })
  })
  await page.goto(`/staff/pos/sessions/${sessionId}`)
  await page
    .getByRole('button', { name: /^Thanh toán \(/ })
    .first()
    .click()
  await expect(
    page.getByRole('button', { name: 'Xác nhận thanh toán tiền mặt', exact: true })
  ).toBeEnabled()
  await page.clock.install()
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  await page.getByRole('button', { name: 'Xác nhận thanh toán tiền mặt', exact: true }).click()
  const retry = page.getByRole('button', { name: 'Kiểm tra lại thanh toán tiền mặt', exact: true })
  await expect(page.getByRole('alert')).toContainText('Vui lòng chờ 3 giây')
  await expect(retry).toBeDisabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('rate-limited-checkout.png') })
  await page.clock.runFor(2000)
  await expect(retry).toBeDisabled()
  expect(writes).toHaveLength(1)
  await page.clock.runFor(1100)
  await expect(retry).toBeEnabled()
  expect(writes).toHaveLength(1)
  await retry.click()
  await expect(page.getByRole('heading', { name: 'Thanh toán thành công!' })).toBeVisible()
  expect(writes[1]).toEqual(writes[0])
})

test('Retry-After accepts bounded seconds and HTTP dates without scheduling automatic requests', async ({
  page,
}) => {
  await setup(page)
  await page.goto('/staff/invoices')
  await page.route('**/api/v1/retry-probe?*', (route) => {
    const value = new URL(route.request().url()).searchParams.get('value')!
    return route.fulfill({
      status: 429,
      headers: { 'Retry-After': value },
      json: { message: 'Too many requests' },
    })
  })
  const delays = await page.evaluate(async () => {
    const path = '/src/shared/api/client.ts'
    const { apiGet, ApiError } = await import(path)
    const schemaPath = '/src/features/menu/menu.api.ts'
    const { menuItemSchema } = await import(schemaPath)
    const now = Date.now()
    const values = [
      '10',
      new Date(now + 30_000).toUTCString(),
      '-5',
      'invalid',
      '9999999999999999999999999999999999999999999999',
    ]
    const result = []
    for (const value of values) {
      try {
        await apiGet(`/retry-probe?value=${encodeURIComponent(value)}`, menuItemSchema)
      } catch (error) {
        if (!(error instanceof ApiError)) throw error
        const retryAt = (error as { retryAt?: number }).retryAt
        result.push(retryAt ? retryAt - Date.now() : null)
      }
    }
    return result
  })
  expect(delays[0]).toBeGreaterThan(9000)
  expect(delays[1]).toBeGreaterThan(28_000)
  expect(delays.slice(2, 4)).toEqual([null, null])
  expect(delays[4]).toBeLessThanOrEqual(3_600_000)
})

test('money adapters keep a wide decimal string without rounding', async ({ page }) => {
  await setup(page)
  await page.goto('/staff/invoices')
  const value = await page.evaluate(async () => {
    const path = '/src/features/menu/menu.api.ts'
    const { moneySchema } = await import(path)
    return moneySchema.parse('9999999999999999.99')
  })
  expect(value).toBe('9999999999999999.99')
})
