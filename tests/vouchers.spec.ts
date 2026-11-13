import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const customerId = '80000000-0000-4000-8000-000000000001'
const otherCustomerId = '80000000-0000-4000-8000-000000000002'
const voucherId = '81000000-0000-4000-8000-000000000001'
const orderId = '82000000-0000-4000-8000-000000000001'
const campaign = {
  id: '83000000-0000-4000-8000-000000000001', name: 'Server voucher', description: 'Server terms',
  isPublic: true, status: 'ACTIVE', discountType: 'PERCENTAGE', discountValue: '12.25',
  maxDiscount: '50000.00', minSubtotal: '100000.00', issuanceLimit: 100, issuedCount: 3,
  startDate: '2026-10-01T00:00:00Z', endDate: '2026-12-31T00:00:00Z',
  publishedAt: '2026-09-30T00:00:00Z', createdAt: '2026-09-29T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
}
const stats = { claimed: 1, gifted: 2, reserved: 1, redeemed: 0, revoked: 0 }
const walletEntry = { id: voucherId, source: 'CLAIM', status: 'AVAILABLE', createdAt: campaign.createdAt, expiresAt: campaign.endDate, campaign, orderId: null }
const grant = { ...walletEntry, source: 'GIFT', campaignId: campaign.id, customerId, sourceOrderId: orderId, reason: 'Service recovery', updatedAt: campaign.updatedAt }
const paged = (list: unknown[], page = 1) => ({ list, currentPage: page, totalItems: list.length, totalPages: list.length ? 1 : 0 })

async function setup(page: Page, permissions: string[] = []) {
  await page.clock.setFixedTime(new Date('2026-11-10T05:00:00Z'))
  await page.route('**/api/v1/**', route => route.fulfill({ status: 404, json: { message: 'Not found' } }))
  await page.route('**/api/v1/customers/me', route => route.fulfill({ json: envelope({ id: customerId, email: 'customer@example.test' }) }))
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: envelope(defaultMockAdminEmployee) }))
  await page.route('**/api/v1/auth/me/permissions', route => route.fulfill({ json: envelope(defaultMockAdminAuth(permissions)) }))
  await page.route('**/api/v1/menu/public/store', route => route.fulfill({ json: envelope({ name: 'Coffee Homes', address: null, phone: null }) }))
  await page.route('**/api/v1/voucher-campaigns/public?*', route => route.fulfill({ json: envelope(paged([campaign])) }))
  await page.route('**/api/v1/voucher-campaigns?*', route => route.fulfill({ json: envelope(paged([campaign])) }))
  await page.route(`**/api/v1/voucher-campaigns/${campaign.id}`, route => route.fulfill({ json: envelope({ ...campaign, stats }) }))
  await page.route(`**/api/v1/voucher-campaigns/${campaign.id}/grants?*`, route => route.fulfill({ json: envelope(paged([])) }))
  await page.route(`**/api/v1/voucher-grants/${voucherId}`, route => route.fulfill({ json: envelope(grant) }))
}

test('public discovery does not require sign-in or query the wallet', async ({ page }, info) => {
  await setup(page)
  await page.route('**/api/v1/customers/me', route => route.fulfill({ status: 401, json: { message: 'Sign in' } }))
  const privateCalls: string[] = []
  page.on('request', request => { if (/customers\/vouchers|auth\/refresh/.test(request.url())) privateCalls.push(request.url()) })
  await page.goto('/account/vouchers')
  await expect(page.getByRole('heading', { name: campaign.name })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Đăng nhập để nhận' })).toBeVisible()
  expect(privateCalls).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('voucher-discovery.png'), fullPage: true })
})

test('wallet keeps readable states and responsive layout in dark mode', async ({ page }, info) => {
  await setup(page)
  await page.addInitScript(() => localStorage.setItem('coffee_theme', 'dark'))
  await page.route('**/api/v1/customers/vouchers?*', route => route.fulfill({ json: envelope({ customerId, ...paged([walletEntry]) }) }))
  await page.goto('/account/vouchers?tab=wallet')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByRole('heading', { name: campaign.name })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('voucher-wallet-dark.png'), fullPage: true })
})

