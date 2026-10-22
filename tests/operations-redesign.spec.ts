import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const id = '91000000-0000-4000-8000-000000000001'
const otherId = '91000000-0000-4000-8000-000000000002'
const now = '2026-10-14T10:00:00.000Z'
const options = [{ id, groupName: 'Size', name: 'Large', priceDelta: '5000' }]
const paged = (list: unknown[]) => ({
  list,
  totalItems: list.length,
  totalPages: 1,
  currentPage: 1,
})

async function operationsFixture(page: Page) {
  await page.clock.setFixedTime(new Date(now))
  await page.addInitScript(() => {
    class Source extends EventTarget {
      onopen: (() => void) | null = null
      onerror: (() => void) | null = null
      constructor() {
        super()
        setTimeout(() => this.onopen?.(), 0)
      }
      close() {}
    }
    Object.assign(window, { EventSource: Source })
  })
  const permissions = [
    '/kitchen-tickets_read',
    '/kitchen-stations_read',
    '/orders_items_update-status',
    '/online-orders_read',
    '/online-orders_review',
    '/invoices_create', '/invoices_pay',
    '/orders_items_handoff',
    '/reservations_read',
    '/reservations_create',
    '/reservations_update',
    '/reservations_cancel',
    '/reservations_check-in',
    '/dining-tables_read',
    '/orders_sessions_read',
  ]
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminEmployee) }),
  )
  await page.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminAuth(permissions)) }),
  )
  const tables = [
    { id, name: 'Bàn 01', status: 'EMPTY', orderSessions: [] },
    { id: otherId, name: 'Bàn sân vườn', status: 'EMPTY', orderSessions: [] },
  ]
  await page.route('**/api/v1/dining-tables', (route) => route.fulfill({ json: envelope(tables) }))
  const station = { id, code: 'BAR', name: 'Quầy pha chế', prepSlaSeconds: 600, isActive: true }
  await page.route('**/api/v1/kitchen/stations?*', (route) =>
    route.fulfill({ json: envelope(paged([station])) }),
  )
  await page.route('**/api/v1/kitchen/workload', (route) =>
    route.fulfill({
      json: envelope({
        asOf: now,
        dueSoonWindowSeconds: 60,
        stations: [
          {
            stationId: id,
            stationCode: 'BAR',
            stationName: 'Quầy pha chế',
            isActive: true,
            openTicketCount: 2,
            openUnitCount: 3,
            overdueTicketCount: 1,
            dueSoonTicketCount: 1,
            oldestOpenAt: now,
            nextDueAt: now,
          },
        ],
      }),
    }),
  )
  const tickets = ['PENDING', 'COOKING', 'READY'].map((serveStatus, index) => {
    const ticketId = `91000000-0000-4000-8000-00000000000${index + 3}`
    return {
      id: ticketId,
      sequence: index + 1,
      ticketNumber: `BAR-${index + 1}`,
      state: index === 0 ? 'PENDING' : index === 1 ? 'IN_PROGRESS' : 'COMPLETED',
      isOverdue: index === 0,
      createdAt: '2026-10-14T09:50:00.000Z',
      dueAt: index === 0 ? '2026-10-14T09:55:00.000Z' : '2026-10-14T10:05:00.000Z',
      station,
      orderSessionId: ticketId,
      table: index === 2 ? null : tables[0],
      items: [
        {
          id: ticketId,
          orderItemId: ticketId,
          itemName: ['Cà phê muối', 'Matcha latte', 'Trà đào cam sả'][index],
          quantity: index === 0 ? 2 : 1,
          serveStatus,
          selectedOptions: options,
          note: index === 0 ? 'Ít đá, không thêm đường' : null,
          currentTable: index === 2 ? null : tables[0],
        },
      ],
    }
  })
  await page.route('**/api/v1/kitchen/tickets?*', (route) =>
    route.fulfill({ json: envelope(paged(tickets)) }),
  )
  const fulfillment = ['READY', 'PREPARING', 'PARTIALLY_READY'].map((fulfillmentStatus, index) => ({
    id: `91000000-0000-4000-8000-00000000000${index + 6}`,
    pickupName: ['Nguyễn Minh Anh', 'Trần Hoàng Nam', 'Lê Thu Hà'][index],
    phoneNumber: '0901234567',
    quotedSubtotal: '65000',
    createdAt: now,
    pickupAt: '2026-10-14T10:15:00.000Z',
    isOverdue: false,
    isNoShowEligible: false,
    fulfillmentStatus,
    orderSessionId: id,
    orderItems: [
      {
        id: otherId,
        quantity: 1,
        priceAtTime: '65000',
        serveStatus: index === 0 ? 'READY' : 'COOKING',
        isPaid: false,
        selectedOptions: options,
        menuItem: { name: ['Cà phê muối', 'Matcha latte', 'Trà đào cam sả'][index] },
      },
    ],
  }))
  await page.route('**/api/v1/online-orders/requests/fulfillment?*', (route) =>
    route.fulfill({ json: envelope(paged(fulfillment)) }),
  )
  await page.route('**/api/v1/online-orders/requests?*', (route) =>
    route.fulfill({
      json: envelope(
        paged([
          {
            id,
            pickupName: 'Phạm Đức Huy',
            phoneNumber: '0901234567',
            quotedSubtotal: '65000',
            pickupAt: null,
            createdAt: now,
            expiresAt: '2026-10-14T10:20:00.000Z',
            items: [
              {
                lineNumber: 1,
                menuItemId: id,
                quotedName: 'Cà phê muối',
                quotedUnitPrice: '32500',
                quotedOptions: [],
                quantity: 2,
              },
            ],
          },
        ]),
      ),
    }),
  )
  const reservations = [0, 1].map((index) => ({
    id: index + 101,
    customerName: ['Vũ Thanh Hương', 'Đặng Quốc Bảo'][index],
    phoneNumber: '0901234567',
    startsAt: `2026-10-14T${index + 10}:30:00.000Z`,
    endsAt: `2026-10-14T${index + 12}:00:00.000Z`,
    guestCount: index + 2,
    status: 'PENDING',
    tableId: tables[index]!.id,
    table: tables[index]!,
    notes: index === 0 ? 'Gần cửa sổ' : null,
    updatedAt: now,
  }))
  await page.route('**/api/v1/reservations?*', (route) =>
    route.fulfill({ json: envelope(paged(reservations)) }),
  )
  await page.route('**/api/v1/reservations/requests?*', (route) =>
    route.fulfill({
      json: envelope(
        paged([
          {
            id,
            customerName: 'Ngô Hải Yến',
            phoneNumber: '0901234567',
            guestCount: 4,
            status: 'PENDING',
            startsAt: '2026-10-14T11:00:00.000Z',
            endsAt: '2026-10-14T12:30:00.000Z',
            notes: 'Bàn yên tĩnh, có trẻ nhỏ',
            createdAt: now,
          },
        ]),
      ),
    }),
  )
  return { tickets, fulfillment, reservations }
}

