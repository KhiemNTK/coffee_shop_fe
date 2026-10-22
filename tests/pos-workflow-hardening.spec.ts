import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const id = '91000000-0000-4000-8000-000000000001'
const otherId = '91000000-0000-4000-8000-000000000002'
const reservedId = '91000000-0000-4000-8000-000000000003'
const date = '2026-10-21T08:00:00Z'
const paged = (list: unknown[]) => ({
  list,
  currentPage: 1,
  totalPages: 1,
  totalItems: list.length
})

async function staff(page: Page, permissions: string[]) {
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({ status: 503, json: { message: 'Unmocked API' } })
  )
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminEmployee) })
  )
  await page.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminAuth(permissions)) })
  )
}

test('POS cards and counts agree through remote opening, transfer and reserved tables', async ({
  page
}, info) => {
  await page.clock.install()
  await staff(page, ['/dining-tables_read', '/orders_sessions_read'])
  let occupiedId = id
  let committed = false
  let tableReads = 0
  let sessionReads = 0
  const tables = () => [
    { id, name: 'Bàn A', status: committed && occupiedId === id ? 'OCCUPIED' : 'EMPTY' },
    {
      id: otherId,
      name: 'Bàn B',
      status: committed && occupiedId === otherId ? 'OCCUPIED' : 'EMPTY'
    },
    { id: reservedId, name: 'Bàn C', status: 'RESERVED' }
  ]
  await page.route('**/api/v1/dining-tables', (route) => {
    tableReads++
    return route.fulfill({ json: envelope(tables()) })
  })
  await page.route('**/api/v1/orders/sessions', (route) => {
    sessionReads++
    return route.fulfill({
      json: envelope(
        occupiedId
          ? [
              {
                id: reservedId,
                sessionStatus: 'ACTIVE',
                createdAt: date,
                updatedAt: date,
                table: tables().find((table) => table.id === occupiedId),
                employee: defaultMockAdminEmployee,
                _count: { orderItems: 1 }
              }
            ]
          : []
      )
    })
  })
  await page.route('**/api/v1/orders/takeaway/handoff?*', (route) =>
    route.fulfill({ json: envelope(paged([])) })
  )
  await page.goto('/staff/pos')
  const count = (label: string) => page.getByText(label, { exact: true }).locator('..').locator('p')
  await expect(count('Đang có khách')).toHaveText('1')
  await expect(count('Bàn trống')).toHaveText('1')
  await expect(count('Bàn giữ chỗ')).toHaveText('1')
  await expect(page.getByRole('button', { name: /Bàn A/ })).toContainText('Có khách')
  await expect(page.getByRole('button', { name: /Bàn C/ })).toBeDisabled()
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  committed = true
  await page.clock.runFor(10_100)
  await expect.poll(() => tableReads).toBeGreaterThan(1)
  occupiedId = otherId
  await expect
    .poll(async () => {
      await page.clock.runFor(10_100)
      return page.getByRole('button', { name: /Bàn A/ }).textContent()
    })
    .toContain('Trống')
  await expect(page.getByRole('button', { name: /Bàn B/ })).toContainText('Có khách')
  occupiedId = ''
  await expect
    .poll(async () => {
      await page.clock.runFor(10_100)
      return count('Đang có khách').textContent()
    })
    .toBe('0')
  await expect(count('Bàn trống')).toHaveText('2')
  expect(sessionReads).toBeGreaterThan(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('pos-table-status.png') })
})

for (const target of [
  {
    path: '/staff/inventory',
    permission: '/inventory_read',
    api: '**/api/v1/inventory/items?*',
    label: 'Tìm nguyên liệu'
  },
  {
    path: '/staff/menu',
    permission: '/menu_read',
    api: '**/api/v1/menu/items?*',
    label: 'Tìm tên món'
  },
  {
    path: '/staff/audit-logs',
    permission: '/audit-logs_read',
    api: '**/api/v1/audit-logs?*',
    label: undefined
  },
  {
    path: '/staff/inventory',
    permission: '/inventory_suppliers_read',
    api: '**/api/v1/inventory/suppliers?*',
    label: 'Tìm nhà cung cấp'
  }
]) {
  test(`debounces ${target.label ?? target.path} search without requesting partial keywords`, async ({
    page
  }) => {
    await page.clock.install()
    await staff(page, ['/inventory_read', target.permission])
    const queries: string[] = []
    await page.route(target.api, (route) => {
      const params = new URL(route.request().url()).searchParams
      queries.push(params.get('keyword') ?? params.get('actionType') ?? '')
      return route.fulfill({ json: envelope(paged([])) })
    })
    for (const api of ['inventory/categories', 'inventory/units', 'inventory/reorder-alerts'])
      await page.route(`**/api/v1/${api}*`, (route) =>
        route.fulfill({ json: envelope(api.endsWith('reorder-alerts') ? paged([]) : []) })
      )
    if (target.permission === '/inventory_suppliers_read')
      await page.route('**/api/v1/inventory/items?*', (route) =>
        route.fulfill({ json: envelope(paged([])) })
      )
    await page.goto(target.path)
    if (target.permission === '/inventory_suppliers_read')
      await page.getByRole('button', { name: 'Mua hàng & Kiểm kê', exact: true }).click()
    const input = target.label
      ? page.getByLabel(target.label, { exact: true })
      : page.getByPlaceholder(/Tìm theo loại hành động/)
    await expect(input).toBeVisible()
    await expect.poll(() => queries.length).toBeGreaterThan(0)
    await page.clock.pauseAt(new Date(Date.now() + 1000))
    const before = queries.length
    await input.fill('R')
    await input.fill('Ro')
    await input.fill('Robusta')
    await expect(input).toHaveValue('Robusta')
    await page.clock.runFor(299)
    expect(queries).toHaveLength(before)
    await page.clock.runFor(1)
    await expect.poll(() => queries.length).toBe(before + 1)
    expect(queries.at(-1)).toBe('Robusta')
  })
}