test('claim uses customer CSRF and expected identity; wallet survives reload without browser storage', async ({ page, context }) => {
  await setup(page)
  await context.addCookies([{ name: 'customerCsrfToken', value: 'customer-csrf', url: 'http://localhost:4173' }])
  let claimed = false
  let employeeRefreshes = 0
  page.on('request', request => { if (request.url().includes('/auth/refresh')) employeeRefreshes++ })
  await page.route('**/api/v1/customers/vouchers/claim', route => {
    expect(route.request().headers()['x-csrf-token']).toBe('customer-csrf')
    expect(route.request().postDataJSON()).toEqual({ campaignId: campaign.id, expectedCustomerId: customerId })
    claimed = true
    return route.fulfill({ json: envelope({ customerId, voucherId }) })
  })
  await page.route('**/api/v1/customers/vouchers?*', route => route.fulfill({ json: envelope({ customerId, ...paged(claimed ? [walletEntry] : []) }) }))
  await page.goto('/account/vouchers')
  await page.getByRole('button', { name: 'Nhận voucher', exact: true }).click()
  await expect(page.getByText('Đã thêm voucher vào ví của bạn.')).toBeVisible()
  await page.getByRole('tab', { name: 'Voucher của tôi' }).click()
  await expect(page.getByRole('heading', { name: campaign.name })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: campaign.name })).toBeVisible()
  expect(employeeRefreshes).toBe(0)
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(voucherId)
})

test('wallet queries status and pagination from the server, including UPCOMING and USED', async ({ page }) => {
  await setup(page)
  const statuses: string[] = []
  await page.route('**/api/v1/customers/vouchers?*', route => {
    const status = new URL(route.request().url()).searchParams.get('status')!
    statuses.push(status)
    return route.fulfill({ json: envelope({ customerId, ...paged(status === 'RESERVED' ? [{ ...walletEntry, status, orderId }] : []) }) })
  })
  await page.goto('/account/vouchers?tab=wallet')
  await expect(page.getByText('Bạn chưa có voucher có thể dùng.')).toBeVisible()
  for (const status of ['UPCOMING', 'USED', 'EXPIRED', 'REVOKED', 'RESERVED']) {
    await page.getByLabel('Trạng thái voucher', { exact: true }).selectOption(status)
    await expect.poll(() => statuses.at(-1)).toBe(status)
  }
  await expect(page.getByRole('link', { name: 'Xem đơn hàng', exact: true })).toHaveAttribute('href', `/account/orders/${orderId}`)
})

test('wallet read errors do not appear as empty results or expose another customer wallet', async ({ page }) => {
  await setup(page)
  await page.route('**/api/v1/customers/vouchers?*', route => route.fulfill({ status: 503, json: { message: 'Unavailable' } }))
  await page.goto('/account/vouchers?tab=wallet')
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
  await expect(page.getByText('Bạn chưa có voucher có thể dùng.')).toHaveCount(0)
  await page.route('**/api/v1/customers/vouchers?*', route => route.fulfill({ json: envelope({ customerId: otherCustomerId, ...paged([walletEntry]) }) }))
  await page.getByRole('button', { name: 'Tải lại voucher' }).click()
  await expect(page.getByRole('heading', { name: campaign.name })).toHaveCount(0)
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
})

