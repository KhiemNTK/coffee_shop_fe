import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'
import { decimalAmount, minorAmount } from '../src/shared/lib/money.js'

const now = new Date('2026-10-04T08:00:00Z')
const sessionId = '60000000-0000-4000-8000-000000000001'
const menuId = '60000000-0000-4000-8000-000000000002'
const itemId = '60000000-0000-4000-8000-000000000003'
const invoice = {
  id: 'invoice-gateway',
  invoiceNumber: 'GATEWAY-001',
  subTotal: '35000',
  discountAmount: '0',
  taxAmount: '0',
  taxRate: '0',
  totalAmount: '35000',
  paymentMethod: 'TRANSFER',
  paymentStatus: 'UNPAID',
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  orderSessionId: sessionId,
  employeeId: defaultMockAdminEmployee.id,
  orderItems: [],
}
const attempt = {
  id: 'attempt-gateway',
  invoiceId: invoice.id,
  provider: 'VNPAY',
  amount: '35000',
  merchantReference: 'PA-GATEWAY',
  status: 'PENDING',
  providerCreatedAt: now.toISOString(),
  expiresAt: new Date(now.getTime() + 900_000).toISOString(),
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
}
const link = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=PA-GATEWAY'
const permissions = [
  '/invoices_read',
  '/invoices_create', '/invoices_pay',
  '/payment-attempts_read',
  '/payment-attempts_create',
  '/orders_sessions_read',
]
const paged = (list: unknown[]) => ({
  list,
  totalItems: list.length,
  totalPages: 1,
  currentPage: 1,
})

for (const result of [
  { name: 'confirmed', status: 'SUCCEEDED', signatureValid: true, message: 'Server đã ghi nhận thanh toán thành công.' },
  { name: 'review', status: 'REQUIRES_REVIEW', signatureValid: true, message: 'Giao dịch cần được cửa hàng đối soát.' },
  { name: 'unverified', status: 'SUCCEEDED', signatureValid: false, message: 'Không xác minh được liên kết thanh toán.' },
]) {
  test(`payment result presentation stays authoritative for ${result.name}`, async ({ page }, info) => {
    await page.addInitScript(() => localStorage.setItem('coffee_theme', 'dark'))
    if (info.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 844 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const methods: string[] = []
    await page.route('**/api/v1/payments/momo/return*', (route) => {
      methods.push(route.request().method())
      return route.fulfill({ json: envelope({ signatureValid: result.signatureValid, attempt: { id: attempt.id, invoiceId: invoice.id, status: result.status } }) })
    })
    await page.goto('/payment/momo/return?resultCode=0')
    await expect(page.getByRole('heading', { name: 'Kết quả thanh toán' })).toBeVisible()
    await expect(page.getByRole('status')).toHaveText(result.message)
    if (!result.signatureValid) await expect(page.getByText('Server đã ghi nhận thanh toán thành công.')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Về thực đơn' })).toHaveAttribute('href', '/menu')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true }).focus()
    await expect(page.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true })).toBeFocused()
    await page.screenshot({ path: info.outputPath(`payment-result-${result.name}.png`) })
    expect(methods.every((method) => method === 'GET')).toBe(true)
  })
}

async function setup(
  page: Page,
  options: {
    permissions?: string[]
    configured?: boolean
    attempts?: () => unknown[]
    paid?: () => boolean
    paymentMethod?: () => string
  } = {}
) {
  await page.clock.install({ time: now })
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminEmployee) })
  )
  await page.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminAuth(options.permissions ?? permissions)) })
  )
  await page.route('**/api/v1/payments/providers', (route) =>
    route.fulfill({
      json: envelope([
        { provider: 'VNPAY', configured: options.configured ?? true },
        { provider: 'MOMO', configured: options.configured ?? true },
      ]),
    })
  )
  await page.route('**/api/v1/invoices?*', (route) =>
    route.fulfill({ json: envelope(paged([invoice])) })
  )
  await page.route('**/api/v1/invoices/invoice-gateway', (route) =>
    route.fulfill({
      json: envelope({
        ...invoice,
        paymentStatus: options.paid?.() ? 'PAID' : 'UNPAID',
        paymentMethod: options.paymentMethod?.() ?? invoice.paymentMethod,
      }),
    })
  )
  await page.route('**/api/v1/invoices/invoice-gateway/payment-attempts', (route) =>
    route.fulfill({ json: envelope(paged(options.attempts?.() ?? [])) })
  )
}

async function openGateway(page: Page) {
  await page.goto('/staff/invoices')
  await page.getByTitle('Xem chi tiết & Thanh toán').click()
  await page
    .getByRole('button', { name: 'Cổng thanh toán (VNPay / MoMo / payOS)', exact: true })
    .click()
}

