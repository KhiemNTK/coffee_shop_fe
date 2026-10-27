import { expect, test, type Page } from '@playwright/test'
import {
  defaultMockAdminAuth,
  defaultMockAdminEmployee,
  envelope,
} from './helpers.js'

const id = '30000000-0000-4000-8000-000000000001'
const stationId = '30000000-0000-4000-8000-000000000002'
const asOf = '2026-10-11T10:00:00.000Z'
const empty = { list: [], totalItems: 0, totalPages: 0, currentPage: 1 }
const summary = {
  asOf,
  counts: {
    PAYMENT: 1,
    CASH_EXPENSE: 2,
    CASH_HANDOVER: 0,
    FEEDBACK: 0,
    KITCHEN_OVERDUE: 1,
    ONLINE_PICKUP_LATE: 1,
    OUTBOX_DEAD_LETTER: 0,
    PRINT_REVIEW: 0,
  },
  total: 5,
}
const workload = {
  asOf,
  dueSoonWindowSeconds: 300,
  stations: [
    {
      stationId,
      stationCode: 'BAR',
      stationName: 'Quầy pha chế',
      isActive: true,
      openTicketCount: 3,
      openUnitCount: 5,
      overdueTicketCount: 1,
      dueSoonTicketCount: 1,
    },
  ],
}

const failedEvent = {
  id, topic: 'order', eventName: 'order.invoice.paid', aggregateType: 'Invoice',
  aggregateId: stationId, status: 'DEAD_LETTER', attempts: 5, occurredAt: asOf,
  availableAt: asOf,
  lastErrorCode: 'PERMANENT_REJECTION', lastFailedAt: asOf, requestId: 'original-request-12345678',
}

async function outboxQueue(page: Page, retryPermission = true) {
  await staff(page, ['/management-exceptions_read', ...(retryPermission ? ['/outbox-events_retry'] : [])])
  await operations(page)
  let queued = false
  await page.route('**/api/v1/management/exceptions/summary', (route) => route.fulfill({
    json: envelope({ ...summary, counts: { ...summary.counts, OUTBOX_DEAD_LETTER: queued ? 0 : 1 }, total: queued ? 5 : 6 }),
  }))
  await page.route('**/api/v1/management/exceptions?*', (route) => route.fulfill({
    json: envelope({ kind: 'OUTBOX_DEAD_LETTER', list: queued ? [] : [failedEvent], currentPage: 1, totalPages: queued ? 0 : 1, totalItems: queued ? 0 : 1 }),
  }))
  await page.goto('/staff/operations?kind=OUTBOX_DEAD_LETTER')
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click()
  return () => { queued = true }
}

test('read-only managers see dead letters without recovery commands', async ({ page }, info) => {
  await outboxQueue(page, false)
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('order.invoice.paid', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Số lần lỗi', { exact: true })).toBeVisible()
  await expect(dialog.getByText('PERMANENT_REJECTION', { exact: true })).toBeVisible()
  await expect(dialog.getByText('original-request-12345678', { exact: true })).toBeVisible()
  await expect(dialog.getByLabel('Lý do phục hồi')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('outbox-read-only.png'), fullPage: true })
})

for (const printPermission of [false, true]) {
  test(`print review opens the exact job only with print-read permission: ${printPermission}`, async ({ page }, info) => {
    await staff(page, ['/management-exceptions_read', ...(printPermission ? ['/print-jobs_read'] : [])])
    await operations(page)
    const job = {
      id, type: 'RECEIPT', status: 'REQUIRES_REVIEW', copies: 1, attempts: 1, maxAttempts: 5,
      createdAt: asOf, updatedAt: asOf, device: null,
    }
    await page.route('**/api/v1/management/exceptions?*', route => route.fulfill({
      json: envelope({ kind: 'PRINT_REVIEW', list: [job], totalItems: 1, totalPages: 1, currentPage: 1 }),
    }))
    await page.route('**/api/v1/printing/jobs**', route => route.fulfill({
      json: envelope(new URL(route.request().url()).pathname.endsWith('/' + id) ? job : { list: [job], totalItems: 1, totalPages: 1, currentPage: 1 }),
    }))
    await page.goto('/staff/operations?kind=PRINT_REVIEW')
    await page.getByRole('button', { name: 'Chi tiết', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText(/Chưa xác nhận được giấy đã in/)).toBeVisible()
    const link = dialog.getByRole('link', { name: 'Kiểm tra phiếu in', exact: true })
    if (printPermission) {
      await link.click()
      await expect(page).toHaveURL(new RegExp('/staff/printing\\?tab=JOBS&job=' + id))
      await expect(page.getByRole('dialog')).toContainText('Chi tiết Lệnh in')
      await expect(page.getByRole('dialog')).toContainText(id)
      await expect(page.getByRole('dialog').getByRole('button', { name: 'Xác nhận đã in', exact: true })).toHaveCount(0)
    } else {
      await expect(link).toHaveCount(0)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath('print-review-permission.png'), fullPage: true })
  })
}

