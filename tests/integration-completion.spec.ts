import { expect, test, type Page } from '@playwright/test'
import {
  defaultMockAdminAuth,
  defaultMockAdminEmployee,
  envelope,
} from './helpers.js'

const id = '70000000-0000-4000-8000-000000000001'
const itemId = '70000000-0000-4000-8000-000000000002'
const otherId = '70000000-0000-4000-8000-000000000003'
const date = '2026-10-04T08:00:00Z'
const paged = (list: unknown[], page = 1, totalPages = 1) => ({
  list,
  totalItems: list.length * totalPages,
  totalPages,
  currentPage: page,
})
const options = [
  { id: otherId, groupName: 'Size', name: 'Large', priceDelta: '5000' },
]
async function staff(page: Page, permissions: string[]) {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminEmployee) }),
  )
  await page.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminAuth(permissions)) }),
  )
}
async function pos(page: Page) {
  await page.route('**/api/v1/dining-tables', (route) =>
    route.fulfill({ json: envelope([]) }),
  )
  await page.route('**/api/v1/orders/sessions', (route) =>
    route.fulfill({ json: envelope([]) }),
  )
  await page.route('**/api/v1/orders/takeaway/handoff?*', (route) =>
    route.fulfill({ json: envelope(paged([])) }),
  )
  await page.route('**/api/v1/cashier-shifts/current', (route) =>
    route.fulfill({ status: 404, json: { message: 'No shift' } }),
  )
  await staff(page, [
    '/orders_sessions_read',
    '/orders_sessions_cancel',
    '/invoices_create',
    '/promotions_read',
  ])
  await page.route('**/api/v1/menu/public/categories', (route) =>
    route.fulfill({ json: envelope([]) }),
  )
  await page.route('**/api/v1/menu/public/items?*', (route) => {
    const p = Number(new URL(route.request().url()).searchParams.get('page'))
    return route.fulfill({
      json: envelope(
        paged(
          [
            {
              id,
              name: `Menu page ${p}`,
              price: '35000',
              category: { id, name: 'Coffee' },
              optionGroups: [],
            },
          ],
          p,
          2,
        ),
      ),
    })
  })
  await page.route('**/api/v1/recommendations/pos/*', (route) =>
    route.fulfill({ json: envelope({ recommendations: [] }) }),
  )
  await page.route('**/api/v1/orders/sessions/' + id, (route) =>
    route.fulfill({
      json: envelope({
        id,
        sessionStatus: 'ACTIVE',
        createdAt: date,
        table: null,
        employee: defaultMockAdminEmployee,
        orderItems: [
          {
            id: itemId,
            quantity: 1,
            priceAtTime: '35000',
            selectedOptions: options,
            serveStatus: 'PENDING',
            isPaid: false,
            menuItem: { id, name: 'Coffee large', price: '30000' },
          },
          {
            id: otherId,
            quantity: 1,
            priceAtTime: '20000',
            serveStatus: 'PENDING',
            isPaid: false,
            menuItem: { id, name: 'Cake', price: '20000' },
          },
        ],
      }),
    }),
  )
  await page.route('**/api/v1/promotions/active*', (route) =>
    route.fulfill({
      json: envelope({
        list: [
          {
            id,
            name: 'Giảm 10%',
            startDate: date,
            endDate: date,
            discountType: 'PERCENTAGE',
            discountValue: '10',
            status: 'ACTIVE',
            createdAt: date,
            updatedAt: date,
          },
        ],
      }),
    }),
  )
  await page.goto('/staff/pos/sessions/' + id)
}