async function mockAudio(page: Page) {
  await page.addInitScript(() => {
    const stats = { contexts: 0, plays: 0, disconnected: 0 }
    class FixtureAudio {
      state = 'running'
      currentTime = 0
      destination = {}
      constructor() { stats.contexts++ }
      resume() { return Promise.resolve() }
      createOscillator() {
        const oscillator = {
          type: 'sine',
          frequency: { setValueAtTime() {} },
          onended: null as (() => void) | null,
          connect() {},
          disconnect() { stats.disconnected++ },
          start() { stats.plays++ },
          stop() { oscillator.onended?.() },
        }
        return oscillator
      }
      createGain() {
        return {
          gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() {},
          disconnect() { stats.disconnected++ },
        }
      }
    }
    Object.assign(window, { AudioContext: FixtureAudio, audioFixture: stats })
  })
}

for (const paymentMethod of ['TRANSFER', 'CASH']) {
  test(`payment sound only announces a confirmed transfer, not ${paymentMethod === 'CASH' ? 'cash settlement' : 'repeated invoice reads'}`, async ({ page }) => {
    let paid = false
    await setup(page, { paid: () => paid, paymentMethod: () => paymentMethod })
    await mockAudio(page)
    await openGateway(page)
    await page.getByRole('button', { name: 'Bật và thử âm báo thanh toán' }).click()
    const plays = () => page.evaluate(() => Reflect.get(window, 'audioFixture').plays as number)
    await expect.poll(plays).toBe(1)
    await page.getByRole('button', { name: /^Chi tiết món/ }).click()
    await page.getByRole('button', { name: 'Cổng thanh toán (VNPay / MoMo / payOS)', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Tắt âm báo thanh toán' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true })).toBeEnabled()
    paid = true
    await page.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true }).click()
    await expect(page.getByRole('group', { name: 'Tổng quan thanh toán', exact: true })).toContainText('Đã thanh toán')
    await expect.poll(plays).toBe(paymentMethod === 'TRANSFER' ? 2 : 1)
    await page.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true })).toBeEnabled()
    expect(await plays()).toBe(paymentMethod === 'TRANSFER' ? 2 : 1)
    expect(await page.evaluate(() => Reflect.get(window, 'audioFixture').contexts)).toBe(1)
    expect(await page.evaluate(() => Reflect.get(window, 'audioFixture').disconnected)).toBe((await plays()) * 2)
  })
}

test('enabling payment sound does not replay an invoice paid while muted', async ({ page }) => {
  let paid = false
  await setup(page, { paid: () => paid })
  await mockAudio(page)
  await openGateway(page)
  paid = true
  await page.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Tổng quan thanh toán', exact: true })).toContainText('Đã thanh toán')
  expect(await page.evaluate(() => Reflect.get(window, 'audioFixture').plays)).toBe(0)
  await page.getByRole('button', { name: 'Bật và thử âm báo thanh toán' }).click()
  await expect(page.getByRole('button', { name: 'Tắt âm báo thanh toán' })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => Reflect.get(window, 'audioFixture').plays)).toBe(1)
  await page.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true })).toBeEnabled()
  expect(await page.evaluate(() => Reflect.get(window, 'audioFixture').plays)).toBe(1)
})

test('unsupported audio leaves payment controls available and reports the fallback', async ({ page }) => {
  await setup(page)
  await page.addInitScript(() => {
    Object.assign(window, { AudioContext: class { constructor() { throw new Error('Audio unavailable') } } })
  })
  await openGateway(page)
  await page.getByRole('button', { name: 'Bật và thử âm báo thanh toán' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Chưa phát được âm thanh' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tạo phiên VNPAY', exact: true })).toBeEnabled()
})

