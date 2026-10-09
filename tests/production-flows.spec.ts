import { expect, test } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const invoice = {
  id: 'invoice-fixture', invoiceNumber: 'FE-TAKEAWAY-001',
  subTotal: '60000', discountAmount: '0', taxAmount: '0', taxRate: '0',
  totalAmount: '60000', paymentMethod: 'CASH', paymentStatus: 'UNPAID',
  createdAt: '2026-10-03T02:00:00.000Z', updatedAt: '2026-10-03T02:00:00.000Z',
  orderSessionId: 'session-fixture', employeeId: defaultMockAdminEmployee.id,
  orderSession: { id: 'session-fixture', sessionStatus: 'ACTIVE', tableId: null, table: null },
  orderItems: [{
    id: 'item-fixture', quantity: 2, priceAtTime: '30000', note: null,
    menuItem: { id: 'menu-fixture', name: 'Contract coffee', price: '35000' },
  }],
}

test('line display preserves large snapshot amounts and negative fractional margins', async ({ page }) => {
  await page.goto('/sign-in')
  const result = await page.evaluate(async () => {
    const path = '/src/shared/lib/format.ts'
    const { formatLineAmount, formatVnd } = await import(path)
    return { line: formatLineAmount('9007199254740993.25', 2), margin: formatVnd('-0.50') }
  })
  expect(result.line).toBe('18.014.398.509.481.986,50 ₫')
  expect(result.margin).toBe('-0,50 ₫')
})

test('uncertain inventory post retains its key across reload and clears only on valid success', async ({ page }) => {
  const keys: string[] = []
  await page.route('**/api/v1/inventory/purchase-receipts/receipt-test/post', (route) => {
    keys.push(route.request().postDataJSON().idempotencyKey)
    return route.fulfill(keys.length === 1
      ? { json: envelope({ id: 'receipt-test', status: 'WRONG' }) }
      : { json: envelope({ id: 'receipt-test', status: 'POSTED', movements: [] }) })
  })
  await page.goto('/sign-in')
  const post = () => page.evaluate(async () => {
    const path = '/src/features/inventory/procurement.api.ts'
    const { postDocument } = await import(path)
    try { await postDocument('purchase-receipts', 'receipt-test'); return 'success' }
    catch (error) { return (error as { code?: string }).code }
  })
  expect(await post()).toBe('CLIENT_RESPONSE_INVALID')
  await page.reload()
  expect(await post()).toBe('success')
  expect(keys[0]).toBe(keys[1])
  expect(await post()).toBe('success')
  expect(keys[2]).not.toBe(keys[1])
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith('coffee-shop:pending:')))).toEqual([])
})

test('renewed captcha does not change a pending public request key', async ({ page }) => {
  const keys: string[] = []
  const tokens: string[] = []
  await page.route('**/api/v1/fixture-order', (route) => {
    const payload = route.request().postDataJSON()
    keys.push(payload.clientRequestId); tokens.push(payload.turnstileToken)
    return keys.length === 1 ? route.abort() : route.fulfill({ json: envelope({ id: 'x', status: 'POSTED' }) })
  })
  await page.goto('/sign-in')
  for (const token of ['captcha-first', 'captcha-renewed']) {
    await page.evaluate(async (turnstileToken) => {
      const adapterPath = '/src/shared/api/idempotency.ts'
      const schemasPath = '/src/features/inventory/procurement.api.ts'
      const { apiIdempotentMutate } = await import(adapterPath)
      const { stocktakeSchema } = await import(schemasPath)
      try {
        await apiIdempotentMutate('/fixture-order', stocktakeSchema.pick({ id: true, status: true }),
          { pickupName: 'Fixture', turnstileToken }, { keyField: 'clientRequestId', authenticated: false })
      } catch { /* Simulate an uncertain network outcome before an explicit retry. */ }
    }, token)
  }
  expect(keys).toHaveLength(2)
  expect(keys[0]).toBe(keys[1])
  expect(tokens).toEqual(['captcha-first', 'captcha-renewed'])
})