test('KDS uses current table, saved options and paginated tickets; online-ready is not a serve command', async ({
  page,
}, info) => {
  await staff(page, ['/kitchen-tickets_read', '/orders_items_update-status'])
  await page.route('**/api/v1/kitchen/workload', (route) =>
    route.fulfill({
      json: envelope({ asOf: date, dueSoonWindowSeconds: 60, stations: [] }),
    }),
  )
  await page.route('**/api/v1/kitchen/tickets?*', (route) => {
    const p = Number(new URL(route.request().url()).searchParams.get('page'))
    return route.fulfill({
      json: envelope(
        paged(
          [
            {
              id,
              sequence: p,
              ticketNumber: `KDS-${p}`,
              state: 'IN_PROGRESS',
              isOverdue: false,
              dueAt: date,
              createdAt: date,
              station: { id, code: 'BAR', name: 'Pha chế' },
              orderSessionId: id,
              table: { id, name: 'Bàn cũ' },
              items: [
                {
                  id: itemId,
                  orderItemId: itemId,
                  itemName: 'Coffee',
                  quantity: 1,
                  serveStatus: 'COOKING',
                  selectedOptions: options,
                  currentTable: { id: otherId, name: 'Bàn mới' },
                },
                {
                  id: otherId,
                  orderItemId: otherId,
                  itemName: 'Online cake',
                  quantity: 1,
                  serveStatus: 'READY',
                  currentTable: null,
                },
              ],
            },
          ],
          p,
          2,
        ),
      ),
    })
  })
  let status = ''
  await page.route('**/api/v1/orders/items/' + itemId + '/status', (route) => {
    status = route.request().postDataJSON().serveStatus
    return route.fulfill({
      json: envelope({ id: itemId, serveStatus: status }),
    })
  })
  await page.goto('/staff/kitchen')
  await expect(page.getByText('Size: Large')).toBeVisible()
  await expect(page.getByText('Bàn: Bàn mới')).toBeVisible()
  await expect(page.getByText('Nhiều phiên')).toBeVisible()
  await expect(page.getByText('Bàn: Bàn cũ')).toHaveCount(0)
  await expect(page.getByText('Chờ quầy giao món')).toBeVisible()
  await page.getByRole('button', { name: 'Xong món' }).click()
  await expect.poll(() => status).toBe('SERVED')
  await page.getByRole('button', { name: 'Trang sau' }).click()
  await expect(page.getByText('KDS-2')).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({ path: info.outputPath('kds-options-pages.png') })
})