for (const failure of [{ status: 429, code: 'HTTP_429' }, { status: 503, code: 'DATABASE_BUSY' }]) {
test(`operations read failures expose support IDs and respect retry-after (${failure.code})`, async ({ page }, info) => {
  await page.clock.install()
  await staff(page, ['/management-exceptions_read'])
  let reads = 0
  for (const endpoint of ['summary', '?*']) {
    await page.route('**/api/v1/management/exceptions' + (endpoint === 'summary' ? '/summary' : endpoint), route => {
      reads++
      return route.fulfill({
        status: failure.status, headers: { 'retry-after': '120' },
        json: { data: null, message: 'ERROR', code: failure.code, requestId: 'ops-read-' + (endpoint === 'summary' ? 'summary' : 'list'), errors: [{ message: 'Service is busy' }] },
      })
    })
  }
  await page.goto('/staff/operations')
  await expect(page.getByRole('alert').filter({ hasText: 'ops-read-summary' })).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: 'ops-read-list' })).toBeVisible()
  if (failure.code === 'DATABASE_BUSY') await expect(page.getByRole('alert').filter({ hasText: 'ops-read-list' })).toContainText('đang bận')
  await expect(page.getByRole('button', { name: 'Làm mới tổng quan', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Thử lại', exact: true })).toBeDisabled()
  const initialReads = reads
  await page.clock.fastForward(31_000)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  expect(reads).toBe(initialReads)
  await expect(page.getByRole('button', { name: 'Thử lại', exact: true })).toBeDisabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('operations-support-errors.png'), fullPage: true })
})
}

test('recovery confirms once, prevents double submit and reports queued rather than published', async ({ page }, info) => {
  const markQueued = await outboxQueue(page)
  const calls: Record<string, unknown>[] = []
  await page.route('**/api/v1/management/exceptions/outbox/*/retry', async (route) => {
    calls.push(route.request().postDataJSON() as Record<string, unknown>)
    await new Promise(resolve => setTimeout(resolve, 200))
    markQueued()
    await route.fulfill({ json: envelope({ id, status: 'PENDING' }) })
  })
  await page.getByLabel('Lý do phục hồi').fill('Đã sửa consumer máy in')
  await page.getByRole('button', { name: 'Đưa lại vào hàng đợi', exact: true }).click()
  expect(calls).toHaveLength(0)
  await page.screenshot({ path: info.outputPath('outbox-confirmation.png'), fullPage: true })
  await page.getByRole('button', { name: 'Xác nhận phục hồi', exact: true }).dblclick()
  await expect(page.getByRole('status').filter({ hasText: 'Đã đưa event lại vào hàng đợi' })).toBeVisible()
  expect(calls).toHaveLength(1)
  expect(calls[0]).toMatchObject({ reason: 'Đã sửa consumer máy in', expectedAvailableAt: asOf })
  expect(calls[0]?.idempotencyKey).toEqual(expect.any(String))
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('uncertain recovery resends the exact same body and idempotency key', async ({ page }) => {
  const markQueued = await outboxQueue(page)
  const calls: Record<string, unknown>[] = []
  await page.route('**/api/v1/management/exceptions/outbox/*/retry', async (route) => {
    calls.push(route.request().postDataJSON() as Record<string, unknown>)
    if (calls.length === 1) return route.abort('failed')
    markQueued()
    return route.fulfill({ json: envelope({ id, status: 'PENDING' }) })
  })
  await page.getByLabel('Lý do phục hồi').fill('Đã kiểm tra kết nối máy in')
  await page.getByRole('button', { name: 'Đưa lại vào hàng đợi', exact: true }).click()
  await page.getByRole('button', { name: 'Xác nhận phục hồi', exact: true }).click()
  await expect(page.getByLabel('Lý do phục hồi')).toBeDisabled()
  await page.getByRole('button', { name: 'Gửi lại lệnh chưa xác nhận', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(calls).toHaveLength(2)
  expect(calls[0]).toEqual(calls[1])
})

test('stale recovery requires reloading the exception before another submission', async ({ page }) => {
  await outboxQueue(page)
  let calls = 0
  await page.route('**/api/v1/management/exceptions/outbox/*/retry', (route) => {
    calls++
    return route.fulfill({ status: 409, json: { data: null, message: 'Event đã thay đổi. Tải lại trước khi thử.', code: 'CONFLICT' } })
  })
  await page.getByLabel('Lý do phục hồi').fill('Đã sửa lỗi kết nối')
  await page.getByRole('button', { name: 'Đưa lại vào hàng đợi', exact: true }).click()
  await page.getByRole('button', { name: 'Xác nhận phục hồi', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Event đã thay đổi')
  await expect(page.getByRole('button', { name: 'Xác nhận phục hồi', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Kiểm tra lại ngoại lệ', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Xác nhận phục hồi', exact: true })).toBeEnabled()
  expect(calls).toBe(1)
})

async function staff(page: Page, permissions: string[]) {
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({ status: 503, json: {} }),
  )
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminEmployee) }),
  )
  await page.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminAuth(permissions)) }),
  )
}

