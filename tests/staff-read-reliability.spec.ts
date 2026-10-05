import { expect, test, type Page } from '@playwright/test'
import {
  defaultMockAdminAuth,
  defaultMockAdminEmployee,
  envelope,
} from './helpers.js'

const id = '30000000-0000-4000-8000-000000000001'
const date = '2026-10-04T08:00:00.000Z'
const paged = (list: unknown[], page = 1, totalItems = 21) => ({
  list,
  currentPage: page,
  totalItems,
  totalPages: Math.ceil(totalItems / 20),
})
const device = {
  id,
  name: 'Printer',
  type: 'RECEIPT',
  paperSize: '80mm',
  status: 'READY',
  isActive: true,
  isDefault: true,
  createdAt: date,
  updatedAt: date,
}
async function staff(page: Page, keys: string[]) {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminEmployee) }),
  )
  await page.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminAuth(keys)) }),
  )
}

for (const access of [
  {
    keys: ['/print-devices_read'],
    tab: 'Danh sách Máy in',
    devices: true,
    jobs: false,
  },
  {
    keys: ['/print-jobs_read'],
    tab: 'Hàng đợi Lệnh in',
    devices: false,
    jobs: true,
  },
  {
    keys: ['/receipts_reprint'],
    tab: 'In lại Hóa đơn',
    devices: false,
    jobs: false,
  },
]) {
  test(
    'printing isolates API access: ' + access.tab,
    async ({ page }, info) => {
      await staff(page, access.keys)
      const reads: string[] = []
      await page.route('**/api/v1/printing/**', (route) => {
        const path = new URL(route.request().url()).pathname
        reads.push(path)
        return route.fulfill({
          json: envelope(
            paged(path.endsWith('/devices') ? [device] : [], 1, 0),
          ),
        })
      })
      await page.goto('/staff/printing')
      await expect(
        page.getByRole('heading', { name: /Quản trị Thiết bị In/ }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: access.tab, exact: true }),
      ).toBeVisible()
      await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
      expect(reads.some((path) => path.endsWith('/devices'))).toBe(
        access.devices,
      )
      expect(reads.some((path) => path.endsWith('/jobs'))).toBe(access.jobs)
      await expect(
        page.getByRole('button', { name: 'Thêm máy in', exact: true }),
      ).toHaveCount(0)
      await expect(page.getByText('Hàng đợi ổn định')).toHaveCount(0)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
      await page.screenshot({
        path: info.outputPath('printing-permission.png'),
      })
    },
  )
}