test('voucher read-only staff enter directly without promotion requests or write actions', async ({ page }, info) => {
  await setup(page, ['/vouchers_read'])
  const promotionCalls: string[] = []
  page.on('request', request => { if (/api\/v1\/promotions(?:\?|\/|$)/.test(request.url())) promotionCalls.push(request.url()) })
  await page.goto('/staff/promotions')
  await expect(page.getByRole('tab', { name: 'Chiến dịch voucher' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tab', { name: 'Khuyến mãi hóa đơn' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Tạo chiến dịch voucher' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Chi tiết chiến dịch' }).click()
  await expect(page.getByRole('dialog').getByText('Đã phát hành', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('dialog').getByText('Chiến dịch này chưa phát hành voucher.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tạm dừng phát hành' })).toHaveCount(0)
  expect(promotionCalls).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('voucher-read-only.png'), fullPage: true })
})

test('promotion-only staff never request voucher campaigns', async ({ page }) => {
  await setup(page, ['/promotions_read'])
  let voucherCalls = 0
  page.on('request', request => { if (request.url().includes('/api/v1/voucher-campaigns')) voucherCalls++ })
  await page.route('**/api/v1/promotions?*', route => route.fulfill({ json: envelope(paged([])) }))
  await page.goto('/staff/promotions')
  await expect(page.getByRole('heading', { name: 'Khuyến mãi hóa đơn' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Chiến dịch voucher' })).toHaveCount(0)
  expect(voucherCalls).toBe(0)
})

test('staff with both read grants fetch only the selected tab', async ({ page }) => {
  await setup(page, ['/promotions_read', '/vouchers_read'])
  let voucherCalls = 0
  await page.route('**/api/v1/voucher-campaigns?*', route => {
    voucherCalls++
    return route.fulfill({ json: envelope(paged([campaign])) })
  })
  await page.route('**/api/v1/promotions?*', route => route.fulfill({ json: envelope(paged([])) }))
  await page.goto('/staff/promotions')
  await expect(page.getByRole('heading', { name: 'Khuyến mãi hóa đơn' })).toBeVisible()
  expect(voucherCalls).toBe(0)
  await page.getByRole('tab', { name: 'Chiến dịch voucher' }).click()
  await expect(page.getByRole('heading', { name: campaign.name })).toBeVisible()
  expect(voucherCalls).toBeGreaterThan(0)
})

test('empty public discovery renders no fabricated offers', async ({ page }) => {
  await setup(page)
  await page.route('**/api/v1/voucher-campaigns/public?*', route => route.fulfill({ json: envelope(paged([])) }))
  await page.goto('/account/vouchers')
  await expect(page.getByText('Hiện chưa có voucher đang mở nhận.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nhận voucher', exact: true })).toHaveCount(0)
})

test('published terms stay locked and pause uses the freshly read version', async ({ page }) => {
  await setup(page, ['/vouchers_read', '/vouchers_manage'])
  const fresh = { ...campaign, updatedAt: '2026-11-10T04:59:00Z', stats }
  await page.route(`**/api/v1/voucher-campaigns/${campaign.id}`, route => route.fulfill({ json: envelope(fresh) }))
  let payload: unknown
  await page.route(`**/api/v1/voucher-campaigns/${campaign.id}/pause`, route => {
    payload = route.request().postDataJSON()
    return route.fulfill({ json: envelope({ ...fresh, status: 'PAUSED' }) })
  })
  await page.goto('/staff/promotions')
  await page.getByRole('button', { name: 'Chi tiết chiến dịch' }).click()
  await expect(page.getByRole('dialog').getByText('Điều kiện đã công bố không thể thay đổi.')).toBeVisible()
  await expect(page.getByRole('dialog').getByLabel('Giá trị giảm', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Tạm dừng phát hành' }).click()
  expect(payload).toBeUndefined()
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(payload).toEqual({ expectedUpdatedAt: fresh.updatedAt })
})

test('draft editing preserves exact strings and freezes on a stale version', async ({ page }) => {
  await setup(page, ['/vouchers_read', '/vouchers_manage'])
  const draft = { ...campaign, publishedAt: null, status: 'DRAFT', stats }
  let payload: Record<string, unknown> | undefined
  await page.route(`**/api/v1/voucher-campaigns/${campaign.id}`, route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: envelope(draft) })
    payload = route.request().postDataJSON()
    return route.fulfill({ status: 409, json: { code: 'VOUCHER_CAMPAIGN_CHANGED', message: 'Changed' } })
  })
  await page.goto('/staff/promotions')
  await page.getByRole('button', { name: 'Chi tiết chiến dịch' }).click()
  await page.getByLabel('Giá trị giảm', { exact: true }).fill('12.35')
  await page.getByRole('button', { name: 'Lưu chiến dịch' }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
  await expect(page.getByLabel('Giá trị giảm', { exact: true })).toBeDisabled()
  expect(payload).toMatchObject({ discountValue: '12.35', expectedUpdatedAt: draft.updatedAt })
  await page.getByRole('button', { name: 'Tải lại và kiểm tra' }).click()
  await expect(page.getByLabel('Giá trị giảm', { exact: true })).toBeEnabled()
})

test('revocation requires a reason, includes the version and key, and reconciles an uncertain result by reading', async ({ page }) => {
  await setup(page, ['/vouchers_read', '/vouchers_revoke'])
  let revoked = false
  let writes = 0
  let payload: Record<string, unknown> | undefined
  await page.route(`**/api/v1/voucher-grants/${voucherId}`, route => route.fulfill({ json: envelope({ ...grant, status: revoked ? 'REVOKED' : 'AVAILABLE' }) }))
  await page.route(`**/api/v1/voucher-campaigns/${campaign.id}/grants?*`, route => route.fulfill({
    json: envelope(paged([{ ...grant, status: revoked ? 'REVOKED' : 'AVAILABLE' }])),
  }))
  await page.route(`**/api/v1/voucher-grants/${voucherId}/revoke`, route => {
    writes++
    payload = route.request().postDataJSON()
    revoked = true
    return route.abort()
  })
  await page.goto('/staff/promotions')
  await page.getByRole('button', { name: 'Chi tiết chiến dịch' }).click()
  await page.getByRole('button', { name: 'Thu hồi voucher', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Lý do', { exact: true }).fill('Issued in error')
  await page.getByRole('button', { name: 'Xác nhận thu hồi' }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Gửi lại lệnh ban đầu' })).toBeDisabled()
  expect(payload).toMatchObject({ reason: 'Issued in error', expectedUpdatedAt: grant.updatedAt })
  expect(payload?.idempotencyKey).toEqual(expect.any(String))
  await page.getByRole('button', { name: 'Tải lại và kiểm tra' }).click()
  await expect(page.getByRole('dialog').getByText('Đã thu hồi', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Gửi lại lệnh ban đầu' })).toHaveCount(0)
  expect(writes).toBe(1)
})

test('revocation survives reload and recovers by id after its grant leaves the list, refreshing counters', async ({ page }) => {
  await setup(page, ['/vouchers_read', '/vouchers_revoke'])
  let revoked = false
  let writes = 0
  await page.route(`**/api/v1/voucher-campaigns/${campaign.id}`, route => route.fulfill({ json: envelope({ ...campaign, stats: { ...stats, revoked: revoked ? 1 : 0 } }) }))
  await page.route(`**/api/v1/voucher-campaigns/${campaign.id}/grants?*`, route => route.fulfill({ json: envelope(paged(revoked ? [] : [grant])) }))
  await page.route(`**/api/v1/voucher-grants/${voucherId}`, route => route.fulfill({ json: envelope({ ...grant, status: revoked ? 'REVOKED' : 'AVAILABLE' }) }))
  await page.route(`**/api/v1/voucher-grants/${voucherId}/revoke`, route => { writes++; revoked = true; return route.abort() })
  await page.goto('/staff/promotions')
  await page.getByRole('button', { name: 'Chi tiết chiến dịch' }).click()
  await page.getByRole('button', { name: 'Thu hồi voucher', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Lý do', { exact: true }).fill('Original reason')
  await page.getByRole('button', { name: 'Xác nhận thu hồi' }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Chi tiết chiến dịch' }).click()
  await expect(page.getByRole('dialog').getByLabel('Lý do', { exact: true })).toHaveValue('Original reason')
  await expect(page.getByRole('button', { name: 'Gửi lại lệnh ban đầu' })).toBeDisabled()
  await page.getByRole('button', { name: 'Tải lại và kiểm tra' }).click()
  await expect(page.getByRole('button', { name: 'Gửi lại lệnh ban đầu' })).toHaveCount(0)
  await expect(page.locator('dt').filter({ hasText: /^Đã thu hồi$/ }).locator('..').locator('dd')).toHaveText('1')
  expect(writes).toBe(1)
})

test('an uncommitted revoke replays the exact original payload and key after reload and id lookup', async ({ page }) => {
  await setup(page, ['/vouchers_read', '/vouchers_revoke'])
  const writes: unknown[] = []
  await page.route(`**/api/v1/voucher-campaigns/${campaign.id}/grants?*`, route => route.fulfill({ json: envelope(paged([grant])) }))
  await page.route(`**/api/v1/voucher-grants/${voucherId}/revoke`, route => {
    writes.push(route.request().postDataJSON())
    return writes.length === 1 ? route.abort() : route.fulfill({ json: envelope({ ...grant, status: 'REVOKED' }) })
  })
  await page.goto('/staff/promotions')
  await page.getByRole('button', { name: 'Chi tiết chiến dịch' }).click()
  await page.getByRole('button', { name: 'Thu hồi voucher', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Lý do', { exact: true }).fill('Preserve this reason')
  await page.getByRole('button', { name: 'Xác nhận thu hồi' }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Chi tiết chiến dịch' }).click()
  await expect(page.getByRole('button', { name: 'Gửi lại lệnh ban đầu' })).toBeDisabled()
  await page.getByRole('button', { name: 'Tải lại và kiểm tra' }).click()
  await expect(page.getByRole('button', { name: 'Gửi lại lệnh ban đầu' })).toBeEnabled()
  await page.getByRole('button', { name: 'Gửi lại lệnh ban đầu' }).click()
  await expect(page.getByRole('button', { name: 'Gửi lại lệnh ban đầu' })).toHaveCount(0)
  expect(writes).toHaveLength(2)
  expect(writes[1]).toEqual(writes[0])
})

test('a confirmed reservation conflict lets staff dismiss the revoke form without another write', async ({ page }) => {
  await setup(page, ['/vouchers_read', '/vouchers_revoke'])
  let writes = 0
  await page.route(`**/api/v1/voucher-campaigns/${campaign.id}/grants?*`, route => route.fulfill({ json: envelope(paged([grant])) }))
  await page.route(`**/api/v1/voucher-grants/${voucherId}`, route => route.fulfill({ json: envelope({ ...grant, status: 'RESERVED' }) }))
  await page.route(`**/api/v1/voucher-grants/${voucherId}/revoke`, route => { writes++; return route.fulfill({ status: 409, json: { message: 'Reserved' } }) })
  await page.goto('/staff/promotions')
  await page.getByRole('button', { name: 'Chi tiết chiến dịch' }).click()
  await page.getByRole('button', { name: 'Thu hồi voucher', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Lý do', { exact: true }).fill('Issued in error')
  await page.getByRole('button', { name: 'Xác nhận thu hồi' }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
  await page.getByRole('button', { name: 'Tải lại và kiểm tra' }).click()
  await page.getByRole('button', { name: 'Hủy', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Gửi lại lệnh ban đầu' })).toHaveCount(0)
  expect(writes).toBe(1)
})

test('campaign input validation rejects invalid exact amounts without coercion or exceptions', async ({ page }) => {
  await setup(page)
  await page.goto('/account/vouchers')
  const results = await page.evaluate(async input => {
    const path = '/src/features/vouchers/vouchers.api.ts'
    const { campaignInputSchema } = await import(path)
    return [
      campaignInputSchema.safeParse(input).success,
      campaignInputSchema.safeParse({ ...input, discountValue: 'not-money' }).success,
      campaignInputSchema.safeParse({ ...input, discountValue: '100.00' }).success,
      campaignInputSchema.safeParse({ ...input, minSubtotal: '0' }).success,
      campaignInputSchema.safeParse({ ...input, maxDiscount: null }).success,
      campaignInputSchema.safeParse({ ...input, name: 'x'.repeat(101) }).success,
      campaignInputSchema.safeParse({ ...input, endDate: input.startDate }).success,
    ]
  }, { ...campaign, description: campaign.description })
  expect(results).toEqual([true, false, false, false, false, false, false])
})

async function openGift(page: Page, permissions = ['/vouchers_read', '/vouchers_issue', '/online-orders_read']) {
  await page.route('**/api/v1/auth/me/permissions', route => route.fulfill({ json: envelope(defaultMockAdminAuth(permissions)) }))
  await page.route('**/api/v1/online-orders/requests?*', route => route.fulfill({ json: envelope(paged([{
    id: orderId, pickupName: 'Voucher customer', phoneNumber: '0901234567',
    quotedSubtotal: '120000.00', hasCustomerAccount: true,
    createdAt: campaign.createdAt, expiresAt: campaign.endDate, items: [],
  }])) }))
  await page.goto('/staff/online-orders?tab=pending')
  await expect(page.getByTestId('order-net-total')).toBeVisible()
  if (permissions.includes('/vouchers_read') && permissions.includes('/vouchers_issue'))
    await page.getByRole('button', { name: 'Tặng voucher', exact: true }).click()
}

test('gift entry is hidden without read access and never requests campaigns', async ({ page }) => {
  await setup(page)
  let staffReads = 0
  page.on('request', request => { if (/voucher-campaigns\?/.test(request.url())) staffReads++ })
  await openGift(page, ['/vouchers_issue', '/online-orders_read'])
  await expect(page.getByRole('button', { name: 'Tặng voucher', exact: true })).toHaveCount(0)
  expect(staffReads).toBe(0)
})

test('uncertain gift survives reload, reconciles source grants, and replays the immutable original payload', async ({ page }) => {
  await setup(page)
  const bodies: unknown[] = []
  let recoveryReads = 0
  await page.route(`**/api/v1/voucher-campaigns/${campaign.id}/grants`, route => {
    bodies.push(route.request().postDataJSON())
    return bodies.length === 1 ? route.abort() : route.fulfill({ json: envelope({ customerId, voucherId }) })
  })
  await page.route(`**/api/v1/voucher-campaigns/${campaign.id}/grants?*`, route => {
    recoveryReads++
    expect(new URL(route.request().url()).searchParams.get('sourceOrderId')).toBe(orderId)
    return route.fulfill({ json: envelope(paged([])) })
  })
  await openGift(page)
  await page.getByLabel('Chọn chiến dịch đang phát hành', { exact: true }).selectOption(campaign.id)
  await page.getByRole('dialog').getByLabel('Lý do', { exact: true }).fill('Service recovery')
  await page.getByRole('button', { name: 'Xác nhận tặng' }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
  await expect(page.getByRole('dialog').getByLabel('Lý do', { exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Gửi lại lệnh ban đầu' })).toBeDisabled()
  expect(bodies).toHaveLength(1)
  await page.reload()
  await openGift(page)
  await expect(page.getByRole('dialog').getByLabel('Lý do', { exact: true })).toHaveValue('Service recovery')
  await expect(page.getByRole('button', { name: 'Gửi lại lệnh ban đầu' })).toBeDisabled()
  await page.getByRole('button', { name: 'Kiểm tra voucher của đơn nguồn' }).click()
  await expect(page.getByRole('button', { name: 'Gửi lại lệnh ban đầu' })).toBeEnabled()
  await page.getByRole('button', { name: 'Gửi lại lệnh ban đầu' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(bodies).toHaveLength(2)
  expect(bodies[1]).toEqual(bodies[0])
  expect(recoveryReads).toBe(1)
})

test('committed gift with invalid mutation response is recovered by reading without a second POST', async ({ page }) => {
  await setup(page)
  let writes = 0
  await page.route(`**/api/v1/voucher-campaigns/${campaign.id}/grants`, route => {
    writes++
    return route.fulfill({ json: envelope({ id: voucherId }) })
  })
  await page.route(`**/api/v1/voucher-campaigns/${campaign.id}/grants?*`, route => route.fulfill({ json: envelope(paged([grant])) }))
  await openGift(page)
  await page.getByLabel('Chọn chiến dịch đang phát hành', { exact: true }).selectOption(campaign.id)
  await page.getByRole('dialog').getByLabel('Lý do', { exact: true }).fill('Service recovery')
  await page.getByRole('button', { name: 'Xác nhận tặng' }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
  await page.getByRole('button', { name: 'Kiểm tra voucher của đơn nguồn' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(writes).toBe(1)
})