async function operations(page: Page) {
  await page.route('**/api/v1/management/exceptions/summary', (route) =>
    route.fulfill({ json: envelope(summary) }),
  )
  await page.route('**/api/v1/management/exceptions?*', (route) => {
    const query = new URL(route.request().url()).searchParams
    const kind = query.get('kind')
    const pageNumber = Number(query.get('page') || 1)
    return route.fulfill({
      json: envelope({ kind, ...empty, currentPage: pageNumber }),
    })
  })
}

test('expense-only reviewers have the same navigation and route access without fetching cashier data', async ({
  page,
}) => {
  await staff(page, ['/cashier-shifts_expenses-review'])
  const reads: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/') && !request.url().includes('/auth/'))
      reads.push(request.url())
  })
  await page.route('**/api/v1/cashier-shifts/expense-requests?*', (route) =>
    route.fulfill({ json: envelope(empty) }),
  )
  await page.goto('/staff')
  await expect(
    page.getByRole('heading', { name: defaultMockAdminEmployee.fullName }),
  ).toBeVisible()
  await expect(
    page
      .getByRole('link', { name: 'Ca & Quỹ tiền mặt', exact: true })
      .filter({ visible: true }),
  ).toHaveCount(2)
  expect(reads).toEqual([])
  await page
    .getByRole('main')
    .getByRole('link', { name: 'Ca & Quỹ tiền mặt', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: /Hàng đợi Phê duyệt/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Ca làm việc của tôi' }),
  ).toHaveCount(0)
  expect(reads.every((url) => url.includes('/expense-requests?'))).toBe(true)
})

test('employees without permissions see no operational data or privileged links', async ({
  page,
}) => {
  await staff(page, [])
  let reads = 0
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/') && !request.url().includes('/auth/'))
      reads++
  })
  await page.goto('/staff')
  await expect(
    page.getByText('Chưa được cấp quyền nghiệp vụ.', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Trung tâm vận hành', exact: true }),
  ).toHaveCount(0)
  await page.goto('/staff/operations')
  await expect(page.getByRole('alert')).toContainText('Không có quyền truy cập')
  expect(reads).toBe(0)
  await page.goto('/staff/account')
  await expect(
    page.getByText(defaultMockAdminEmployee.email, { exact: true }),
  ).toBeVisible()
})