test('takeaway invoice uses priceAtTime and its native dialog traps and returns focus', async ({ page }, info) => {
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: envelope(defaultMockAdminEmployee) }))
  await page.route('**/api/v1/auth/me/permissions', (route) => route.fulfill({ json: envelope(defaultMockAdminAuth(['/invoices_read'])) }))
  await page.route('**/api/v1/invoices?*', (route) => route.fulfill({ json: envelope({
    list: [invoice], currentPage: 1, totalItems: 1, totalPages: 1,
  }) }))
  await page.route('**/api/v1/invoices/invoice-fixture', (route) => route.fulfill({ json: envelope(invoice) }))
  await page.goto('/staff/invoices')
  const main = await page.getByRole('main').boundingBox()
  expect(main!.x + main!.width).toBeLessThanOrEqual(info.project.use.viewport!.width)
  const opener = page.getByTitle('Xem chi tiết & Thanh toán')
  await opener.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Contract coffee', { exact: true })).toBeVisible()
  await expect(dialog.getByText('30.000', { exact: false })).toBeVisible()
  await expect(dialog.getByText('Mang đi', { exact: true })).toBeVisible()
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate((node) =>
      document.activeElement === document.body || node.contains(document.activeElement))).toBe(true)
  }
  await opener.evaluate((node) => node.focus())
  await expect(opener).not.toBeFocused()
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).last().focus()
  const box = await dialog.boundingBox()
  expect(box!.width).toBeLessThanOrEqual(info.project.use.viewport!.width)
  await page.screenshot({ path: info.outputPath('takeaway-invoice.png') })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
})

test('payment return trusts the server, never the success parameter, and never mutates', async ({ page }) => {
  const methods: string[] = []
  await page.route('**/api/v1/payments/vnpay/return?*', (route) => {
    methods.push(route.request().method())
    return route.fulfill({ json: envelope({
      signatureValid: true, attempt: { id: 'attempt', invoiceId: 'invoice', status: 'PENDING' },
    }) })
  })
  await page.goto('/payment/vnpay/return?vnp_ResponseCode=00')
  await expect(page.getByRole('status')).toContainText('Chưa cần thanh toán lại')
  await expect(page.getByText('Server đã ghi nhận thanh toán thành công.')).toHaveCount(0)
  expect(methods.length).toBeGreaterThan(0)
  expect(methods.every((method) => method === 'GET')).toBe(true)
})

test('reset token leaves the URL and is submitted only with a valid matching password', async ({ page }) => {
  const token = 'a'.repeat(64)
  let submits = 0
  await page.route('**/api/v1/auth/reset-password', (route) => {
    submits++
    expect(route.request().postDataJSON()).toEqual({ token, password: 'Fixture-password-123!' })
    return route.fulfill({ json: envelope({ message: 'OK' }) })
  })
  await page.goto('/reset-password?token=' + token)
  await expect(page).toHaveURL(/\/reset-password$/)
  await page.getByLabel('Mật khẩu mới').fill('Fixture-password-123!')
  await page.getByLabel('Xác nhận mật khẩu').fill('Different-password-123!')
  await page.getByRole('button', { name: 'Đổi mật khẩu' }).click()
  await expect(page.getByRole('alert')).toContainText('xác nhận trùng khớp')
  expect(submits).toBe(0)
  await page.getByLabel('Xác nhận mật khẩu').fill('Fixture-password-123!')
  await page.getByRole('button', { name: 'Đổi mật khẩu' }).click()
  await expect(page.getByRole('status')).toContainText('Đã đổi mật khẩu')
  expect(submits).toBe(1)
})

test('reorder shows unavailable selections and never silently creates an order', async ({ page }) => {
  let mutations = 0
  await page.route('**/api/v1/online-orders/**', (route) => {
    if (!route.request().url().endsWith('/reorder-template')) mutations++
    return route.fulfill({ json: envelope({
      items: [{ menuItemId: 'menu', quantity: 1, optionIds: [] }],
      quote: { previousSubtotal: '30000', currentSubtotal: null, canSubmit: false,
        lines: [{ lineNumber: 1, previousName: 'Unavailable coffee', previousUnitPrice: '30000',
          available: false, reason: 'ITEM_UNAVAILABLE', currentName: null, currentUnitPrice: null }] },
    }) })
  })
  await page.goto('/reorder#requestId=old-order&key=' + 'b'.repeat(64))
  await page.getByRole('button', { name: 'Kiểm tra đơn và giá hiện tại' }).click()
  await expect(page.getByText('Món hoặc tùy chọn đã ngừng bán')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Đặt lại · Trả khi nhận' })).toHaveCount(0)
  expect(mutations).toBe(0)
})

test('receipt posting confirms once and accepts the backend movement result', async ({ page }) => {
  let posted = false
  let writes = 0
  const paginated = (list: unknown[]) => ({ list, currentPage: 1, totalItems: list.length, totalPages: list.length ? 1 : 0 })
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: envelope(defaultMockAdminEmployee) }))
  await page.route('**/api/v1/auth/me/permissions', (route) => route.fulfill({ json: envelope(defaultMockAdminAuth([
    '/inventory_read', '/inventory_suppliers_read', '/inventory_purchase-receipts_read', '/inventory_purchase-receipts_post',
  ])) }))
  await page.route('**/api/v1/inventory/**', (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/receipt-fixture/post')) {
      writes++
      expect(route.request().postDataJSON().idempotencyKey).toMatch(/^[a-f0-9-]{36}$/)
      posted = true
      return route.fulfill({ json: envelope({ id: 'receipt-fixture', status: 'POSTED', movements: [] }) })
    }
    if (url.pathname.endsWith('/purchase-receipts')) return route.fulfill({ json: envelope(paginated([{
      id: 'receipt-fixture', receiptNumber: 'PR-FIXTURE', supplierId: 'supplier-fixture',
      totalAmount: '123.45', receivedAt: '2026-10-03T02:00:00.000Z', status: posted ? 'POSTED' : 'DRAFT',
    }])) })
    return route.fulfill({ json: envelope(paginated([])) })
  })
  await page.goto('/staff/inventory')
  await page.getByRole('button', { name: 'Mua hàng & Kiểm kê' }).click()
  await page.getByRole('button', { name: 'Phiếu nhập', exact: true }).click()
  await page.getByRole('button', { name: 'Ghi sổ', exact: true }).click()
  expect(writes).toBe(0)
  const dialog = page.getByRole('dialog', { name: 'Xác nhận ghi sổ' })
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(page.getByText('Đã ghi sổ', { exact: false })).toBeVisible()
  expect(writes).toBe(1)
})

