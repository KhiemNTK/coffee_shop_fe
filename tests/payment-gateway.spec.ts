import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const now = new Date('2026-10-04T08:00:00Z')
const sessionId = '60000000-0000-4000-8000-000000000001'
const menuId = '60000000-0000-4000-8000-000000000002'
const itemId = '60000000-0000-4000-8000-000000000003'
const invoice = { id: 'invoice-gateway', invoiceNumber: 'GATEWAY-001', subTotal: '35000',
  discountAmount: '0', taxAmount: '0', taxRate: '0', totalAmount: '35000', paymentMethod: 'TRANSFER',
  paymentStatus: 'UNPAID', createdAt: now.toISOString(), updatedAt: now.toISOString(),
  orderSessionId: sessionId, employeeId: defaultMockAdminEmployee.id, orderItems: [] }
const attempt = { id: 'attempt-gateway', invoiceId: invoice.id, provider: 'VNPAY', amount: '35000',
  merchantReference: 'PA-GATEWAY', status: 'PENDING', providerCreatedAt: now.toISOString(),
  expiresAt: new Date(now.getTime() + 900_000).toISOString(), createdAt: now.toISOString(), updatedAt: now.toISOString() }
const link = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=PA-GATEWAY'
const permissions = ['/invoices_read', '/invoices_create', '/payment-attempts_read', '/payment-attempts_create', '/orders_sessions_read']
const paged = (list: unknown[]) => ({ list, totalItems: list.length, totalPages: 1, currentPage: 1 })

async function setup(page: Page, options: {
  permissions?: string[]; configured?: boolean; attempts?: () => unknown[]; paid?: () => boolean
} = {}) {
  await page.clock.install({ time: now })
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: envelope(defaultMockAdminEmployee) }))
  await page.route('**/api/v1/auth/me/permissions', route => route.fulfill({ json: envelope(defaultMockAdminAuth(options.permissions ?? permissions)) }))
  await page.route('**/api/v1/payments/providers', route => route.fulfill({ json: envelope([
    { provider: 'VNPAY', configured: options.configured ?? true }, { provider: 'MOMO', configured: options.configured ?? true },
  ]) }))
  await page.route('**/api/v1/invoices?*', route => route.fulfill({ json: envelope(paged([invoice])) }))
  await page.route('**/api/v1/invoices/invoice-gateway', route => route.fulfill({ json: envelope({
    ...invoice, paymentStatus: options.paid?.() ? 'PAID' : 'UNPAID',
  }) }))
  await page.route('**/api/v1/invoices/invoice-gateway/payment-attempts', route => route.fulfill({ json: envelope(paged(options.attempts?.() ?? [])) }))
}

async function openGateway(page: Page) {
  await page.goto('/staff/invoices')
  await page.getByTitle('Xem chi tiết & Thanh toán').click()
  await page.getByRole('button', { name: 'Cổng thanh toán (VNPay / MoMo)', exact: true }).click()
}