for (const allowed of ['pay', 'void', 'legacy'] as const) {
  test(`permission workflow separates invoice ${allowed} access`, async ({ page }) => {
    const permission = allowed === 'pay' ? '/invoices_pay' : allowed === 'void' ? '/invoices_void' : '/invoices_update'
    await setup(page, { permissions: ['/invoices_read', permission] })
    await page.goto('/staff/invoices')
    await page.getByTitle('Xem chi tiết & Thanh toán').click()
    await expect(page.getByRole('dialog').getByRole('heading', { name: `Hóa đơn #${invoice.invoiceNumber}`, exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Xác nhận tiền mặt / Thẻ', exact: true })).toHaveCount(allowed === 'pay' ? 1 : 0)
    await expect(page.getByRole('button', { name: 'Hủy hóa đơn', exact: true })).toHaveCount(allowed === 'void' ? 1 : 0)
  })
}

test('payOS uses the shared gateway, preserves the link across reload, and stays within mobile bounds', async ({
  page,
}, info) => {
  let created = false
  let creations = 0
  let recoveries = 0
  await page.addInitScript(() => localStorage.setItem('coffee_theme', 'dark'))
  const payosLink = `https://pay.payos.vn/web/${'a'.repeat(32)}`
  const payosAttempt = { ...attempt, provider: 'PAYOS', merchantReference: '1000000000' }
  if (info.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 844 })
  await setup(page, { attempts: () => (created ? [payosAttempt] : []) })
  await page.route('**/api/v1/payments/providers', (route) =>
    route.fulfill({
      json: envelope([
        { provider: 'VNPAY', configured: false },
        { provider: 'MOMO', configured: false },
        { provider: 'PAYOS', configured: true },
      ]),
    })
  )
  await page.route('**/api/v1/invoices/invoice-gateway/payment-attempts', (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({ json: envelope(paged(created ? [payosAttempt] : [])) })
    creations++
    expect(route.request().postDataJSON().provider).toBe('PAYOS')
    created = true
    return route.fulfill({ json: envelope({ ...payosAttempt, paymentUrl: payosLink }) })
  })
  await page.route('**/api/v1/payment-attempts/attempt-gateway/payment-link', (route) => {
    recoveries++
    return route.fulfill({ json: envelope({ ...payosAttempt, paymentUrl: payosLink }) })
  })
  await openGateway(page)
  await expect(page.getByRole('button', { name: 'VNPay', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'payOS', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await expect(page.getByRole('button', { name: 'payOS', exact: true })).toBeEnabled()
  expect(
    await page.getByRole('group', { name: 'Chọn cổng thanh toán' }).evaluate((element) =>
      [...element.querySelectorAll('button')].every((button) =>
        button.scrollWidth <= button.clientWidth && button.scrollHeight <= button.clientHeight))
  ).toBe(true)
  await page.screenshot({ path: info.outputPath('payos-provider-options.png') })
  await page.getByRole('button', { name: 'Tạo phiên PAYOS', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Mở thanh toán payOS' })).toHaveAttribute(
    'href',
    payosLink
  )
  await page.reload()
  await page.getByTitle('Xem chi tiết & Thanh toán').click()
  await page
    .getByRole('button', { name: 'Cổng thanh toán (VNPay / MoMo / payOS)', exact: true })
    .click()
  await page.getByRole('button', { name: 'Mở lại QR thanh toán', exact: true }).click()
  const paymentLink = page.getByRole('link', { name: 'Mở thanh toán payOS' })
  await expect(paymentLink).toHaveAttribute('href', payosLink)
  await paymentLink.scrollIntoViewIfNeeded()
  await expect(paymentLink).toBeInViewport({ ratio: 1 })
  const qr = page.getByRole('img', { name: 'Mã QR mở trang thanh toán', exact: true })
  await expect(qr).toBeVisible()
  const qrBounds = await qr.boundingBox()
  expect(Math.abs(qrBounds!.width - qrBounds!.height)).toBeLessThan(1)
  await expect.poll(() => qr.evaluate((node) => Array.from((node as HTMLCanvasElement)
    .getContext('2d')!.getImageData(0, 0, 1, 1).data))).toEqual([255, 255, 255, 255])
  await expect(page.getByText('Đây là QR liên kết', { exact: false })).toBeVisible()
  expect({ creations, recoveries }).toEqual({ creations: 1, recoveries: 1 })
  await expect(page.getByRole('group', { name: 'Chọn cổng thanh toán' })).toHaveCount(0)
  await qr.scrollIntoViewIfNeeded()
  await expect(qr).toBeInViewport({ ratio: 1 })
  await qr.locator('..').scrollIntoViewIfNeeded()
  await expect.poll(() => qr.locator('..').evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return [rect.top + 2, rect.bottom - 2].every((y) => element.contains(document.elementFromPoint(rect.left + rect.width / 2, y)))
  })).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('payos-gateway.png') })
})

test('created link survives reads without paymentUrl and paid UI waits for the invoice', async ({
  page,
}, info) => {
  let created = false
  let paid = false
  let status = 'PENDING'
  await setup(page, { attempts: () => (created ? [{ ...attempt, status }] : []), paid: () => paid })
  await page.route('**/api/v1/invoices/invoice-gateway/payment-attempts', (route) => {
    if (route.request().method() === 'GET') return route.fallback()
    created = true
    return route.fulfill({ json: envelope({ ...attempt, paymentUrl: link }) })
  })
  await openGateway(page)
  await page.getByRole('button', { name: 'Tạo phiên VNPAY', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Mở thanh toán VNPay' })).toHaveAttribute(
    'href',
    link
  )
  const qr = page.getByRole('img', { name: 'Mã QR mở trang thanh toán' })
  await expect(qr).toBeVisible()
  await expect
    .poll(() =>
      qr.evaluate((canvas) => {
        const pixels = (canvas as HTMLCanvasElement)
          .getContext('2d')!
          .getImageData(0, 0, 220, 220).data
        let dark = 0
        for (let i = 0; i < pixels.length; i += 4)
          if (pixels[i]! < 100 && pixels[i + 3]! > 0) dark++
        return dark
      })
    )
    .toBeGreaterThan(100)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await qr.scrollIntoViewIfNeeded()
  await page.getByRole('link', { name: 'Mở thanh toán VNPay' }).scrollIntoViewIfNeeded()
  await expect(qr).toBeInViewport({ ratio: 1 })
  await expect(page.getByRole('link', { name: 'Mở thanh toán VNPay' })).toBeInViewport({ ratio: 1 })
  await page.screenshot({ path: info.outputPath('payment-gateway.png') })
  status = 'SUCCEEDED'
  await page.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Mở thanh toán VNPay' })).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Tổng quan thanh toán', exact: true })).toContainText('Chờ thanh toán')
  paid = true
  await page.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Tổng quan thanh toán', exact: true })).toContainText('Đã thanh toán')
})