test('a page render failure preserves staff navigation and resets on route changes', async ({
  page
}) => {
  await staff(page, ['/menu_read'])
  await page.route('**/src/features/menu/staff-menu-page.tsx*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'export default function FixturePage() { if (!window.fixtureRecovered) throw new Error("Fixture render failure"); return null }'
    })
  )
  await page.goto('/staff/menu')
  await expect(page.getByRole('heading', { name: 'Chưa mở được màn hình' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Thử lại', exact: true })).toBeVisible()
  await page.evaluate(() => {
    Object.assign(window, { fixtureRecovered: true })
  })
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Chưa mở được màn hình' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Tài khoản', exact: true }).first().click()
  await expect(
    page.getByRole('heading', { name: defaultMockAdminEmployee.fullName, exact: true })
  ).toBeVisible()
  await page.evaluate(() => {
    Object.assign(window, { fixtureRecovered: true })
  })
  const navigation = page.getByRole('button', { name: 'Mở danh mục điều hướng' })
  if (await navigation.isVisible()) {
    await navigation.click()
    await page.getByRole('dialog').getByRole('link', { name: 'Thực đơn', exact: true }).click()
  } else {
    await page.getByRole('link', { name: 'Thực đơn', exact: true }).click()
  }
  await expect(page).toHaveURL('/staff/menu')
  await expect(page.getByRole('heading', { name: 'Chưa mở được màn hình' })).toHaveCount(0)
})