test('created link survives reads without paymentUrl and paid UI waits for the invoice', async ({ page }, info) => {
  let created = false
  let paid = false
  let status = 'PENDING'
  await setup(page, { attempts: () => created ? [{ ...attempt, status }] : [], paid: () => paid })
  await page.route('**/api/v1/invoices/invoice-gateway/payment-attempts', route => {
    if (route.request().method() === 'GET') return route.fallback()
    created = true
    return route.fulfill({ json: envelope({ ...attempt, paymentUrl: link }) })
  })
  await openGateway(page)
  await page.getByRole('button', { name: 'Tạo phiên VNPAY', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Mở thanh toán VNPAY' })).toHaveAttribute('href', link)
  const qr = page.getByRole('img', { name: 'Mã QR thanh toán' })
  await expect(qr).toBeVisible()
  await expect.poll(() => qr.evaluate(canvas => {
    const pixels = (canvas as HTMLCanvasElement).getContext('2d')!.getImageData(0, 0, 220, 220).data
    let dark = 0
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i]! < 100 && pixels[i + 3]! > 0) dark++
    return dark
  })).toBeGreaterThan(100)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await qr.scrollIntoViewIfNeeded()
  await page.getByRole('link', { name: 'Mở thanh toán VNPAY' }).scrollIntoViewIfNeeded()
  await expect(qr).toBeInViewport({ ratio: 1 })
  await expect(page.getByRole('link', { name: 'Mở thanh toán VNPAY' })).toBeInViewport({ ratio: 1 })
  await page.screenshot({ path: info.outputPath('payment-gateway.png') })
  status = 'SUCCEEDED'
  await page.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Mở thanh toán VNPAY' })).toHaveCount(0)
  await expect(page.getByText('Tổng hóa đơn:', { exact: false })).toContainText('Chờ thanh toán')
  paid = true
  await page.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true }).click()
  await expect(page.getByText('Tổng hóa đơn:', { exact: false })).toContainText('Đã thanh toán')
})