test('staff account shows real identity without a fabricated branch', async ({ page }, info) => {
  await staff(page, [])
  await page.goto('/staff/account')
  await expect(page.getByRole('heading', { name: defaultMockAdminEmployee.fullName, exact: true })).toBeVisible()
  const details = page.getByRole('region', { name: 'Thông tin nhân sự', exact: true })
  await expect(details.getByText(defaultMockAdminEmployee.email, { exact: true })).toBeVisible()
  await expect(details.getByText(`@${defaultMockAdminEmployee.username}`, { exact: true })).toBeVisible()
  await expect(details.getByText(defaultMockAdminEmployee.id, { exact: true })).toBeVisible()
  await expect(details.getByText(defaultMockAdminEmployee.position.name, { exact: true })).toBeVisible()
  await expect(details.getByText('ADMIN', { exact: true })).toBeVisible()
  await expect(page.locator('body')).not.toContainText(/chi nhánh|trụ sở chính/i)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('staff-account-single-store.png'), fullPage: true })
})

test('workdesk read failures never become zero counts or an empty healthy shift', async ({
  page,
}) => {
  await staff(page, [
    '/cashier-shifts_current',
    '/kitchen-tickets_read',
    '/online-orders_read',
    '/management-exceptions_read',
  ])
  await page.goto('/staff')
  for (const title of [
    'Ca thu ngân của tôi',
    'Tải lượng bếp',
    'Đơn mang đi chờ tiếp nhận',
    'Việc cần quản lý xử lý',
  ]) {
    const region = page.getByRole('region', { name: title, exact: true })
    await expect(region.getByRole('alert')).toContainText(
      'Dịch vụ tạm thời không khả dụng',
    )
    await expect(region.getByText('0', { exact: true })).toHaveCount(0)
  }
  await expect(page.getByText('Chưa có ca mở.', { exact: true })).toHaveCount(0)
})

test('workdesk displays live bounded summaries and stays within the viewport', async ({
  page,
}, info) => {
  await staff(page, [
    '/cashier-shifts_current',
    '/kitchen-tickets_read',
    '/online-orders_read',
    '/management-exceptions_read',
  ])
  await operations(page)
  await page.route('**/api/v1/cashier-shifts/current', (route) =>
    route.fulfill({
      json: envelope({
        id,
        openedAt: asOf,
        startingCash: '100000',
        status: 'OPEN',
        employeeId: defaultMockAdminEmployee.id,
        employee: {
          id: defaultMockAdminEmployee.id,
          fullName: defaultMockAdminEmployee.fullName,
        },
        fund: { id, name: 'Két thu ngân', type: 'CASH', balance: '100000' },
      }),
    }),
  )
  await page.route('**/api/v1/kitchen/workload', (route) =>
    route.fulfill({ json: envelope(workload) }),
  )
  await page.route('**/api/v1/online-orders/requests?*', (route) => {
    expect(new URL(route.request().url()).searchParams.get('itemPerPage')).toBe(
      '1',
    )
    return route.fulfill({
      json: envelope({ ...empty, totalItems: 7, totalPages: 7 }),
    })
  })
  await page.goto('/staff')
  await expect(page.getByText('Két thu ngân', { exact: true })).toBeVisible()
  await expect(
    page
      .getByRole('region', { name: 'Đơn mang đi chờ tiếp nhận' })
      .getByText('7', { exact: true }),
  ).toBeVisible()
  await expect(
    page
      .getByRole('region', { name: 'Việc cần quản lý xử lý' })
      .getByText('5', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Quầy pha chế 3 phiếu · 1 trễ' }),
  ).toHaveAttribute('href', '/staff/kitchen?stationId=' + stationId)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: info.outputPath('workdesk.png'),
    fullPage: true,
  })
})

