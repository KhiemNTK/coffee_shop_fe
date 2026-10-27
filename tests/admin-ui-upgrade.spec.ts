import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const id = '92000000-0000-4000-8000-000000000001'
const date = '2026-10-17T04:00:00.000Z'
const paged = (list: unknown[]) => ({
  list,
  totalItems: list.length,
  totalPages: list.length ? 1 : 0,
  currentPage: 1,
})
const screens = [
  ['reports', 'Báo cáo Doanh thu & Vận hành'],
  ['employees', 'Quản lý Nhân sự & Phân quyền'],
  ['operations', 'Trung tâm vận hành'],
  ['menu', 'Thực đơn & công thức'],
  ['inventory', 'Quản lý Kho & Nguyên vật liệu'],
] as const

test('financial overview localizes labels without changing figures or business data', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem('coffee_shop_language', 'en'))
  await fixture(page)
  await page.goto('/staff/reports')
  await expect(page.getByRole('heading', { name: 'Sales & Operations Reports' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Financial overview', exact: true })).toBeVisible()
  await expect(page.getByText('Estimated gross profit', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Payment methods' })).toBeVisible()
  await expect(page.getByText('105,000.75 ₫', { exact: true }).first()).toBeVisible()
  await expect(page.locator('header').first()).not.toContainText('Chi nhánh trung tâm')
  await expect(page.locator('[title="Thông báo"]')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('financial-overview-english.png'), fullPage: true })
})

async function fixture(page: Page, state: 'data' | 'empty' | 'error' = 'data') {
  await page.clock.setFixedTime(new Date(date))
  const permissions = [
    '/reports_read',
    '/reports_export',
    '/employees_read',
    '/employees_update',
    '/employees_delete',
    '/positions_read',
    '/roles_read',
    '/management-exceptions_read',
    '/menu_read',
    '/menu_update',
    '/menu_delete',
    '/inventory_read',
    '/inventory_create',
    '/inventory_update',
    '/inventory_delete',
    '/inventory_stock_adjust',
  ]
  await page.route('**/api/v1/auth/me', (r) =>
    r.fulfill({ json: envelope(defaultMockAdminEmployee) }),
  )
  await page.route('**/api/v1/auth/me/permissions', (r) =>
    r.fulfill({ json: envelope(defaultMockAdminAuth(permissions)) }),
  )
  const rows = <T>(list: T[]) => (state === 'empty' ? [] : list)
  const reply = (value: unknown) =>
    state === 'error'
      ? { status: 503, json: { message: 'Unavailable' } }
      : { json: envelope(value) }
  const position = { id, name: 'Thu ngân' }
  await page.route('**/api/v1/positions/dropdown', (r) => r.fulfill({ json: envelope([position]) }))
  await page.route('**/api/v1/roles?*', (r) => r.fulfill({ json: envelope(paged([])) }))
  await page.route('**/api/v1/employees?*', (r) =>
    r.fulfill(
      reply(
        paged(
          rows([
            {
              id,
              fullName: 'Nhân viên kiểm thử',
              username: 'fixture.cashier',
              email: 'cashier@example.test',
              phoneNumber: '0900000000',
              positionId: id,
              isActive: true,
            },
          ]),
        ),
      ),
    ),
  )
  const unit = { id, name: 'kg' }
  const category = { id, name: 'Nguyên liệu kiểm thử' }
  await page.route('**/api/v1/menu/categories?*', (r) =>
    r.fulfill({ json: envelope(paged([category])) }),
  )
  const item = {
    id,
    name: 'Hạt cà phê kiểm thử',
    stock: '1.2345',
    reservedStock: '0',
    reorderPoint: '2.0000',
    averageUnitCost: '320000.25',
    categoryId: id,
    unitId: id,
    category,
    unit,
  }
  await page.route('**/api/v1/inventory/categories?*', (r) => r.fulfill(reply(paged([category]))))
  await page.route('**/api/v1/inventory/units?*', (r) => r.fulfill(reply(paged([unit]))))
  await page.route('**/api/v1/inventory/items?*', (r) => r.fulfill(reply(paged(rows([item])))))
  await page.route('**/api/v1/inventory/reorder-alerts**', (r) =>
    r.fulfill(
      reply(
        paged(
          rows([
            {
              ...item,
              unitName: unit.name,
              categoryName: category.name,
              shortageQuantity: '0.7655',
            },
          ]),
        ),
      ),
    ),
  )
  await page.route('**/api/v1/menu/items?*', (r) =>
    r.fulfill(
      reply(
        paged(
          rows([
            {
              id,
              name: 'Cà phê kiểm thử',
              description: 'Món dùng để kiểm tra UI',
              price: '35000.25',
              isAvailable: true,
              categoryId: id,
              category: { id, name: 'Cà phê' },
              kitchenStation: { id, code: 'BAR', name: 'Quầy pha chế' },
            },
          ]),
        ),
      ),
    ),
  )
  const counts = {
    PAYMENT: state === 'empty' ? 0 : 1,
    CASH_EXPENSE: 0,
    CASH_HANDOVER: 0,
    FEEDBACK: 0,
    KITCHEN_OVERDUE: 0,
    ONLINE_PICKUP_LATE: 0,
    OUTBOX_DEAD_LETTER: 0,
    PRINT_REVIEW: 0,
  }
  await page.route('**/api/v1/management/exceptions/summary', (r) =>
    r.fulfill(reply({ asOf: date, counts, total: counts.PAYMENT })),
  )
  await page.route('**/api/v1/management/exceptions?*', (r) =>
    r.fulfill(
      reply({
        ...paged(
          rows([
            {
              id,
              title: 'Giao dịch cần đối soát',
              status: 'PENDING',
              description: 'PROVIDER_AMOUNT_MISMATCH',
              paymentAttemptId: id,
              detectedAt: date,
            },
          ]),
        ),
        kind: 'PAYMENT',
      }),
    ),
  )
  const amount = state === 'empty' ? '0.00' : '105000.75'
  await page.route('**/api/v1/reports/dashboard?*', (r) =>
    r.fulfill(
      reply({
        period: { from: date, to: date, timeZone: 'Asia/Ho_Chi_Minh' },
        summary: {
          paidInvoiceCount: state === 'empty' ? 0 : 3,
          grossSales: amount,
          discountAmount: '0',
          taxAmount: '0',
          netRevenue: amount,
          averageTicket: state === 'empty' ? '0' : '35000.25',
          cancelledItemCount: 0,
          wasteEntryCount: 0,
          closedShiftCount: 0,
          discrepantShiftCount: 0,
          cashShortageAmount: '0',
          cashOverageAmount: '0',
        },
        profitability: {
          asOf: date,
          paidInvoiceCount: state === 'empty' ? 0 : 3,
          grossSales: amount,
          discountAmount: '0',
          taxAmount: '0',
          refundCount: 0,
          refundAmount: '0',
          netReceipts: amount,
          estimatedNetSalesExTax: amount,
          ingredientCost: state === 'empty' ? '0' : '25000.25',
          wasteCost: '0',
          estimatedGrossProfit: state === 'empty' ? '0' : '80000.50',
          soldItemCount: state === 'empty' ? 0 : 3,
          itemsWithCostSnapshot: state === 'empty' ? 0 : 3,
          zeroCostSnapshotCount: 0,
        },
        trend: rows([{ bucket: '2026-10-17', paidInvoiceCount: 3, netRevenue: amount }]),
        paymentMethods: rows([{ paymentMethod: 'CASH', paidInvoiceCount: 3, netRevenue: amount }]),
        topItems: rows([
          {
            menuItemId: id,
            name: 'Cà phê kiểm thử',
            categoryName: 'Cà phê',
            quantitySold: 3,
            grossSales: amount,
          },
        ]),
        promotions: [],
        lowStockItems: rows([{ id, name: item.name, stock: item.stock, reservedStock: '0', availableStock: item.stock, unitName: 'kg' }]),
        cashRisk: {
          overview: {
            openingShortageAmount: '0',
            currentPendingExpenseRequestAmount: '0',
            currentPendingHandoverAmount: '0',
            overdueBankSettlementAmount: '0',
            currentMismatchedBankStatementEntryAmount: '0',
            repeatShortageEmployeeCount: 0,
          },
        },
      }),
    ),
  )
  return { item }
}

for (const width of [1440, 1280, 1024, 768, 390]) {
  test(`five admin screens at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 })
    await fixture(page)
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    for (const [path, title] of screens) {
      await page.goto('/staff/' + path)
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
      await expect(page.getByRole('alert')).toHaveCount(0)
      if (path === 'operations')
        await expect(page.getByText('Giao dịch cần đối soát', { exact: true })).toBeVisible()
      else await expect(page.getByRole('table').first()).toBeVisible()
      if (path === 'reports')
        expect(
          await page
            .getByRole('region', { name: 'Món bán chạy', exact: true })
            .getByRole('cell')
            .nth(2)
            .evaluate((el) => el.getBoundingClientRect().width),
        ).toBeGreaterThanOrEqual(112)
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true)
      await page.screenshot({ path: info.outputPath(`${path}-${width}.png`), fullPage: true })
    }
    expect(errors).toEqual([])
  })
}

test('reports preserve real values, export filters and empty/error states', async ({
  page,
}, info) => {
  await fixture(page)
  let exported = false
  await page.route('**/api/v1/reports/dashboard/export?*', (r) => {
    exported = new URL(r.request().url()).searchParams.has('from')
    return r.fulfill({
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: 'fixture workbook',
    })
  })
  await page.goto('/staff/reports')
  await expect(page.getByText('105.000,75 ₫', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Xuất Excel' }).click()
  await expect.poll(() => exported).toBe(true)
  await page.screenshot({ path: info.outputPath('reports-data.png'), fullPage: true })
  await fixture(page, 'empty')
  await page.reload()
  await expect(page.getByText('Không có giao dịch trong khoảng thời gian này.')).toBeVisible()
  await page.screenshot({ path: info.outputPath('reports-empty.png'), fullPage: true })
  await fixture(page, 'error')
  await page.reload()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Thử lại', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('reports-error.png'), fullPage: true })
})

for (const state of ['empty', 'error'] as const) {
  test(`all five screens show ${state} without fabricated data`, async ({ page }, info) => {
    await fixture(page, state)
    const emptyText = [
      'Không có giao dịch trong khoảng thời gian này.',
      'Không tìm thấy nhân viên',
      'Không có ngoại lệ tồn đọng',
      'Không tìm thấy món nào phù hợp với bộ lọc hiện tại.',
      'Không tìm thấy nguyên vật liệu nào.',
    ]
    for (const [index, [path, title]] of screens.entries()) {
      await page.goto('/staff/' + path)
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
      if (state === 'error') await expect(page.getByRole('alert').first()).toBeVisible()
      else await expect(page.getByText(emptyText[index]!, { exact: true })).toBeVisible()
      if (path === 'inventory' && state === 'error')
        await expect(page.getByRole('definition').filter({ hasText: '—' })).toHaveCount(3)
      await page.screenshot({ path: info.outputPath(`${path}-${state}.png`), fullPage: true })
      if (path === 'inventory' && state === 'empty') {
        await page.getByRole('button', { name: 'Cảnh báo cần nhập hàng', exact: true }).click()
        await expect(
          page.getByText('Không có nguyên liệu trong danh sách cảnh báo.', { exact: true }),
        ).toBeVisible()
        await expect(page.getByText('Kho hàng an toàn!')).toHaveCount(0)
      }
    }
  })
}

test('inventory keeps exact thresholds, read-only controls and unknown metrics', async ({
  page,
}) => {
  const { item } = await fixture(page)
  await page.route('**/api/v1/auth/me/permissions', (r) =>
    r.fulfill({ json: envelope(defaultMockAdminAuth(['/inventory_read'])) }),
  )
  await page.route('**/api/v1/inventory/items?*', (r) =>
    r.fulfill({
      json: envelope(
        paged([
          { ...item, stock: '99999999999999.9998', reorderPoint: '99999999999999.9999' },
          {
            ...item,
            id: 'no-threshold',
            name: 'Chưa cấu hình ngưỡng',
            stock: '0',
            reorderPoint: '0',
          },
        ]),
      ),
    }),
  )
  await page.goto('/staff/inventory')
  const low = page.getByRole('row').filter({ hasText: item.name })
  await expect(low.getByText('Sắp hết', { exact: true })).toBeVisible()
  expect(
    await low
      .getByRole('cell')
      .nth(1)
      .evaluate((el) => el.getBoundingClientRect().width),
  ).toBeGreaterThanOrEqual(144)
  await expect(low).toContainText('99.999.999.999.999,9998')
  await expect(page.getByText('Chưa đặt ngưỡng', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nhập', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Xuất', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Thêm nguyên liệu', exact: true })).toHaveCount(0)
})

test('operations keeps pending semantics and raw payment detail', async ({ page }) => {
  await fixture(page)
  await page.goto('/staff/operations')
  await expect(page.getByText('Chờ xử lý', { exact: true })).toBeVisible()
  await expect(page.getByText('Đang xử lý', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('PROVIDER_AMOUNT_MISMATCH', { exact: true })).toBeVisible()
  await expect(dialog.getByText(id, { exact: true })).toHaveCount(2)
  await expect(dialog.getByRole('button', { name: 'Đánh dấu đã xử lý' })).toHaveCount(0)
})

test('sidebar stays full height while its menu scrolls independently', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Desktop sidebar only')
  await fixture(page)
  await page.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill({
      json: envelope(defaultMockAdminAuth([
        '/dining-tables_read', '/kitchen-tickets_read', '/online-orders_read',
        '/cashier-shifts_read', '/invoices_read', '/payment-reconciliation_read',
        '/reservations_read', '/inventory_read', '/menu_read', '/promotions_read',
        '/reports_read', '/employees_read', '/management-exceptions_read',
        '/audit-logs_read', '/print-devices_read',
      ])),
    }),
  )
  await page.goto('/staff/reports')
  await expect(page.getByRole('heading', { name: screens[0][1], exact: true })).toBeVisible()
  const sidebar = page.locator('.staff-sidebar')
  const account = sidebar.getByRole('link', { name: 'Tài khoản', exact: true })

  for (const [width, height] of [[1440, 1000], [1440, 640], [2560, 1000]] as const) {
    await page.setViewportSize({ width, height })
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect.poll(() => sidebar.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      const content = document.querySelector('main')!.getBoundingClientRect()
      return Math.abs(bounds.bottom - content.bottom) < 1 && bounds.left === 0
    })).toBe(true)
    await expect(sidebar).toHaveCSS('background-color', 'rgb(6, 47, 41)')
    await page.screenshot({ path: info.outputPath(`sidebar-${width}-${height}.png`), fullPage: true })

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expect.poll(() => account.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      return bounds.top >= 56 && bounds.bottom <= innerHeight
    })).toBe(true)
    const lastMenuItem = sidebar.getByRole('link', { name: 'Máy in & Lệnh in', exact: true })
    await account.focus()
    await page.keyboard.press('Shift+Tab')
    await expect(lastMenuItem).toBeFocused()
    await expect(lastMenuItem).toBeInViewport()
    await expect(account).toBeInViewport()
    await expect(sidebar.getByRole('button', { name: 'Thu gọn thanh điều hướng' })).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`sidebar-scrolled-${width}-${height}.png`) })
  }
  await page.setViewportSize({ width: 1440, height: 640 })
  await sidebar.getByRole('button', { name: 'Thu gọn thanh điều hướng' }).click()
  const menu = sidebar.locator('nav > div').first()
  expect(await menu.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  await account.focus()
  await page.keyboard.press('Shift+Tab')
  await expect(sidebar.getByRole('link', { name: 'Máy in & Lệnh in', exact: true })).toBeInViewport()
  await expect.poll(() => page.locator('.staff-workspace > header').evaluate((element) =>
    Math.round(element.getBoundingClientRect().top),
  )).toBe(0)
  await page.screenshot({ path: info.outputPath('sidebar-short-collapsed.png') })
})

test('sidebar collapse preserves accessible navigation', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Desktop sidebar only')
  await fixture(page)
  await page.goto('/staff/employees')
  const sidebar = page.locator('.staff-sidebar')
  await expect(sidebar).toHaveCSS('width', '240px')
  await expect.poll(() => sidebar.evaluate((element) =>
    element.getBoundingClientRect().height >= innerHeight - 56,
  )).toBe(true)
  const toggle = page.getByRole('button', { name: 'Thu gọn thanh điều hướng', exact: true })
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Mở rộng thanh điều hướng' })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  await expect(sidebar).toHaveCSS('width', '68px')
  await page.screenshot({ path: info.outputPath('sidebar-collapsed.png'), fullPage: true })
  await page
    .getByRole('navigation', { name: 'Nhân viên', exact: true })
    .getByRole('link', { name: 'Thực đơn', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: 'Thực đơn & công thức' })).toBeVisible()
})

test('all five screens show loading until the actual read completes', async ({ page }, info) => {
  await fixture(page)
  const endpoints = [
    'reports/dashboard?*',
    'employees?*',
    'management/exceptions?*',
    'menu/items?*',
    'inventory/items?*',
  ]
  for (const [index, [path]] of screens.entries()) {
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    const endpoint = '**/api/v1/' + endpoints[index]
    await page.route(endpoint, async (route) => {
      await pending
      await route.fallback()
    })
    try {
      await page.goto('/staff/' + path)
      await expect(page.getByRole('status').filter({ hasText: /Đang/ }).first()).toBeVisible()
      await expect(page.getByRole('table')).toHaveCount(0)
      await page.screenshot({ path: info.outputPath(`${path}-loading.png`), fullPage: true })
    } finally {
      release()
    }
    await expect(page.getByRole('table').first()).toBeVisible()
    await page.unroute(endpoint)
  }
})

test('long menu labels stay readable and row commands remain keyboard reachable', async ({
  page,
}, info) => {
  await fixture(page)
  const name = 'Cà phê đặc biệt với tên món rất dài ' + 'x'.repeat(120)
  await page.route('**/api/v1/menu/items?*', (route) =>
    route.fulfill({
      json: envelope(
        paged([
          {
            id,
            name,
            price: '35000.25',
            isAvailable: true,
            category: { id, name: 'Danh mục có tên dài ' + 'y'.repeat(80) },
            kitchenStation: { id, code: 'BAR', name: 'Quầy pha chế có tên dài ' + 'z'.repeat(80) },
          },
        ]),
      ),
    }),
  )
  await page.goto('/staff/menu')
  const region = page.getByRole('region', { name: 'Danh sách món', exact: true })
  await expect(region.getByText(name, { exact: true })).toBeVisible()
  expect(
    await region
      .getByRole('cell')
      .nth(2)
      .evaluate((el) => el.getBoundingClientRect().width),
  ).toBeGreaterThanOrEqual(144)
  await region.focus()
  await page.keyboard.press('Tab')
  await expect(region.getByRole('button', { name: 'Đang bán', exact: true })).toBeFocused()
  await expect(region.getByRole('button', { name: 'Đang bán', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.keyboard.press('Tab')
  await expect(region.getByRole('button', { name: 'Công thức', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(region.getByRole('button', { name: 'Tùy chọn', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  const edit = region.getByRole('button', { name: `Sửa thông tin món ${name}`, exact: true })
  await expect(edit).toBeFocused()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true)
  await page.screenshot({ path: info.outputPath('menu-long-labels.png'), fullPage: true })
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(edit).toBeFocused()
})

test('unavailable position totals are not rendered as zero', async ({ page }) => {
  await fixture(page)
  await page.route('**/api/v1/positions/dropdown', (route) =>
    route.fulfill({ status: 503, json: { message: 'Unavailable' } }),
  )
  await page.goto('/staff/employees')
  await expect(page.getByRole('button', { name: 'Vị trí Công việc —', exact: true })).toBeVisible()
})

test('a broken menu image recovers when its API URL changes', async ({ page }) => {
  await fixture(page)
  let imageUrl = 'https://assets.example.test/missing.png'
  await page.route('https://assets.example.test/missing.png', (route) =>
    route.fulfill({ status: 404, body: '' }),
  )
  await page.route('https://assets.example.test/menu.png', (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6Oe8AAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  )
  await page.route('**/api/v1/menu/items?*', (route) =>
    route.fulfill({
      json: envelope(
        paged([{ id, name: 'Ảnh kiểm thử', price: '35000', isAvailable: true, imageUrl }]),
      ),
    }),
  )
  await page.goto('/staff/menu')
  const image = page.getByRole('region', { name: 'Danh sách món', exact: true }).locator('img')
  await expect(image).toHaveCount(1)
  await expect(image).toBeHidden()
  imageUrl = 'https://assets.example.test/menu.png'
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(image).toBeVisible()
  await expect
    .poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
    .toBe(true)
})