test('refund confirmation preserves its key after an uncertain provider response', async ({ page }) => {
  const keys: string[] = []
  const paid = { ...invoice, paymentStatus: 'PAID' }
  const pageData = (list: unknown[]) => ({ list, totalItems: list.length, totalPages: 1, currentPage: 1 })
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: envelope(defaultMockAdminEmployee) }))
  await page.route('**/api/v1/auth/me/permissions', (route) => route.fulfill({ json: envelope(defaultMockAdminAuth([
    '/invoices_read', '/payment-attempts_read', '/payment-refunds_read', '/payment-refunds_create',
  ])) }))
  await page.route('**/api/v1/invoices?*', (route) => route.fulfill({ json: envelope(pageData([paid])) }))
  await page.route('**/api/v1/invoices/invoice-fixture', (route) => route.fulfill({ json: envelope(paid) }))
  await page.route('**/api/v1/invoices/invoice-fixture/payment-attempts', (route) => route.fulfill({ json: envelope(pageData([{
    id: 'attempt-fixture', invoiceId: invoice.id, provider: 'VNPAY', amount: '60000',
    merchantReference: 'PAY-FIXTURE', status: 'SUCCEEDED', providerCreatedAt: invoice.createdAt,
    createdAt: invoice.createdAt, updatedAt: invoice.updatedAt, expiresAt: invoice.createdAt,
  }])) }))
  await page.route('**/api/v1/payment-attempts/attempt-fixture/refunds**', (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: envelope(pageData([])) })
    const body = route.request().postDataJSON()
    keys.push(body.idempotencyKey)
    expect(body.amount).toBe('10000')
    expect(body.reason).toBe('Wrong drink')
    return keys.length === 1 ? route.fulfill({ status: 503, json: {} })
      : route.fulfill({ json: envelope({
        id: 'refund-fixture', paymentAttemptId: 'attempt-fixture', amount: '10000',
        reason: 'Wrong drink', type: 'PARTIAL', status: 'PENDING', createdAt: invoice.createdAt,
      }) })
  })
  await page.goto('/staff/invoices')
  await page.getByTitle('Xem chi tiết & Thanh toán').click()
  await page.getByLabel('Số tiền hoàn (VND)').fill('10000')
  await page.getByLabel('Lý do hoàn tiền').fill('Wrong drink')
  await page.getByRole('button', { name: 'Yêu cầu hoàn tiền', exact: true }).click()
  const confirmation = page.getByRole('dialog', { name: 'Xác nhận yêu cầu hoàn tiền' })
  expect(keys).toHaveLength(0)
  await confirmation.getByRole('button', { name: 'Xác nhận hoàn tiền', exact: true }).click()
  await expect(confirmation.getByRole('alert')).toBeVisible()
  await expect(page.getByLabel('Số tiền hoàn (VND)')).toBeDisabled()
  await expect(confirmation.getByRole('button', { name: 'Hủy', exact: true })).toBeDisabled()
  await confirmation.getByRole('button', { name: 'Kiểm tra lại yêu cầu hoàn tiền', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Yêu cầu: Chờ xử lý')
  expect(keys).toHaveLength(2)
  expect(keys[0]).toBe(keys[1])
})