async function checkout(page: Page, settle = true) {
  await page.route(`**/api/v1/orders/sessions/${id}`, (route) =>
    route.fulfill({
      json: envelope({
        id,
        sessionStatus: 'ACTIVE',
        createdAt: date,
        table: null,
        employee: defaultMockAdminEmployee,
        orderItems: [
          {
            id: otherId,
            quantity: 1,
            priceAtTime: '35000',
            isPaid: false,
            serveStatus: 'SERVED',
            menuItem: { id: reservedId, name: 'Coffee receipt', price: '35000' }
          }
        ]
      })
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
  await page.route('**/api/v1/invoices/checkout', (route) =>
    route.fulfill({
      json: envelope({
        id,
        invoiceNumber: 'RECEIPT-001',
        subTotal: '35000',
        totalAmount: '35000',
        discountAmount: '0',
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        amountTendered: '35000',
        changeAmount: '0'
      })
    })
  )
  await page.goto(`/staff/pos/sessions/${id}`)
  await page
    .getByRole('button', { name: /^Thanh toán \(/ })
    .first()
    .click()
  if (settle) {
    await page.getByRole('button', { name: 'Xác nhận thanh toán tiền mặt' }).click()
    await expect(page.getByRole('heading', { name: 'Thanh toán thành công!' })).toBeVisible()
  }
}

const job = {
  id: 'receipt-job',
  type: 'RECEIPT',
  status: 'PENDING',
  copies: 1,
  attempts: 0,
  maxAttempts: 3,
  createdAt: date,
  updatedAt: date,
  invoiceId: id
}

test('checkout follows the automatic print job and retries an uncertain reprint with the same key', async ({
  page
}, info) => {
  await page.clock.install()
  await staff(page, [
    '/orders_sessions_read',
    '/invoices_create', '/invoices_pay',
    '/print-jobs_read',
    '/receipts_reprint'
  ])
  let status = 'PENDING'
  const writes: Record<string, unknown>[] = []
  await page.route('**/api/v1/printing/jobs?*', (route) => {
    expect(new URL(route.request().url()).searchParams.get('invoiceId')).toBe(id)
    return route.fulfill({ json: envelope(paged([{ ...job, status }])) })
  })
  await page.route(`**/api/v1/printing/invoices/${id}/reprint`, (route) => {
    writes.push(route.request().postDataJSON())
    if (writes.length === 1)
      return route.fulfill({ status: 503, json: { message: 'Uncertain print request' } })
    status = 'PENDING'
    return route.fulfill({ json: envelope(job) })
  })
  await checkout(page)
  const receipt = page.getByRole('region', { name: 'In hóa đơn', exact: true })
  await expect(receipt.getByRole('status')).toHaveText('Đã xếp hàng in, chưa xác nhận in giấy.')
  await expect(receipt.getByRole('button', { name: 'In lại hóa đơn', exact: true })).toBeDisabled()
  expect(writes).toHaveLength(0)
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  status = 'PRINTED'
  await expect
    .poll(async () => {
      await page.clock.runFor(3100)
      return receipt.getByRole('status').textContent()
    })
    .toBe('Thiết bị đã xác nhận in hóa đơn.')
  await receipt.getByRole('button', { name: 'In lại hóa đơn', exact: true }).click()
  await receipt.getByLabel('Lý do in lại').fill('Khách yêu cầu thêm bản in')
  await receipt.getByRole('button', { name: 'Xác nhận in lại' }).click()
  await expect(receipt.getByRole('alert')).toBeVisible()
  await expect(receipt.getByLabel('Lý do in lại')).toBeDisabled()
  await receipt.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect.poll(() => writes.length).toBe(2)
  expect(writes[1]).toEqual(writes[0])
  expect(writes[0]?.idempotencyKey).toEqual(expect.any(String))
  await expect
    .poll(async () => {
      await page.clock.runFor(50)
      return receipt.getByRole('status').textContent()
    })
    .toContain('Đã xếp hàng')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('checkout-receipt-queue.png') })
})

test('checkout without print permissions never calls print APIs', async ({ page }) => {
  await staff(page, ['/orders_sessions_read', '/invoices_create', '/invoices_pay'])
  let reads = 0
  await page.route('**/api/v1/printing/**', (route) => {
    reads++
    return route.fulfill({ status: 403 })
  })
  await checkout(page)
  await expect(page.getByRole('region', { name: 'In hóa đơn', exact: true })).toHaveCount(0)
  expect(reads).toBe(0)
})

test('a print service failure never blocks finishing a paid checkout or grants reprint permission', async ({
  page
}) => {
  await staff(page, ['/orders_sessions_read', '/invoices_create', '/invoices_pay', '/print-jobs_read'])
  await page.route('**/api/v1/printing/jobs?*', (route) =>
    route.fulfill({ status: 503, json: { message: 'Printer unavailable' } })
  )
  await checkout(page)
  const receipt = page.getByRole('region', { name: 'In hóa đơn', exact: true })
  await expect(receipt.getByRole('status')).toContainText('Thanh toán đã hoàn tất.')
  await expect(receipt.getByRole('button', { name: 'In lại hóa đơn' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Hoàn tất & Đóng' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('pre-check retries the same snapshot without creating an invoice or taking payment', async ({ page }, info) => {
  await staff(page, ['/orders_sessions_read', '/invoices_create', '/invoices_pay'])
  const requests: Record<string, unknown>[] = []
  let settlements = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith('/api/v1/invoices')) settlements++
  })
  await page.route('**/api/v1/printing/prechecks', (route) => {
    requests.push(route.request().postDataJSON())
    return requests.length === 1
      ? route.fulfill({ status: 503, json: { message: 'Unconfirmed print result' } })
      : route.fulfill({ json: envelope({ ...job, type: 'PRECHECK', invoiceId: null, orderSessionId: id }) })
  })
  await checkout(page, false)
  const modal = page.getByRole('dialog')
  await modal.getByRole('button', { name: 'In tạm tính', exact: true }).click()
  await expect(modal.getByRole('alert')).toBeVisible()
  await expect(modal.getByRole('button', { name: 'Xác nhận thanh toán tiền mặt' })).toBeEnabled()
  await modal.getByRole('button', { name: 'Kiểm tra lại yêu cầu in', exact: true }).click()
  await expect(modal.getByRole('status')).toContainText('chưa xác nhận in ra giấy')
  await expect(modal.getByRole('status')).toContainText('Chưa có máy in được gán')
  expect(requests).toHaveLength(2)
  expect(requests[1]).toEqual(requests[0])
  expect(requests[0]).toMatchObject({ orderSessionId: id, orderItemIds: [otherId], promotionId: null })
  expect(requests[0]).not.toHaveProperty('totalAmount')
  expect(settlements).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('precheck-queued.png') })
})