test('device pagination and search query the whole server collection', async ({
  page,
}) => {
  await staff(page, ['/print-devices_read'])
  const requests: URLSearchParams[] = []
  await page.route('**/api/v1/printing/devices?*', (route) => {
    const params = new URL(route.request().url()).searchParams
    requests.push(params)
    const current = Number(params.get('page') ?? 1)
    return route.fulfill({
      json: envelope(
        paged(
          [
            {
              ...device,
              name: params.get('keyword') || 'Printer page ' + current,
            },
          ],
          current,
        ),
      ),
    })
  })
  await page.goto('/staff/printing')
  await expect(
    page.getByRole('heading', { name: 'Printer page 1' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Printer page 2' }),
  ).toBeVisible()
  await page
    .getByPlaceholder('Tìm theo tên máy in...')
    .fill('Printer beyond first page')
  await expect(
    page.getByRole('heading', { name: 'Printer beyond first page' }),
  ).toBeVisible()
  expect(requests.at(-1)?.get('page')).toBe('1')
  expect(requests.at(-1)?.get('keyword')).toBe('Printer beyond first page')
})

test('employees paginate and combine exact server filters with global search', async ({
  page,
}) => {
  await staff(page, ['/employees_read', '/positions_read'])
  await page.route('**/api/v1/positions/dropdown', (route) =>
    route.fulfill({ json: envelope([{ id, name: 'Cashier' }]) }),
  )
  const requests: URLSearchParams[] = []
  await page.route('**/api/v1/employees?*', (route) => {
    const params = new URL(route.request().url()).searchParams
    if (params.get('itemPerPage') !== '1') requests.push(params)
    const current = Number(params.get('page') ?? 1)
    return route.fulfill({
      json: envelope(
        paged(
          [
            {
              ...defaultMockAdminEmployee,
              fullName: params.get('search') || 'Employee page ' + current,
              isActive: params.get('isActive') !== 'false',
              positionId: id,
            },
          ],
          current,
        ),
      ),
    })
  })
  await page.goto('/staff/employees')
  await expect(page.getByText('Employee page 1', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(page.getByText('Employee page 2', { exact: true })).toBeVisible()
  await page.getByLabel('Lọc theo trạng thái').selectOption('INACTIVE')
  await expect.poll(() => requests.at(-1)?.get('isActive')).toBe('false')
  expect(requests.at(-1)?.get('page')).toBe('1')
  await page.getByLabel('Lọc theo vị trí').selectOption(id)
  await page
    .getByPlaceholder('Tìm theo tên nhân viên, username hoặc email...')
    .fill('Another cashier')
  await expect(page.getByText('Another cashier', { exact: true })).toBeVisible()
  expect(requests.at(-1)?.get('positionId')).toBe(id)
  expect(requests.at(-1)?.get('isActive')).toBe('false')
  const readsBeforeRefresh = requests.length
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect.poll(() => requests.length).toBeGreaterThan(readsBeforeRefresh)
  expect(requests.at(-1)?.get('search')).toBe('Another cashier')
  expect(requests.at(-1)?.get('positionId')).toBe(id)
  expect(requests.at(-1)?.get('isActive')).toBe('false')
})

test('positions paginate rather than truncating the catalog', async ({
  page,
}) => {
  await staff(page, ['/positions_read'])
  const requests: string[] = []
  await page.route('**/api/v1/positions**', (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/dropdown'))
      return route.fulfill({ json: envelope([]) })
    const current = Number(url.searchParams.get('page') ?? 1)
    requests.push(url.searchParams.get('page') ?? '1')
    return route.fulfill({
      json: envelope(
        paged(
          [{ id, name: 'Position page ' + current, salary: '1000' }],
          current,
        ),
      ),
    })
  })
  await page.goto('/staff/employees')
  await expect(page.getByText('Position page 1', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(page.getByText('Position page 2', { exact: true })).toBeVisible()
  const readsBeforeRefresh = requests.length
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect.poll(() => requests.length).toBeGreaterThan(readsBeforeRefresh)
  expect(requests.at(-1)).toBe('2')
})

for (const domain of ['equipment', 'system-settings'] as const) {
  test(
    domain + ' paginates both list and history with independent page state',
    async ({ page }, info) => {
      await staff(page, [
        domain === 'equipment' ? '/equipment_read' : '/system-settings_read',
      ])
      await page.route('**/api/v1/' + domain + '**', (route) => {
        const url = new URL(route.request().url())
        const current = Number(url.searchParams.get('page') ?? 1)
        const history =
          url.pathname.endsWith('/events') ||
          url.pathname.endsWith('/revisions')
        const record =
          domain === 'equipment'
            ? history
              ? {
                  id,
                  equipmentId: id,
                  toStatus: 'IN_USE',
                  reason: 'History page ' + current,
                }
              : {
                  id,
                  assetCode: 'EQ-1',
                  name: 'Equipment page ' + current,
                  status: 'IN_USE',
                  quantity: 1,
                  unitPrice: '100',
                  totalAmount: '100',
                  purchaseDate: date,
                }
            : history
              ? {
                  id,
                  settingId: id,
                  version: current,
                  value: 'History page ' + current,
                  valueType: 'STRING',
                  isPublic: false,
                  createdAt: date,
                }
              : {
                  id,
                  key: 'setting.page.' + current,
                  value: 'value',
                  valueType: 'STRING',
                  version: 1,
                }
        return route.fulfill({ json: envelope(paged([record], current)) })
      })
      await page.goto('/staff/settings')
      const name = domain === 'equipment' ? 'Equipment page ' : 'setting.page.'
      await expect(page.getByText(name + 1, { exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
      await expect(page.getByText(name + 2, { exact: true })).toBeVisible()
      await page
        .getByTitle(/lịch sử/i)
        .first()
        .click()
      const dialog = page.getByRole('dialog')
      await expect(
        dialog.getByText('History page 1', { exact: true }),
      ).toBeVisible()
      await dialog
        .getByRole('button', { name: 'Trang sau', exact: true })
        .click()
      await expect(
        dialog.getByText('History page 2', { exact: true }),
      ).toBeVisible()
      await dialog
        .getByRole('button', { name: 'Đóng', exact: true })
        .last()
        .click()
      await expect(page.getByText(name + 2, { exact: true })).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
      await page.screenshot({ path: info.outputPath('staff-paging.png') })
    },
  )
}

for (const domain of [
  { path: 'equipment', permission: '/equipment_read', page: '/staff/settings' },
  {
    path: 'system-settings',
    permission: '/system-settings_read',
    page: '/staff/settings',
  },
  {
    path: 'employees',
    permission: '/employees_read',
    page: '/staff/employees',
  },
  {
    path: 'positions',
    permission: '/positions_read',
    page: '/staff/employees',
  },
  {
    path: 'printing/jobs',
    permission: '/print-jobs_read',
    page: '/staff/printing',
  },
  {
    path: 'printing/devices',
    permission: '/print-devices_read',
    page: '/staff/printing',
  },
]) {
  test(
    domain.path +
      ' read failure is explicit and retryable, not an empty healthy list',
    async ({ page }) => {
      await staff(page, [domain.permission])
      await page.route('**/api/v1/' + domain.path + '**', (route) =>
        route.fulfill({ status: 503, json: { message: 'Unavailable' } }),
      )
      await page.goto(domain.page)
      await expect(
        page
          .getByRole('alert')
          .filter({ hasText: 'Dịch vụ tạm thời không khả dụng' }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Thử lại', exact: true }),
      ).toBeVisible()
    },
  )
}

test('shift opening does not read funds without the required fund permission', async ({
  page,
}) => {
  await staff(page, [
    '/cashier-shifts_read',
    '/cashier-shifts_current',
    '/cashier-shifts_open',
  ])
  await page.route('**/api/v1/cashier-shifts/current', (route) =>
    route.fulfill({ status: 404, json: { message: 'No shift' } }),
  )
  let fundReads = 0
  await page.route('**/api/v1/funds?*', (route) => {
    fundReads++
    return route.fulfill({ status: 403, json: { message: 'Forbidden' } })
  })
  await page.goto('/staff/shifts')
  await expect(
    page.getByText(
      'Bạn không có đủ quyền mở ca thu ngân và xem quỹ. Vui lòng liên hệ quản lý.',
    ),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Xác nhận mở ca thu ngân' }),
  ).toHaveCount(0)
  expect(fundReads).toBe(0)
})

test('fund management without read permission does not fetch the fund catalog', async ({
  page,
}) => {
  await staff(page, ['/funds_manage'])
  let reads = 0
  await page.route(
    /\/api\/v1\/(funds|cashier-shifts\/current)(\?|$)/,
    (route) => {
      reads++
      return route.fulfill({ status: 403, json: { message: 'Forbidden' } })
    },
  )
  await page.goto('/staff/shifts')
  await expect(
    page.getByRole('heading', { name: 'Quản lý Ca & Quỹ tiền mặt' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Thêm quỹ mới' })).toHaveCount(
    0,
  )
  expect(reads).toBe(0)
})

test('fund read failure blocks shift opening and retries only the read', async ({
  page,
}) => {
  await staff(page, [
    '/cashier-shifts_current',
    '/cashier-shifts_open',
    '/funds_read',
  ])
  await page.route('**/api/v1/cashier-shifts/current', (route) =>
    route.fulfill({ status: 404, json: { message: 'No shift' } }),
  )
  let failed = true
  let writes = 0
  await page.route('**/api/v1/funds?*', (route) =>
    route.fulfill(
      failed
        ? { status: 503, json: { message: 'Unavailable' } }
        : {
            json: envelope(
              paged(
                [{ id, name: 'Cash drawer', type: 'CASH', balance: '0' }],
                1,
                1,
              ),
            ),
          },
    ),
  )
  await page.route('**/api/v1/cashier-shifts/open', (route) => {
    writes++
    return route.fulfill({ status: 409, json: { message: 'Unexpected write' } })
  })
  await page.goto('/staff/shifts')
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Xác nhận mở ca thu ngân' }),
  ).toBeDisabled()
  failed = false
  await page.getByRole('button', { name: 'Thử tải quỹ' }).click()
  await expect(page.getByRole('option', { name: /Cash drawer/ })).toHaveCount(1)
  expect(writes).toBe(0)
})

test('KDS reloads authoritative tickets after reconnect even without a refresh event', async ({
  page,
}) => {
  await page.addInitScript(() => {
    class FixtureSource extends EventTarget {
      onopen: (() => void) | null = null
      onerror: (() => void) | null = null
      constructor() {
        super()
        const w = window as unknown as { sources?: FixtureSource[] }
        ;(w.sources ??= []).push(this)
        setTimeout(() => this.onopen?.(), 0)
      }
      close() {}
    }
    Object.assign(window, { EventSource: FixtureSource })
  })
  await staff(page, ['/kitchen-tickets_read'])
  await page.route('**/api/v1/kitchen/workload', (route) =>
    route.fulfill({
      json: envelope({ asOf: date, dueSoonWindowSeconds: 60, stations: [] }),
    }),
  )
  let revision = 0
  await page.route('**/api/v1/kitchen/tickets?*', (route) =>
    route.fulfill({
      json: envelope(
        paged(
          [
            {
              id,
              sequence: 1,
              ticketNumber: 'KDS-1',
              state: 'PENDING',
              isOverdue: false,
              dueAt: date,
              createdAt: date,
              station: { id, code: 'BAR', name: 'Bar' },
              orderSessionId: id,
              table: null,
              items: [
                {
                  id,
                  orderItemId: id,
                  itemName: 'Snapshot ' + revision,
                  quantity: 1,
                  serveStatus: 'PENDING',
                  currentTable: null,
                },
              ],
            },
          ],
          1,
          1,
        ),
      ),
    }),
  )
  await page.goto('/staff/kitchen')
  await expect(page.getByText('1x Snapshot 0', { exact: true })).toBeVisible()
  const initialSources = await page.evaluate(
    () => (window as unknown as { sources: unknown[] }).sources.length,
  )
  await page.evaluate(() => {
    const w = window as unknown as { sources: { onerror?: () => void }[] }
    w.sources.at(-1)?.onerror?.()
  })
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as unknown as { sources: unknown[] }).sources.length,
        ),
      { timeout: 10_000 },
    )
    .toBe(initialSources + 1)
  revision = 1
  await page.evaluate(() => {
    const w = window as unknown as { sources: { onopen?: () => void }[] }
    w.sources.at(-1)?.onopen?.()
  })
  await expect(page.getByText('1x Snapshot 1', { exact: true })).toBeVisible()
})

test('reprint retries preserve the original key and body after an unknown result', async ({
  page,
}) => {
  await staff(page, ['/receipts_reprint'])
  const payloads: Record<string, unknown>[] = []
  await page.route('**/api/v1/printing/invoices/*/reprint', (route) => {
    payloads.push(route.request().postDataJSON())
    return payloads.length === 1
      ? route.abort()
      : route.fulfill({
          json: envelope({
            id,
            type: 'RECEIPT',
            status: 'PENDING',
            copies: 1,
            attempts: 0,
            maxAttempts: 3,
            createdAt: date,
            updatedAt: date,
          }),
        })
  })
  await page.goto('/staff/printing')
  await page.getByLabel(/Mã Hóa đơn/).fill(id)
  await page.getByLabel(/Lý do in lại/).fill('Khách cần thêm hóa đơn')
  await page
    .getByRole('button', { name: 'Gửi lệnh in lại hóa đơn', exact: true })
    .click()
  await expect(page.getByLabel(/Mã Hóa đơn/)).toBeDisabled()
  await expect(page.getByLabel(/Lý do in lại/)).toBeDisabled()
  await page
    .getByRole('button', { name: 'Gửi lại lệnh chưa xác nhận', exact: true })
    .click()
  await expect(
    page.getByText(/Đã tạo lệnh in lại trong hàng đợi/),
  ).toBeVisible()
  expect(payloads).toHaveLength(2)
  expect(payloads[1]).toEqual(payloads[0])
  expect(payloads[0]?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
})

test('printer options load every active page instead of truncating selection', async ({
  page,
}) => {
  const pages: number[] = []
  await page.route('**/api/v1/printing/devices?*', (route) => {
    const params = new URL(route.request().url()).searchParams
    expect(params.get('isActive')).toBe('true')
    expect(params.get('itemPerPage')).toBe('100')
    const current = Number(params.get('page'))
    pages.push(current)
    return route.fulfill({
      json: envelope({
        list: [
          { ...device, id: 'device-' + current, name: 'Printer ' + current },
        ],
        currentPage: current,
        totalPages: 2,
        totalItems: 101,
      }),
    })
  })
  await page.goto('/sign-in')
  const options = await page.evaluate(async () => {
    const path = '/src/features/printing/printing.api.ts'
    const { printingApi } = await import(path)
    return printingApi.getActiveDevices()
  })
  expect(pages).toEqual([1, 2])
  expect(options.map((option: { name: string }) => option.name)).toEqual([
    'Printer 1',
    'Printer 2',
  ])
})