for (const width of [1600, 1440, 1024, 768, 390]) {
  test(`operations surfaces remain readable at ${width}px`, async ({ page }, info) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 })
    await operationsFixture(page)
    for (const [path, text] of [
      ['kitchen', 'Cà phê muối'],
      ['online-orders?tab=fulfillment', 'Nguyễn Minh Anh'],
      ['reservations', 'Vũ Thanh Hương'],
    ]) {
      await page.goto('/staff/' + path)
      await expect(page.getByText(text!, { exact: false }).first()).toBeVisible()
      await expect(page.getByRole('alert')).toHaveCount(0)
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true)
      await page.screenshot({
        path: info.outputPath(`${path!.split('?')[0]}-${width}.png`),
        fullPage: true,
      })
    }
    expect(errors).toEqual([])
  })
}

test('KDS uses the actual deadline and keeps mixed tickets as one item-level card', async ({
  page,
}) => {
  const { tickets } = await operationsFixture(page)
  const mixed = tickets[1]!
  mixed.items.push({
    ...mixed.items[0]!,
    id: otherId,
    orderItemId: otherId,
    itemName: 'Món chờ trong vé hỗn hợp',
    serveStatus: 'PENDING',
    currentTable: null,
  })
  tickets[2]!.dueAt = '2026-10-14T09:00:00.000Z'
  tickets[2]!.isOverdue = true
  await page.route('**/api/v1/kitchen/tickets?*', (route) =>
    route.fulfill({ json: envelope(paged(tickets)) }),
  )
  const writes: unknown[] = []
  await page.route('**/api/v1/orders/items/' + otherId + '/status', (route) => {
    writes.push(route.request().postDataJSON())
    return route.fulfill({ json: envelope({ id: otherId, serveStatus: 'COOKING' }) })
  })
  await page.goto('/staff/kitchen')
  const waiting = page.getByRole('article', { name: 'Vé bếp BAR-1', exact: true })
  const cooking = page.getByRole('article', { name: 'Vé bếp BAR-2', exact: true })
  const ready = page.getByRole('article', { name: 'Vé bếp BAR-3', exact: true })
  await expect(waiting).toHaveClass(/border-l-destructive/)
  await expect(cooking).not.toHaveClass(/border-l-destructive|border-l-amber/)
  await expect(cooking).toHaveCount(1)
  await expect(cooking.getByText('Nhiều phiên')).toBeVisible()
  await expect(cooking.getByRole('button', { name: 'Xong món' })).toBeEnabled()
  await expect(ready).not.toHaveClass(/border-l-destructive/)
  await expect(ready.getByText('Chờ quầy giao món')).toBeVisible()
  await expect(ready.getByRole('button')).toHaveCount(0)
  await cooking.getByRole('button', { name: 'Bắt đầu làm' }).click()
  await expect.poll(() => writes.length).toBe(1)
  expect(writes).toEqual([{ serveStatus: 'COOKING' }])
})