test('partial checkout and promotion use a server quote and selected line IDs', async ({
  page,
}, info) => {
  await pos(page)
  await expect(page.getByText('Menu page 1')).toBeVisible()
  await page.getByRole('button', { name: 'Trang sau' }).click()
  await expect(page.getByText('Menu page 2')).toBeVisible()
  await page.route('**/api/v1/invoices/quote', (route) => {
    const input = route.request().postDataJSON()
    return route.fulfill({
      json: envelope({
        orderItemIds: input.orderItemIds,
        subTotal: '35000',
        discountAmount: input.promotionId ? '3500' : '0',
        taxAmount: '0',
        totalAmount: input.promotionId ? '31500' : '35000',
      }),
    })
  })
  let checkout: Record<string, unknown> | null = null
  await page.route('**/api/v1/invoices/checkout', (route) => {
    checkout = route.request().postDataJSON()
    return route.fulfill({
      json: envelope({
        id,
        invoiceNumber: 'PARTIAL-001',
        subTotal: '35000',
        discountAmount: '3500',
        totalAmount: '31500',
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
      }),
    })
  })
  await page.getByRole('button', { name: /^Thanh toán \(/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('checkbox').nth(1).uncheck()
  await dialog.getByLabel('Khuyến mãi').selectOption(id)
  await expect(
    dialog.getByText('31.500', { exact: false }).first(),
  ).toBeVisible()
  await expect(
    dialog.getByRole('button', { name: 'Xác nhận thanh toán tiền mặt' }),
  ).toBeEnabled()
  await page.screenshot({
    path: info.outputPath('partial-promotion-quote.png'),
  })
  await dialog
    .getByRole('button', { name: 'Xác nhận thanh toán tiền mặt' })
    .click()
  await expect
    .poll(() => checkout)
    .toMatchObject({ orderItemIds: [itemId], promotionId: id })
  await expect(dialog.getByText('PARTIAL-001')).toBeVisible()
})

test('a failed quote cannot enable partial payment', async ({ page }) => {
  await pos(page)
  await page.route('**/api/v1/invoices/quote', (route) =>
    route.fulfill({ status: 409, json: { message: 'Line changed' } }),
  )
  await page.getByRole('button', { name: /^Thanh toán \(/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('checkbox').nth(1).uncheck()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(
    dialog.getByRole('button', { name: 'Xác nhận thanh toán tiền mặt' }),
  ).toBeDisabled()
})

test('session cancellation needs confirmation and does not write on opening the dialog', async ({
  page,
}) => {
  await pos(page)
  let deletes = 0
  await page.route('**/api/v1/orders/sessions/' + id, (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback()
    deletes++
    return route.fulfill({ json: envelope({ id, sessionStatus: 'CANCELLED' }) })
  })
  await page.getByRole('button', { name: 'Hủy phiên', exact: true }).click()
  expect(deletes).toBe(0)
  await page.getByRole('button', { name: 'Xác nhận hủy phiên' }).click()
  await expect(page).toHaveURL(/\/staff\/pos$/)
  expect(deletes).toBe(1)
})

test('walk-in handoff queue paginates and uses its dedicated confirmed command', async ({
  page,
}) => {
  await staff(page, ['/orders_sessions_read', '/orders_items_handoff'])
  await page.route('**/api/v1/cashier-shifts/current', (route) =>
    route.fulfill({ status: 404, json: { message: 'No shift' } }),
  )
  await page.route('**/api/v1/dining-tables', (route) =>
    route.fulfill({ json: envelope([]) }),
  )
  await page.route('**/api/v1/orders/sessions', (route) =>
    route.fulfill({ json: envelope([]) }),
  )
  let handed = false
  await page.route('**/api/v1/orders/takeaway/handoff?*', (route) => {
    const p = Number(new URL(route.request().url()).searchParams.get('page'))
    return route.fulfill({
      json: envelope(
        paged(
          handed
            ? []
            : [
                {
                  id: itemId,
                  quantity: 1,
                  readyAt: date,
                  orderSessionId: id,
                  menuItem: { name: 'Walk-in coffee' },
                  ticketNumber: `BAR-${p}`,
                },
              ],
          p,
          2,
        ),
      ),
    })
  })
  await page.route('**/api/v1/orders/items/' + itemId + '/handoff', (route) => {
    expect(route.request().method()).toBe('POST')
    handed = true
    return route.fulfill({
      json: envelope({ id: itemId, serveStatus: 'SERVED' }),
    })
  })
  await page.goto('/staff/pos')
  await page.getByRole('button', { name: 'Trang sau' }).click()
  await expect(page.getByText('BAR-2', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Giao món', exact: true }).click()
  expect(handed).toBe(false)
  await page.getByRole('button', { name: 'Đã giao cho khách' }).click()
  await expect(page.getByText('Không có món chờ giao tại quầy.')).toBeVisible()
  expect(handed).toBe(true)
})

test('shift history opens server reconciliation detail and paginates', async ({
  page,
}, info) => {
  await staff(page, ['/cashier-shifts_read'])
  let fundReads = 0
  await page.route('**/api/v1/funds?*', (route) => {
    fundReads++
    return route.fulfill({ status: 403, json: { message: 'Forbidden' } })
  })
  let currentReads = 0
  await page.route('**/api/v1/cashier-shifts/current', (route) => {
    currentReads++
    return route.fulfill({ status: 403, json: { message: 'Forbidden' } })
  })
  const shift = {
    id,
    openedAt: date,
    closedAt: date,
    status: 'CLOSED',
    startingCash: '10000',
    reportedEndingCash: '20000',
    actualEndingCash: '22000',
    difference: '-2000',
    employeeId: id,
    employee: { id, fullName: 'Thu ngân kiểm thử' },
  }
  await page.route('**/api/v1/cashier-shifts?*', (route) => {
    const p = Number(new URL(route.request().url()).searchParams.get('page'))
    return route.fulfill({ json: envelope(paged([shift], p, 2)) })
  })
  await page.route('**/api/v1/cashier-shifts/' + id, (route) =>
    route.fulfill({
      json: envelope({
        ...shift,
        closingNote: 'Đã kiểm đếm lại',
        reconciliation: {
          difference: '-2000',
          actualEndingCash: '22000',
          cashSales: '12000',
          nonCashSales: '0',
        },
      }),
    }),
  )
  await page.goto('/staff/shifts')
  await page.getByRole('button', { name: /Lịch sử/ }).click()
  await page.getByRole('button', { name: 'Trang sau' }).click()
  await page.getByRole('button', { name: /^Chi tiết ca/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Đã kiểm đếm lại')).toBeVisible()
  await expect(dialog.getByText('-2.000', { exact: false })).toBeVisible()
  expect(fundReads).toBe(0)
  expect(currentReads).toBe(0)
  await page.screenshot({ path: info.outputPath('shift-detail.png') })
})

test('custom roles are created while system roles remain immutable', async ({
  page,
}) => {
  await staff(page, [
    '/roles_read',
    '/roles_create',
    '/roles_update',
    '/roles_delete',
  ])
  let created: Record<string, unknown> | null = null
  await page.route('**/api/v1/roles?*', (route) =>
    route.fulfill({
      json: envelope(
        paged([
          { id, name: 'OWNER', isSystemRole: true },
          ...(created
            ? [{ id: otherId, ...created, isSystemRole: false }]
            : []),
        ]),
      ),
    }),
  )
  await page.route('**/api/v1/roles', (route) => {
    created = route.request().postDataJSON()
    return route.fulfill({
      json: envelope({ id: otherId, ...created, isSystemRole: false }),
    })
  })
  await page.goto('/staff/employees')
  await page.getByRole('button', { name: /Vai trò & Quyền hạn/ }).click()
  await expect(
    page.getByRole('button', { name: 'Sửa vai trò OWNER' }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Xóa vai trò OWNER' }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Thêm vai trò' }).click()
  await page.getByLabel('Tên vai trò').fill('Trưởng ca tối')
  await page.getByRole('button', { name: 'Lưu vai trò', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Sửa vai trò Trưởng ca tối' }),
  ).toBeVisible()
  expect(created).toMatchObject({ name: 'Trưởng ca tối', description: '' })
})

test('employee assignment and malformed role-permission reads fail closed', async ({
  page,
}) => {
  await staff(page, [
    '/employees_read',
    '/employees_roles_read',
    '/employees_roles_update',
    '/roles_read',
    '/roles_permissions_read',
    '/roles_permissions_update',
    '/permissions_read',
  ])
  await page.route('**/api/v1/employees?*', (route) =>
    route.fulfill({ json: envelope(paged([defaultMockAdminEmployee])) }),
  )
  await page.route('**/api/v1/employees/*/roles', (route) =>
    route.fulfill({ status: 503, json: { message: 'Unavailable' } }),
  )
  await page.route('**/api/v1/roles?*', (route) =>
    route.fulfill({
      json: envelope(
        paged([
          { id, name: 'CUSTOM', isSystemRole: false },
          { id: otherId, name: 'OWNER', isSystemRole: true },
        ]),
      ),
    }),
  )
  await page.route('**/api/v1/roles/' + id + '/permissions', (route) =>
    route.fulfill({ json: envelope({ id, name: 'CUSTOM' }) }),
  )
  await page.route('**/api/v1/permissions?*', (route) =>
    route.fulfill({
      json: envelope(
        paged([{ id, name: 'Read', key: '/orders_sessions_read' }]),
      ),
    }),
  )
  await page.goto('/staff/employees')
  await page.getByTitle('Phân quyền vai trò').click()
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Lưu vai trò', exact: true }),
  ).toBeDisabled()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /Vai trò & Quyền hạn/ }).click()
  await expect(
    page.getByRole('button', { name: 'Phân quyền', exact: true }),
  ).toHaveCount(1)
  await page.getByRole('button', { name: 'Phân quyền', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Lưu danh sách quyền' }),
  ).toBeDisabled()
})

test('station and inventory taxonomy forms post the actual backend fields', async ({
  page,
}) => {
  await staff(page, [
    '/kitchen-stations_read',
    '/kitchen-stations_manage',
    '/inventory_read',
    '/inventory_create',
  ])
  await page.route('**/api/v1/kitchen/stations?*', (route) =>
    route.fulfill({ json: envelope(paged([])) }),
  )
  let station: unknown
  await page.route('**/api/v1/kitchen/stations', (route) => {
    station = route.request().postDataJSON()
    return route.fulfill({
      json: envelope({ id, ...(station as object), isActive: true }),
    })
  })
  await page.goto('/staff/kitchen')
  await page.getByRole('button', { name: 'Trạm bếp & SLA' }).click()
  await page.getByRole('button', { name: 'Thêm trạm bếp' }).click()
  await page.getByLabel('Mã trạm').fill('BAR')
  await page.getByLabel('Tên trạm').fill('Pha chế')
  await page.getByLabel('SLA (giây)').fill('180')
  await page.getByRole('button', { name: 'Lưu trạm' }).click()
  await expect
    .poll(() => station)
    .toEqual({
      code: 'BAR',
      name: 'Pha chế',
      prepSlaSeconds: 180,
      printDeviceId: null,
    })
  await page.route('**/api/v1/inventory/**', (route) =>
    route.fulfill({ json: envelope(paged([])) }),
  )
  let unit: unknown
  await page.route('**/api/v1/inventory/units', (route) => {
    unit = route.request().postDataJSON()
    return route.fulfill({ json: envelope({ id, ...(unit as object) }) })
  })
  await page.goto('/staff/inventory')
  await page.getByRole('button', { name: 'Nhóm nguyên liệu & đơn vị' }).click()
  await page.getByLabel('Danh mục kho').selectOption('units')
  await page.getByRole('button', { name: 'Thêm đơn vị' }).click()
  await page.getByRole('dialog').getByLabel('Tên', { exact: true }).fill('ml')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Lưu', exact: true })
    .click()
  await expect.poll(() => unit).toEqual({ name: 'ml' })
})

test('feedback history paginates independently and shows the summary', async ({
  page,
}, info) => {
  await staff(page, ['/reports_read'])
  await page.route('**/api/v1/reports/**', (route) =>
    route.fulfill({ status: 503, json: { message: 'Unavailable' } }),
  )
  await page.route('**/api/v1/orders/takeaway/feedback/summary?*', (route) =>
    route.fulfill({
      json: envelope({
        total: 20,
        averageRating: 4.5,
        ratings: [{ rating: 5, count: 15 }],
      }),
    }),
  )
  await page.route('**/api/v1/orders/takeaway/feedback?*', (route) => {
    const p = Number(new URL(route.request().url()).searchParams.get('page'))
    return route.fulfill({
      json: envelope(
        paged(
          [
            {
              id,
              rating: 5,
              comment: 'Món ngon',
              createdAt: date,
              invoice: { invoiceNumber: `FB-${p}` },
            },
          ],
          p,
          2,
        ),
      ),
    })
  })
  await page.goto('/staff/reports')
  await page.getByRole('tab', { name: 'Phản hồi khách' }).click()
  await expect(page.getByText('20 đánh giá')).toBeVisible()
  await page.getByRole('button', { name: 'Trang sau' }).click()
  await expect(page.getByText('FB-2', { exact: false })).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({ path: info.outputPath('feedback-report.png') })
})

test('shift parser accepts shortage amounts without accepting unsafe numeric money', async ({
  page,
}) => {
  await page.goto('/sign-in')
  const result = await page.evaluate(async () => {
    const shiftPath = '/src/features/cashier-shifts/cashier-shifts.api.ts'
    const moneyPath = '/src/shared/api/money.ts'
    const { cashierShiftSchema } = await import(shiftPath)
    const { signedMoneySchema } = await import(moneyPath)
    return {
      shift: cashierShiftSchema.safeParse({
        id: 'shift',
        openedAt: '2026-10-04T00:00:00Z',
        startingCash: '0',
        openingDifference: '-1000',
        difference: '-2500',
        status: 'CLOSED',
        employeeId: 'employee',
        employee: { id: 'employee', fullName: 'Cashier' },
        reconciliation: { difference: '-2500' },
      }).success,
      unsafe: signedMoneySchema.safeParse(-Number.MAX_SAFE_INTEGER).success,
    }
  })
  expect(result).toEqual({ shift: true, unsafe: false })
})