test('queue kind, page and detail survive reload and returning from the cash workflow', async ({
  page,
}, info) => {
  await staff(page, [
    '/management-exceptions_read',
    '/cashier-shifts_expenses-review',
  ])
  await operations(page)
  await page.route('**/api/v1/management/exceptions?*', (route) => {
    const params = new URL(route.request().url()).searchParams
    return route.fulfill({
      json: envelope({
        kind: params.get('kind'),
        currentPage: Number(params.get('page') || 1),
        totalItems: 21,
        totalPages: 2,
        list: [
          {
            id,
            description: 'Phiếu chi cần duyệt',
            shiftId: stationId,
            amount: '150000',
            createdAt: asOf,
          },
        ],
      }),
    })
  })
  await page.route('**/api/v1/cashier-shifts/expense-requests?*', (route) =>
    route.fulfill({ json: envelope(empty) }),
  )
  await page.goto('/staff/operations?kind=CASH_EXPENSE&page=2')
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click()
  await expect(page).toHaveURL(new RegExp('exception=' + id))
  await page.reload()
  const dialog = page.getByRole('dialog', { name: 'Chi tiết ngoại lệ' })
  await expect(dialog).toContainText('Phiếu chi cần duyệt')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: info.outputPath('operations-detail.png'),
    fullPage: true,
  })
  await dialog.getByRole('link', { name: 'Mở nghiệp vụ ca và quỹ' }).click()
  await expect(page).toHaveURL(/\/staff\/shifts\?tab=expenses$/)
  await expect(
    page.getByRole('heading', { name: /Hàng đợi Phê duyệt/ }),
  ).toBeVisible()
  await page.goBack()
  await expect(
    page.getByRole('tab', { name: /Chi quỹ tiền mặt/ }),
  ).toHaveAttribute('aria-selected', 'true')
  await expect(dialog).toContainText('Phiếu chi cần duyệt')
  await dialog.getByRole('button', { name: 'Đóng' }).click()
  await expect(page).toHaveURL(/kind=CASH_EXPENSE&page=2$/)
})