test('order detail follows keyboard selection and authoritative payment updates', async ({
  page,
}) => {
  const { fulfillment } = await operationsFixture(page)
  let writes = 0
  await page.route('**/api/v1/online-orders/requests/*/collect', (route) => {
    writes++
    return route.abort()
  })
  await page.goto('/staff/online-orders?tab=fulfillment')
  const collect = page.getByRole('button', { name: 'Khách nhận & Thu tiền' })
  await expect(collect).toBeEnabled()
  const second = page.getByRole('button', { name: 'Xem đơn Trần Hoàng Nam #00000007', exact: true })
  await second.focus()
  await page.keyboard.press('Enter')
  await expect(second).toHaveAttribute('aria-pressed', 'true')
  const detail = page.getByRole('complementary', { name: 'Chi tiết đơn', exact: true })
  await expect(detail).toContainText('Trần Hoàng Nam')
  await expect(collect).toBeDisabled()
  fulfillment[1]!.fulfillmentStatus = 'READY'
  fulfillment[1]!.orderItems[0]!.serveStatus = 'READY'
  fulfillment[1]!.orderItems[0]!.isPaid = true
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(detail.getByText('Đã thu tiền', { exact: true })).toBeVisible()
  await expect(detail).toContainText('Trần Hoàng Nam')
  await expect(collect).toBeDisabled()
  await expect(detail.getByRole('button', { name: 'Hủy đơn', exact: true })).toBeDisabled()
  fulfillment[1]!.orderItems.push({ ...fulfillment[1]!.orderItems[0]!, id, isPaid: false })
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(detail.getByText('Cần đối chiếu thanh toán', { exact: true })).toBeVisible()
  await expect(collect).toBeDisabled()
  fulfillment[1]!.orderItems[0]!.isPaid = false
  fulfillment[1]!.orderItems[0]!.serveStatus = 'SERVED'
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(detail.getByText('Chưa thu tiền', { exact: true })).toBeVisible()
  await expect(collect).toBeDisabled()
  expect(writes).toBe(0)
})

test('reservation triage is side-by-side on desktop and switchable on mobile', async ({
  page,
}, info) => {
  await operationsFixture(page)
  let writes = 0
  await page.route('**/api/v1/reservations/requests/*/approve', (route) => {
    writes++
    return route.abort()
  })
  await page.goto('/staff/reservations')
  await expect(page.getByText('Vũ Thanh Hương', { exact: true })).toBeVisible()
  if (info.project.name === 'mobile') {
    await expect(page.getByText('Ngô Hải Yến', { exact: true })).not.toBeVisible()
    await page.getByRole('button', { name: 'Yêu cầu từ khách online', exact: true }).click()
    await expect(page.getByText('Vũ Thanh Hương', { exact: true })).not.toBeVisible()
  }
  await expect(page.getByText('Ngô Hải Yến', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Duyệt & Xếp bàn', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCSS('--color-primary', '#116149')
  expect(writes).toBe(0)
})

test('long operation labels wrap without horizontal overflow', async ({ page }) => {
  const { tickets, fulfillment, reservations } = await operationsFixture(page)
  tickets[0]!.station.name = 'QuầyPhaChế'.repeat(12)
  tickets[0]!.items[0]!.itemName = 'MatchaLatte'.repeat(12)
  fulfillment[0]!.pickupName = 'KháchHàng'.repeat(12)
  fulfillment[0]!.orderItems[0]!.menuItem.name = 'MatchaLatte'.repeat(12)
  reservations[0]!.table.name = 'BànSânVườn'.repeat(12)
  reservations[0]!.customerName = 'KháchHàng'.repeat(12)
  for (const path of ['kitchen', 'online-orders?tab=fulfillment', 'reservations']) {
    await page.goto('/staff/' + path)
    const label =
      path === 'reservations'
        ? page.getByRole('heading', { name: reservations[0]!.table.name, exact: true })
        : page.getByText(/MatchaLatte/).first()
    await expect(label).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true)
  }
})

test('KDS rejects invalid deadlines instead of showing a fabricated SLA', async ({ page }) => {
  const { tickets } = await operationsFixture(page)
  tickets[0]!.dueAt = 'invalid-deadline'
  await page.goto('/staff/kitchen')
  await expect(page.getByRole('alert')).toContainText('Phản hồi không hợp lệ')
  await expect(page.getByRole('article')).toHaveCount(0)
})

test('KDS sound controls remain usable when storage is denied', async ({ page }) => {
  await operationsFixture(page)
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem
    const set = Storage.prototype.setItem
    Storage.prototype.getItem = function (key) {
      if (key === 'coffee_kds_sound') throw new DOMException('Blocked', 'SecurityError')
      return get.call(this, key)
    }
    Storage.prototype.setItem = function (key, value) {
      if (key === 'coffee_kds_sound') throw new DOMException('Blocked', 'SecurityError')
      set.call(this, key, value)
    }
  })
  await page.goto('/staff/kitchen')
  const sound = page.getByRole('button', { name: 'Bật âm báo vé mới' })
  await expect(sound).toHaveAttribute('aria-pressed', 'false')
  await sound.click()
  await expect(page.getByRole('button', { name: 'Tắt âm báo vé mới' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('article', { name: 'Vé bếp BAR-1', exact: true })).toBeVisible()
})