for (const status of ['PENDING', 'EXPIRED', 'REQUIRES_REVIEW']) {
  test(`${status} blocks manual collection and invoice cancellation`, async ({ page }) => {
    await setup(page, {
      permissions: [...permissions, '/invoices_void'],
      attempts: () => [{ ...attempt, status }],
    })
    await page.goto('/staff/invoices')
    await page.getByTitle('Xem chi tiết & Thanh toán').click()
    await page.getByRole('button', { name: 'Xác nhận tiền mặt / Thẻ', exact: true }).click()
    await expect(page.getByRole('button', { name: /^Xác nhận đã thanh toán/ })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Hủy hóa đơn', exact: true })).toBeDisabled()
  })
}

test('an expired attempt offers reconciliation instead of a second payment', async ({ page }) => {
  await setup(page, {
    permissions: [...permissions, '/payment-reconciliation_manage'],
    attempts: () => [{ ...attempt, status: 'EXPIRED' }],
  })
  await openGateway(page)
  await expect(page.getByRole('button', { name: 'Tạo phiên VNPAY', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Đối soát VNPay', exact: true })).toBeEnabled()
  await expect(page.getByRole('link', { name: /^Mở thanh toán/ })).toHaveCount(0)
})

test('an unknown refund freezes the intent and replays the original key', async ({ page }) => {
  const bodies: Record<string, unknown>[] = []
  const refund = {
    id: 'refund-1',
    paymentAttemptId: attempt.id,
    amount: '10000.25',
    reason: 'Customer refund',
    status: 'SUCCEEDED',
    type: 'PARTIAL',
    createdAt: now.toISOString(),
  }
  await setup(page, {
    permissions: [...permissions, '/payment-refunds_read', '/payment-refunds_create'],
    paid: () => true,
    attempts: () => [{ ...attempt, status: 'SUCCEEDED' }],
  })
  await page.route('**/api/v1/payment-attempts/attempt-gateway/refunds?*', (route) =>
    route.fulfill({ json: envelope(paged([])) })
  )
  await page.route('**/api/v1/payment-attempts/attempt-gateway/refunds', (route) => {
    bodies.push(route.request().postDataJSON())
    return bodies.length === 1 ? route.abort() : route.fulfill({ json: envelope(refund) })
  })
  await page.goto('/staff/invoices')
  await page.getByTitle('Xem chi tiết & Thanh toán').click()
  await page.getByRole('button', { name: 'Hoàn tiền & làm lại', exact: true }).click()
  await page.getByLabel('Số tiền hoàn (VND)').fill('10000.25')
  await page.getByLabel('Lý do hoàn tiền').fill('Customer refund')
  await page.getByRole('button', { name: 'Yêu cầu hoàn tiền', exact: true }).click()
  await page.getByRole('button', { name: 'Xác nhận hoàn tiền', exact: true }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Chưa xác nhận được yêu cầu' })
  ).toBeVisible()
  await expect(page.getByLabel('Số tiền hoàn (VND)')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Đóng', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Hủy', exact: true })).toBeDisabled()
  expect(bodies).toHaveLength(1)
  await page.getByRole('button', { name: 'Kiểm tra lại yêu cầu hoàn tiền', exact: true }).click()
  await expect.poll(() => bodies.length).toBe(2)
  expect(bodies[1]).toEqual(bodies[0])
  await expect(page.getByRole('button', { name: 'Đóng', exact: true })).toBeEnabled()
})

test('refund pagination is translated and blocks navigation during a history refresh', async ({ page }) => {
  await setup(page, {
    permissions: [...permissions, '/payment-refunds_read'],
    paid: () => true,
    attempts: () => [{ ...attempt, status: 'SUCCEEDED' }],
  })
  let holdNextRead = false
  let releaseRead!: () => void
  const heldRead = new Promise<void>(resolve => { releaseRead = resolve })
  const pages: number[] = []
  await page.route('**/api/v1/payment-attempts/attempt-gateway/refunds?*', async route => {
    const currentPage = Number(new URL(route.request().url()).searchParams.get('page'))
    pages.push(currentPage)
    if (holdNextRead) { holdNextRead = false; await heldRead }
    const list = Array.from({ length: currentPage === 1 ? 20 : 1 }, (_, index) => ({
      id: `refund-${currentPage}-${index}`, paymentAttemptId: attempt.id, amount: '1',
      reason: `Historical refund ${currentPage}-${index}`, status: 'SUCCEEDED', type: 'PARTIAL', createdAt: now.toISOString(),
    }))
    return route.fulfill({ json: envelope({ ...paged(list), currentPage, totalPages: 2, totalItems: 21 }) })
  })
  await page.goto('/staff/invoices')
  await page.getByTitle('Xem chi tiết & Thanh toán').click()
  await page.getByRole('button', { name: 'Hoàn tiền & làm lại', exact: true }).click()
  const panel = page.getByRole('heading', { name: 'Hoàn tiền VNPay', exact: true }).locator('..')
  const pagination = panel.getByRole('navigation', { name: 'Phân trang', exact: true })
  await expect(pagination.getByRole('button', { name: 'Trang sau' })).toBeEnabled()
  holdNextRead = true
  await panel.getByRole('button', { name: 'Làm mới lịch sử hoàn tiền' }).click()
  try {
    await expect(pagination.getByRole('button', { name: 'Trang sau' })).toBeDisabled()
  } finally {
    releaseRead()
  }
  await expect(pagination.getByRole('button', { name: 'Trang sau' })).toBeEnabled()
  await pagination.getByRole('button', { name: 'Trang sau' }).click()
  await expect(panel.getByText('Historical refund 2-0')).toBeVisible()
  expect(pages.at(-1)).toBe(2)
  await page.evaluate(async () => {
    const path = '/src/shared/i18n/index.ts'
    const { changeLanguage } = await import(path) as typeof import('../src/shared/i18n/index.js')
    await changeLanguage('en')
  })
  await expect(panel.getByRole('navigation', { name: 'Pagination' }).getByRole('button', { name: 'Next page' })).toBeDisabled()
})

test('failed refund history reads do not expose a fresh refund command', async ({ page }) => {
  await setup(page, {
    permissions: [...permissions, '/payment-refunds_read', '/payment-refunds_create'],
    paid: () => true,
    attempts: () => [{ ...attempt, status: 'SUCCEEDED' }],
  })
  await page.route('**/api/v1/payment-attempts/attempt-gateway/refunds?*', (route) =>
    route.fulfill({ status: 500, json: { message: 'Unavailable' } })
  )
  await page.goto('/staff/invoices')
  await page.getByTitle('Xem chi tiết & Thanh toán').click()
  await page.getByRole('button', { name: 'Hoàn tiền & làm lại', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Yêu cầu hoàn tiền', exact: true })).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Làm mới lịch sử hoàn tiền', exact: true })
  ).toBeVisible()
})

test('uncertain manual collection keeps the original method and tender', async ({ page }) => {
  const bodies: Record<string, unknown>[] = []
  let paid = false
  await setup(page, { permissions: [...permissions, '/invoices_void'], paid: () => paid })
  await page.route('**/api/v1/invoices/invoice-gateway/payment', (route) => {
    bodies.push(route.request().postDataJSON())
    if (bodies.length === 1) return route.abort()
    paid = true
    return route.fulfill({
      json: envelope({ ...invoice, paymentStatus: 'PAID', paymentMethod: 'CASH' }),
    })
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

test('a paid invoice read releases an uncertain manual collection without another write', async ({
  page,
}) => {
  let paid = false
  let writes = 0
  await setup(page, { permissions: [...permissions, '/invoices_void'], paid: () => paid })
  await page.route('**/api/v1/invoices/invoice-gateway/payment', (route) => {
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
  await page.route('**/api/v1/invoices/invoice-gateway/payment-attempts', (route) => {
    if (route.request().method() === 'GET') return route.fallback()
    bodies.push(route.request().postDataJSON())
    return bodies.length === 1
      ? route.abort()
      : route.fulfill({ json: envelope({ ...attempt, paymentUrl: link }) })
  })
  await openGateway(page)
  await page.getByRole('button', { name: 'Tạo phiên VNPAY', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Chưa xác nhận được' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'MoMo', exact: true })).toBeDisabled()
  expect(bodies).toHaveLength(1)
  await page.getByRole('button', { name: 'Kiểm tra lại lần tạo phiên', exact: true }).click()
  await expect.poll(() => bodies.length).toBe(2)
  expect(bodies[1]).toEqual(bodies[0])
  await expect(page.getByRole('link', { name: 'Mở thanh toán VNPay' })).toBeVisible()
})

test('missing configuration and permissions do not expose unsafe commands', async ({ page }) => {
  await setup(page, {
    configured: false,
    permissions: ['/invoices_read', '/payment-attempts_create', '/payment-attempts_read'],
  })
  await openGateway(page)
  await expect(
    page.getByRole('button', { name: 'Tạo phiên thanh toán', exact: true })
  ).toBeDisabled()
  await expect(page.getByRole('button', { name: 'MoMo', exact: true })).toBeDisabled()
  await expect(page.getByRole('status').filter({ hasText: 'Chưa cấu hình' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Xác nhận tiền mặt / Thẻ', exact: true })
  ).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Đối soát/ })).toHaveCount(0)
})

test('expired URL disappears on time without creating a replacement', async ({ page }) => {
  const expiring = { ...attempt, expiresAt: new Date(now.getTime() + 60_000).toISOString() }
  let created = false
  let posts = 0
  await setup(page, { attempts: () => (created ? [expiring] : []) })
  await page.route('**/api/v1/invoices/invoice-gateway/payment-attempts', (route) => {
    if (route.request().method() === 'GET') return route.fallback()
    posts++
    created = true
    return route.fulfill({ json: envelope({ ...expiring, paymentUrl: link }) })
  })
  await openGateway(page)
  await page.getByRole('button', { name: 'Tạo phiên VNPAY', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Mở thanh toán VNPay' })).toBeVisible()
  await page.clock.fastForward(65_000)
  await expect(page.getByRole('link', { name: 'Mở thanh toán VNPay' })).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'Liên kết đã hết hạn' })).toBeVisible()
  expect(posts).toBe(1)
})

test('MoMo creation has a 35 second budget without changing default GET deadlines', async ({
  page,
}, info) => {
  await setup(page)
  await page.route('**/api/v1/invoices/invoice-gateway/payment-attempts', (route) =>
    route.request().method() === 'GET'
      ? route.fallback()
      : route.fulfill({
          json: envelope({
            ...attempt,
            provider: 'MOMO',
            paymentUrl: 'https://test-payment.momo.vn/v2/gateway/pay?orderId=test',
          }),
        })
  )
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
  await expect(page.getByRole('link', { name: 'Mở thanh toán MoMo' })).toBeVisible()
  const qr = page.getByRole('img', { name: 'Mã QR mở trang thanh toán' })
  await expect(qr).toBeVisible()
  await expect.poll(() => qr.evaluate((node) => Array.from((node as HTMLCanvasElement).getContext('2d')!.getImageData(0, 0, 1, 1).data))).toEqual([255, 255, 255, 255])
  await qr.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('momo-gateway.png') })
  const budgets = await page.evaluate(() => (window as unknown as { budgets: number[] }).budgets)
  expect(budgets).toContain(35000)
  expect(budgets).toContain(10000)
})

test('reopens the same payment QR after a detail-tab change and reload', async ({ page }, info) => {
  let created = false
  let creations = 0
  let recoveries = 0
  await setup(page, { attempts: () => (created ? [attempt] : []) })
  await page.route('**/api/v1/invoices/invoice-gateway/payment-attempts', (route) => {
    if (route.request().method() === 'GET') return route.fallback()
    created = true
    creations++
    return route.fulfill({ json: envelope({ ...attempt, paymentUrl: link }) })
  })
  await page.route('**/api/v1/payment-attempts/attempt-gateway/payment-link', (route) => {
    recoveries++
    expect(route.request().method()).toBe('POST')
    return route.fulfill({ json: envelope({ ...attempt, paymentUrl: link }) })
  })
  await openGateway(page)
  await page.getByRole('button', { name: 'Tạo phiên VNPAY', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Mở thanh toán VNPay' })).toHaveAttribute(
    'href',
    link
  )
  await page.getByRole('button', { name: /^Chi tiết món/ }).click()
  await page
    .getByRole('button', { name: 'Cổng thanh toán (VNPay / MoMo / payOS)', exact: true })
    .click()
  await page.getByRole('button', { name: 'Mở lại QR thanh toán', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Mở thanh toán VNPay' })).toHaveAttribute(
    'href',
    link
  )
  await page.reload()
  await page.getByTitle('Xem chi tiết & Thanh toán').click()
  await page
    .getByRole('button', { name: 'Cổng thanh toán (VNPay / MoMo / payOS)', exact: true })
    .click()
  await page.getByRole('button', { name: 'Mở lại QR thanh toán', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Mở thanh toán VNPay' })).toHaveAttribute(
    'href',
    link
  )
  expect(creations).toBe(1)
  expect(recoveries).toBe(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('payment-link-recovery.png') })
})

test('unsafe gateway URL is rejected before link or QR rendering', async ({ page }) => {
  await setup(page)
  await page.route('**/api/v1/invoices/invoice-gateway/payment-attempts', (route) =>
    route.request().method() === 'GET'
      ? route.fallback()
      : route.fulfill({ json: envelope({ ...attempt, paymentUrl: 'javascript:alert(1)' }) })
  )
  await openGateway(page)
  await page.getByRole('button', { name: 'Tạo phiên VNPAY', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Phản hồi không hợp lệ')
  await expect(page.getByRole('link', { name: /^Mở thanh toán/ })).toHaveCount(0)
  await expect(page.getByRole('img', { name: 'Mã QR mở trang thanh toán' })).toHaveCount(0)
})

async function openPos(
  page: Page,
  {
    checkout = true,
    unitPrice = '35000',
    menuItems = [],
  }: {
    checkout?: boolean
    unitPrice?: string
    menuItems?: unknown[]
  } = {}
) {
  await page.route('**/api/v1/invoices/quote', (route) => route.fulfill({ json: envelope({
    orderItemIds: [itemId], subTotal: unitPrice, discountAmount: '0', taxAmount: '0', totalAmount: unitPrice, quoteFingerprint: 'a'.repeat(64),
  }) }))
  await page.route('**/api/v1/orders/sessions/' + sessionId, (route) =>
    route.fulfill({
      json: envelope({
        id: sessionId,
        sessionStatus: 'ACTIVE',
        guestCount: null,
        table: null,
        employee: defaultMockAdminEmployee,
        createdAt: now.toISOString(),
        orderItems: [
          {
            id: itemId,
            quantity: 1,
            priceAtTime: unitPrice,
            serveStatus: 'READY',
            isPaid: false,
            menuItem: { id: menuId, name: 'Coffee gateway', price: unitPrice },
          },
        ],
      }),
    })
  )
  await page.route('**/api/v1/menu/public/categories', (route) =>
    route.fulfill({ json: envelope([]) })
  )
  await page.route('**/api/v1/menu/public/items?*', (route) =>
    route.fulfill({ json: envelope(paged(menuItems)) })
  )
  await page.route('**/api/v1/recommendations/pos/*', (route) =>
    route.fulfill({ json: envelope({ recommendations: [] }) })
  )
  await page.goto('/staff/pos/sessions/' + sessionId)
  if (checkout)
    await page
      .getByRole('button', { name: /^Thanh toán \(/ })
      .first()
      .click()
}

test('permission workflow keeps digital checkout independent from cash settlement', async ({ page }) => {
  await setup(page, { permissions: ['/orders_sessions_read', '/invoices_create', '/invoices_read', '/payment-attempts_create', '/payment-attempts_read'] })
  await openPos(page)
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Tiền mặt', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Quẹt thẻ POS', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('checkbox').first()).toBeEnabled()
})

test('POS cash change is exact to the cent', async ({ page }) => {
  await setup(page, { permissions: ['/invoices_create', '/invoices_pay', '/orders_sessions_read'] })
  await openPos(page, { unitPrice: '35000.25' })
  await page.getByLabel('Khách đưa (₫)').fill('35000.30')
  await expect(page.getByRole('dialog').getByText('0,05 ₫', { exact: true })).toBeVisible()
})

test('money arithmetic preserves two decimals and values beyond Number precision', () => {
  expect(decimalAmount(minorAmount('9999999999999999.99'))).toBe('9999999999999999.99')
  expect(decimalAmount(minorAmount('35000.30') - minorAmount('35000.25'))).toBe('0.05')
})

test('an unknown POS submission freezes the draft and replays the same item batch', async ({
  page,
}) => {
  const bodies: Record<string, unknown>[] = []
  const menu = {
    id: menuId,
    name: 'New Coffee',
    price: '35000.25',
    category: { id: menuId, name: 'Coffee' },
    optionGroups: [],
  }
  await setup(page, {
    permissions: ['/orders_sessions_read', '/orders_items_create', '/invoices_create', '/invoices_pay'],
  })
  await page.route(`**/api/v1/orders/sessions/${sessionId}/items`, (route) => {
    bodies.push(route.request().postDataJSON())
    return bodies.length === 1
      ? route.abort()
      : route.fulfill({
          json: envelope({
            id: sessionId,
            sessionStatus: 'ACTIVE',
            createdAt: now.toISOString(),
            table: null,
            employee: defaultMockAdminEmployee,
            orderItems: [],
          }),
        })
  })
  await openPos(page, { checkout: false, menuItems: [menu] })
  await page.getByRole('button', { name: /New Coffee/ }).click()
  await page.getByRole('button', { name: 'Gửi order vào bếp', exact: true }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Chưa xác nhận được lần gửi món' })
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tăng số lượng' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Xóa tất cả' })).toBeDisabled()
  await expect(page.getByRole('button', { name: /^Thanh toán \(/ })).toBeDisabled()
  expect(bodies).toHaveLength(1)
  await page.reload()
  await expect(
    page.getByRole('status').filter({ hasText: 'Chưa xác nhận được lần gửi món' })
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tăng số lượng' })).toBeDisabled()
  await expect(page.getByRole('button', { name: /^Thanh toán \(/ })).toBeDisabled()
  await page.evaluate(async () => {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith('coffee_pos_draft_')) sessionStorage.removeItem(key)
    const path = '/src/shared/api/idempotency.ts'
    const { clearPrivatePendingOperations } = await import(/* @vite-ignore */ path)
    clearPrivatePendingOperations()
  })
  await page.reload()
  await page.getByRole('button', { name: 'Kiểm tra lại cùng batch', exact: true }).click()
  await expect.poll(() => bodies.length).toBe(2)
  expect(bodies[1]).toEqual(bodies[0])
  expect(bodies[0]?.idempotencyKey).toBeTruthy()
})

test('POS reuses the gateway panel after reviewing an actual invoice', async ({ page }) => {
  let posts = 0
  await setup(page)
  await page.route('**/api/v1/invoices?*', (route) =>
    route.fulfill({
      json: envelope(
        paged([{ ...invoice, orderItems: [{ id: itemId, quantity: 1, priceAtTime: '35000' }] }])
      ),
    })
  )
  await page.route('**/api/v1/invoices/invoice-gateway/payment-attempts', (route) => {
    if (route.request().method() === 'GET') return route.fallback()
    posts++
    return route.fulfill({ json: envelope({ ...attempt, paymentUrl: link }) })
  })
  await openPos(page)
  await page.getByRole('button', { name: 'Quét mã QR', exact: true }).click()
  await page.getByRole('button', { name: 'Kiểm tra hóa đơn trước khi tạo QR', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Tổng quan thanh toán', exact: true })).toContainText('35.000')
  expect(posts).toBe(0)
  await page.getByRole('button', { name: 'Tạo phiên VNPAY', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Mở thanh toán VNPay' })).toBeVisible()
  expect(posts).toBe(1)
})

test('uncertain POS cash checkout cannot change its tender or method', async ({ page }) => {
  const bodies: Record<string, unknown>[] = []
  await setup(page, { permissions: ['/invoices_create', '/invoices_pay', '/orders_sessions_read'] })
  await page.route('**/api/v1/invoices/checkout', (route) => {
    bodies.push(route.request().postDataJSON())
    return bodies.length === 1
      ? route.abort()
      : route.fulfill({
          json: envelope({
            ...invoice,
            id: '60000000-0000-4000-8000-000000000004',
            paymentStatus: 'PAID',
            paymentMethod: 'CASH',
          }),
        })
  })
  await openPos(page)
  await expect(page.getByRole('button', { name: 'Quét mã QR', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Xác nhận thanh toán tiền mặt', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByLabel('Khách đưa (₫)')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Quẹt thẻ POS', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Kiểm tra lại thanh toán tiền mặt', exact: true }).click()
  await expect.poll(() => bodies.length).toBe(2)
  expect(bodies[1]).toEqual(bodies[0])
})

test('POS closes an untouched checkout on Escape', async ({ page }) => {
  await setup(page, { permissions: ['/invoices_create', '/invoices_pay', '/orders_sessions_read'] })
  await openPos(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