test('new queue cases open the kitchen station and overdue fulfillment filters', async ({
  page,
}) => {
  await staff(page, [
    '/management-exceptions_read',
    '/kitchen-tickets_read',
    '/online-orders_read',
  ])
  await operations(page)
  await page.route('**/api/v1/management/exceptions?*', (route) => {
    const kind = new URL(route.request().url()).searchParams.get('kind')
    return route.fulfill({
      json: envelope({
        kind,
        totalItems: 1,
        totalPages: 1,
        currentPage: 1,
        list: [
          {
            id,
            stationId,
            station: { code: 'BAR', name: 'Quầy pha chế' },
            sequence: 5,
            dueAt: asOf,
            pickupAt: asOf,
            createdAt: asOf,
          },
        ],
      }),
    })
  })
  await page.route('**/api/v1/kitchen/workload', (route) =>
    route.fulfill({ json: envelope(workload) }),
  )
  let selectedStation = ''
  await page.route('**/api/v1/kitchen/tickets?*', (route) => {
    selectedStation =
      new URL(route.request().url()).searchParams.get('stationId') || ''
    return route.fulfill({ json: envelope(empty) })
  })
  let overdue = ''
  await page.route(
    '**/api/v1/online-orders/requests/fulfillment?*',
    (route) => {
      overdue =
        new URL(route.request().url()).searchParams.get('overdueOnly') || ''
      return route.fulfill({ json: envelope(empty) })
    },
  )
  await page.goto('/staff/operations?kind=KITCHEN_OVERDUE')
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click()
  await page.getByRole('link', { name: 'Mở trạm bếp' }).click()
  await expect.poll(() => selectedStation).toBe(stationId)
  await expect(
    page.getByRole('button', { name: 'Quầy pha chế (BAR)', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('checkbox', { name: 'Xem cả món đã xong', exact: true }).check()
  await expect(page).toHaveURL(/includeCompleted=true/)
  await page.reload()
  await expect(
    page.getByRole('checkbox', { name: 'Xem cả món đã xong', exact: true }),
  ).toBeChecked()
  await page.goto('/staff/operations?kind=ONLINE_PICKUP_LATE')
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click()
  await page.getByRole('link', { name: 'Mở đơn quá giờ hẹn' }).click()
  await expect.poll(() => overdue).toBe('true')
  await page.reload()
  await expect(page).toHaveURL(/tab=fulfillment&overdueOnly=true/)
  await expect(
    page.getByRole('tab', { name: 'Đang chế biến & Chờ nhận' }),
  ).toHaveAttribute('aria-selected', 'true')
})

test('invalid URL filters are not forwarded to the API', async ({ page }) => {
  await staff(page, ['/management-exceptions_read'])
  await operations(page)
  let received = ''
  await page.route('**/api/v1/management/exceptions?*', (route) => {
    const params = new URL(route.request().url()).searchParams
    received = params.get('kind') + ':' + params.get('page')
    return route.fulfill({ json: envelope({ ...empty, kind: 'PAYMENT' }) })
  })
  await page.goto('/staff/operations?kind=ADMIN_BYPASS&page=-20')
  await expect.poll(() => received).toBe('PAYMENT:1')
  await expect(
    page.getByRole('tab', { name: /Đối soát Cổng TT/ }),
  ).toHaveAttribute('aria-selected', 'true')
})

test('missing summary fields produce an error, never invented zero counters', async ({
  page,
}) => {
  await staff(page, ['/management-exceptions_read'])
  await operations(page)
  await page.route('**/api/v1/management/exceptions/summary', (route) =>
    route.fulfill({ json: envelope({ counts: {}, total: 0 }) }),
  )
  await page.goto('/staff/operations')
  await expect(page.getByRole('alert')).toContainText('Phản hồi không hợp lệ')
  await expect(page.getByRole('tab', { name: /Phiếu bếp trễ/ })).toContainText(
    '—',
  )
})

test('queue tabs support keyboard navigation and keep URL state', async ({
  page,
}) => {
  await staff(page, ['/management-exceptions_read'])
  await operations(page)
  await page.goto('/staff/operations')
  const tab = page.getByRole('tab', { name: /Đối soát Cổng TT/ })
  await tab.focus()
  await tab.press('ArrowRight')
  await expect(page).toHaveURL(/kind=CASH_EXPENSE/)
  await expect(
    page.getByRole('tabpanel', { name: /Chi quỹ tiền mặt/ }),
  ).toBeVisible()
})

test('an out-of-range queue page cannot claim the whole queue is healthy', async ({
  page,
}) => {
  await staff(page, ['/management-exceptions_read'])
  await operations(page)
  await page.route('**/api/v1/management/exceptions?*', (route) => {
    const currentPage = Number(
      new URL(route.request().url()).searchParams.get('page') || 1,
    )
    return route.fulfill({
      json: envelope({
        ...empty,
        kind: 'PAYMENT',
        totalItems: 21,
        totalPages: 2,
        currentPage,
      }),
    })
  })
  await page.goto('/staff/operations?page=20')
  await expect(
    page.getByText('Không có ngoại lệ trên trang này.', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText('Không có ngoại lệ tồn đọng', { exact: true }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Về trang đầu', exact: true }).click()
  await expect(page).toHaveURL(/\/staff\/operations$/)
})

test('uncertain incident writes require a fresh read and never automatically replay', async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: 'csrfToken',
      value: 'fixture-csrf',
      domain: 'localhost',
      path: '/',
    },
  ])
  await staff(page, [
    '/management-exceptions_read',
    '/payment-reconciliation_manage',
  ])
  await operations(page)
  let reads = 0
  await page.route('**/api/v1/management/exceptions?*', (route) => {
    reads++
    return route.fulfill({
      json: envelope({
        kind: 'PAYMENT',
        totalItems: 1,
        totalPages: 1,
        currentPage: 1,
        list: [
          {
            id,
            title: 'Giao dịch cần xác minh',
            detectedAt: asOf,
            paymentAttemptId: null,
          },
        ],
      }),
    })
  })
  let writes = 0
  await page.route(
    '**/api/v1/payment-reconciliation/incidents/' + id + '/resolve',
    (route) => {
      writes++
      expect(route.request().postDataJSON()).toEqual({
        action: 'RESOLVE',
        resolutionNote: 'Đã kiểm tra giao dịch',
      })
      return route.fulfill({ status: 503, json: {} })
    },
  )
  await page.goto('/staff/operations')
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Chi tiết ngoại lệ' })
  await expect(
    dialog.getByRole('button', { name: 'Đánh dấu đã xử lý' }),
  ).toBeDisabled()
  await dialog.getByLabel('Ghi chú xử lý').fill('Đã kiểm tra giao dịch')
  await dialog.getByRole('button', { name: 'Đánh dấu đã xử lý' }).click()
  expect(writes).toBe(0)
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(
    dialog.getByRole('button', { name: 'Xác nhận', exact: true }),
  ).toBeDisabled()
  const priorReads = reads
  await dialog.getByRole('button', { name: 'Kiểm tra lại ngoại lệ' }).click()
  await expect.poll(() => reads).toBeGreaterThan(priorReads)
  await expect(
    dialog.getByRole('button', { name: 'Xác nhận', exact: true }),
  ).toBeEnabled()
  expect(writes).toBe(1)
})