test('unresolved online attempt blocks manual collection and invoice cancellation', async ({ page }) => {
  await setup(page, { permissions: [...permissions, '/invoices_update'], attempts: () => [{ ...attempt, status: 'REQUIRES_REVIEW' }] })
  await page.goto('/staff/invoices')
  await page.getByTitle('Xem chi tiết & Thanh toán').click()
  await page.getByRole('button', { name: 'Xác nhận tiền mặt / Thẻ', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Xác nhận đã thanh toán/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Hủy hóa đơn', exact: true })).toBeDisabled()
})

test('uncertain manual collection keeps the original method and tender', async ({ page }) => {
  const bodies: Record<string, unknown>[] = []
  let paid = false
  await setup(page, { permissions: [...permissions, '/invoices_update'], paid: () => paid })
  await page.route('**/api/v1/invoices/invoice-gateway/payment', route => {
    bodies.push(route.request().postDataJSON())
    if (bodies.length === 1) return route.abort()
    paid = true
    return route.fulfill({ json: envelope({ ...invoice, paymentStatus: 'PAID', paymentMethod: 'CASH' }) })
  })
  await page.goto('/staff/invoices')
  await page.getByTitle('Xem chi tiết & Thanh toán').click()
  await page.getByRole('button', { name: 'Xác nhận tiền mặt / Thẻ', exact: true }).click()
  await page.getByLabel('Số tiền khách đưa (VND)').fill('50000')
  await page.getByRole('button', { name: /^Xác nhận đã thanh toán/ }).click()
  await expect(page.getByRole('alert')).toContainText('Không thể kết nối')
  await expect(page.getByLabel('Số tiền khách đưa (VND)')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Quẹt thẻ POS', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Đóng', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Kiểm tra lại lần thu tiền', exact: true }).click()
  expect(bodies).toHaveLength(2)
  expect(bodies[1]).toEqual(bodies[0])
  expect(bodies[1]).toMatchObject({ amountTendered: '50000', paymentMethod: 'CASH' })
})

test('a paid invoice read releases an uncertain manual collection without another write', async ({ page }) => {
  let paid = false
  let writes = 0
  await setup(page, { permissions: [...permissions, '/invoices_update'], paid: () => paid })
  await page.route('**/api/v1/invoices/invoice-gateway/payment', route => {
    writes++
    paid = true
    return route.abort()
  })
  await page.goto('/staff/invoices')
  await page.getByTitle('Xem chi tiết & Thanh toán').click()
  await page.getByRole('button', { name: 'Xác nhận tiền mặt / Thẻ', exact: true }).click()
  await page.getByLabel('Số tiền khách đưa (VND)').fill('50000')
  await page.getByRole('button', { name: /^Xác nhận đã thanh toán/ }).click()
  await expect(page.getByRole('dialog').getByText('Đã thanh toán', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Đóng', exact: true }).last()).toBeEnabled()
  await page.getByRole('button', { name: 'Đóng', exact: true }).last().click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(writes).toBe(1)
})

test('uncertain creation freezes provider and retry reuses the same key', async ({ page }) => {
  const bodies: Record<string, unknown>[] = []
  await setup(page)
  await page.route('**/api/v1/invoices/invoice-gateway/payment-attempts', route => {
    if (route.request().method() === 'GET') return route.fallback()
    bodies.push(route.request().postDataJSON())
    return bodies.length === 1 ? route.abort() : route.fulfill({ json: envelope({ ...attempt, paymentUrl: link }) })
  })
  await openGateway(page)
  await page.getByRole('button', { name: 'Tạo phiên VNPAY', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Chưa xác nhận được' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'MoMo', exact: true })).toBeDisabled()
  expect(bodies).toHaveLength(1)
  await page.getByRole('button', { name: 'Kiểm tra lại lần tạo phiên', exact: true }).click()
  await expect.poll(() => bodies.length).toBe(2)
  expect(bodies[1]).toEqual(bodies[0])
  await expect(page.getByRole('link', { name: 'Mở thanh toán VNPAY' })).toBeVisible()
})

test('missing configuration and permissions do not expose unsafe commands', async ({ page }) => {
  await setup(page, { configured: false })
  await openGateway(page)
  await expect(page.getByRole('button', { name: 'Tạo phiên thanh toán', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'MoMo', exact: true })).toBeDisabled()
  await expect(page.getByRole('status').filter({ hasText: 'Chưa cấu hình' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Xác nhận tiền mặt / Thẻ', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Đối soát/ })).toHaveCount(0)
})

test('expired URL disappears on time without creating a replacement', async ({ page }) => {
  const expiring = { ...attempt, expiresAt: new Date(now.getTime() + 60_000).toISOString() }
  let created = false
  let posts = 0
  await setup(page, { attempts: () => created ? [expiring] : [] })
  await page.route('**/api/v1/invoices/invoice-gateway/payment-attempts', route => {
    if (route.request().method() === 'GET') return route.fallback()
    posts++; created = true
    return route.fulfill({ json: envelope({ ...expiring, paymentUrl: link }) })
  })
  await openGateway(page)
  await page.getByRole('button', { name: 'Tạo phiên VNPAY', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Mở thanh toán VNPAY' })).toBeVisible()
  await page.clock.fastForward(65_000)
  await expect(page.getByRole('link', { name: 'Mở thanh toán VNPAY' })).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'Liên kết đã hết hạn' })).toBeVisible()
  expect(posts).toBe(1)
})

test('MoMo creation has a 35 second budget without changing default GET deadlines', async ({ page }) => {
  await setup(page)
  await page.route('**/api/v1/invoices/invoice-gateway/payment-attempts', route => route.request().method() === 'GET'
    ? route.fallback() : route.fulfill({ json: envelope({ ...attempt, provider: 'MOMO', paymentUrl: 'https://test-payment.momo.vn/v2/gateway/pay?orderId=test' }) }))
  await openGateway(page)
  await page.evaluate(() => {
    const original = AbortSignal.timeout
    ;(window as unknown as { budgets: number[] }).budgets = []
    AbortSignal.timeout = function (milliseconds) {
      ;(window as unknown as { budgets: number[] }).budgets.push(milliseconds)
      return original.call(AbortSignal, milliseconds)
    }
  })
  await page.getByRole('button', { name: 'MoMo', exact: true }).click()
  await page.getByRole('button', { name: 'Tạo phiên MOMO', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Mở thanh toán MOMO' })).toBeVisible()
  const budgets = await page.evaluate(() => (window as unknown as { budgets: number[] }).budgets)
  expect(budgets).toContain(35000)
  expect(budgets).toContain(10000)
})

test('unsafe gateway URL is rejected before link or QR rendering', async ({ page }) => {
  await setup(page)
  await page.route('**/api/v1/invoices/invoice-gateway/payment-attempts', route => route.request().method() === 'GET'
    ? route.fallback() : route.fulfill({ json: envelope({ ...attempt, paymentUrl: 'javascript:alert(1)' }) }))
  await openGateway(page)
  await page.getByRole('button', { name: 'Tạo phiên VNPAY', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Phản hồi không hợp lệ')
  await expect(page.getByRole('link', { name: /^Mở thanh toán/ })).toHaveCount(0)
  await expect(page.getByRole('img', { name: 'Mã QR thanh toán' })).toHaveCount(0)
})

async function openPos(page: Page) {
  await page.route('**/api/v1/orders/sessions/' + sessionId, route => route.fulfill({ json: envelope({
    id: sessionId, sessionStatus: 'ACTIVE', guestCount: null, table: null, employee: defaultMockAdminEmployee,
    createdAt: now.toISOString(), orderItems: [{ id: itemId, quantity: 1, priceAtTime: '35000', serveStatus: 'READY',
      isPaid: false, menuItem: { id: menuId, name: 'Coffee gateway', price: '35000' } }],
  }) }))
  await page.route('**/api/v1/menu/public/categories', route => route.fulfill({ json: envelope([]) }))
  await page.route('**/api/v1/menu/public/items?*', route => route.fulfill({ json: envelope(paged([])) }))
  await page.route('**/api/v1/recommendations/pos/*', route => route.fulfill({ json: envelope({ recommendations: [] }) }))
  await page.goto('/staff/pos/sessions/' + sessionId)
  await page.getByRole('button', { name: /^Thanh toán \(/ }).first().click()
}

test('POS reuses the gateway panel after reviewing an actual invoice', async ({ page }) => {
  let posts = 0
  await setup(page)
  await page.route('**/api/v1/invoices?*', route => route.fulfill({ json: envelope(paged([{ ...invoice, orderItems: [{ id: itemId, quantity: 1, priceAtTime: '35000' }] }])) }))
  await page.route('**/api/v1/invoices/invoice-gateway/payment-attempts', route => {
    if (route.request().method() === 'GET') return route.fallback()
    posts++
    return route.fulfill({ json: envelope({ ...attempt, paymentUrl: link }) })
  })
  await openPos(page)
  await page.getByRole('button', { name: 'Quét mã QR', exact: true }).click()
  await page.getByRole('button', { name: 'Kiểm tra hóa đơn trước khi tạo QR', exact: true }).click()
  await expect(page.getByText('Tổng hóa đơn:', { exact: false })).toContainText('35.000')
  expect(posts).toBe(0)
  await page.getByRole('button', { name: 'Tạo phiên VNPAY', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Mở thanh toán VNPAY' })).toBeVisible()
  expect(posts).toBe(1)
})

test('uncertain POS cash checkout cannot change its tender or method', async ({ page }) => {
  const bodies: Record<string, unknown>[] = []
  await setup(page, { permissions: ['/invoices_create', '/orders_sessions_read'] })
  await page.route('**/api/v1/invoices/checkout', route => {
    bodies.push(route.request().postDataJSON())
    return bodies.length === 1 ? route.abort() : route.fulfill({ json: envelope({
      ...invoice, id: '60000000-0000-4000-8000-000000000004', paymentStatus: 'PAID', paymentMethod: 'CASH',
    }) })
  })
  await openPos(page)
  await expect(page.getByRole('button', { name: 'Quét mã QR', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Xác nhận thanh toán tiền mặt', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByLabel('Khách đưa (₫)')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Quẹt thẻ POS', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Kiểm tra lại thanh toán tiền mặt', exact: true }).click()
  await expect.poll(() => bodies.length).toBe(2)
  expect(bodies[1]).toEqual(bodies[0])
})
