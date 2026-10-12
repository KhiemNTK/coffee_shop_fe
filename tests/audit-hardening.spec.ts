import { expect, test } from '@playwright/test'
import {
  defaultMockAdminEmployee,
  defaultMockAdminAuth,
  envelope,
  onlineAvailability,
} from './helpers.js'

test('coalesces a burst of KDS events into one refresh and cancels scheduled work on unmount', async ({
  page,
}) => {
  await page.addInitScript(() => {
    class FixtureEventSource extends EventTarget {
      static latest: FixtureEventSource
      onopen: (() => void) | null = null
      onerror: (() => void) | null = null
      closed = false
      constructor() {
        super()
        FixtureEventSource.latest = this
        setTimeout(() => this.onopen?.(), 0)
      }
      close() {
        this.closed = true
      }
    }
    Object.assign(window, { EventSource: FixtureEventSource })
  })
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminEmployee) })
  )
  await page.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminAuth(['/kitchen-tickets_read'])) })
  )
  let tickets = 0
  let workloads = 0
  await page.route('**/api/v1/kitchen/tickets?*', (route) => {
    tickets++
    return route.fulfill({
      json: envelope({ list: [], totalItems: 0, totalPages: 0, currentPage: 1 }),
    })
  })
  await page.route('**/api/v1/kitchen/workload', (route) => {
    workloads++
    return route.fulfill({
      json: envelope({ asOf: new Date().toISOString(), dueSoonWindowSeconds: 60, stations: [] }),
    })
  })
  await page.goto('/staff/kitchen')
  await expect(page.getByText('Realtime Live')).toBeVisible()
  await expect(page.getByText('Không có vé bếp trong bộ lọc hiện tại.')).toBeVisible()
  await page.clock.install()
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  const before = { tickets, workloads }
  await page.evaluate(() => {
    const source = (window.EventSource as unknown as { latest: EventTarget }).latest
    for (let i = 0; i < 20; i++) source.dispatchEvent(new MessageEvent('kitchen.refresh'))
  })
  await page.clock.runFor(249)
  expect({ tickets, workloads }).toEqual(before)
  await page.clock.runFor(10)
  await expect.poll(() => tickets).toBe(before.tickets + 1)
  await expect.poll(() => workloads).toBe(before.workloads + 1)
  await page.evaluate(() => {
    const source = (window.EventSource as unknown as { latest: EventTarget }).latest
    source.dispatchEvent(new MessageEvent('kitchen.refresh'))
  })
  await page.getByRole('link', { name: 'Tài khoản', exact: true }).click()
  await expect(page).toHaveURL(/\/staff\/account$/)
  await expect(
    page.getByRole('heading', { name: defaultMockAdminEmployee.fullName, exact: true })
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => (window.EventSource as unknown as { latest: { closed: boolean } }).latest.closed
    )
  ).toBe(true)
  const ended = { tickets, workloads }
  await page.evaluate(() =>
    (window.EventSource as unknown as { latest: EventTarget }).latest.dispatchEvent(
      new MessageEvent('kitchen.refresh')
    )
  )
  await page.clock.runFor(500)
  expect({ tickets, workloads }).toEqual(ended)
})

test('closed ASAP intake blocks a fresh checkout and still offers scheduled pickup', async ({
  page,
}, info) => {
  const itemId = '86000000-0000-4000-8000-000000000001'
  const categoryId = '86000000-0000-4000-8000-000000000002'
  await page.route('**/api/v1/menu/public/categories', (route) =>
    route.fulfill({ json: envelope([]) })
  )
  await page.route('**/api/v1/menu/public/items?*', (route) =>
    route.fulfill({
      json: envelope({
        list: [
          {
            id: itemId,
            name: 'Coffee fixture',
            price: '30000',
            category: { id: categoryId, name: 'Coffee' },
            optionGroups: [],
          },
        ],
        currentPage: 1,
        totalItems: 1,
        totalPages: 1,
      }),
    })
  )
  await page.route('**/api/v1/online-orders/availability', (route) =>
    route.fulfill({ json: envelope({ ...onlineAvailability, acceptingAsap: false }) })
  )
  await page.route('**/api/v1/online-orders/pickup-slots?*', (route) =>
    route.fulfill({
      json: envelope({
        date: '2099-01-01',
        timeZone: 'Asia/Ho_Chi_Minh',
        enabled: true,
        slots: [{ pickupAt: '2099-01-01T01:00:00Z', remaining: 4 }],
      }),
    })
  )
  let writes = 0
  await page.route('**/api/v1/online-orders/requests', (route) => {
    writes++
    return route.abort()
  })
  await page.goto('/order')
  await page.getByRole('button', { name: 'Chọn món', exact: true }).click()
  await page.getByRole('button', { name: 'Thêm vào giỏ', exact: true }).click()
  await expect(page.getByText('Giờ nhận ngay:', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Lấy sớm nhất', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Xem lại đơn', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Hẹn giờ trước', exact: true }).click()
  await expect(page.getByRole('button', { name: /08:00/ })).toBeEnabled()
  expect(writes).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('asap-closed.png') })
})

test('merge retains the destination session chosen before a concurrent table refresh', async ({
  page,
}) => {
  const sourceTableId = '86000000-0000-4000-8000-000000000010'
  const targetTableId = '86000000-0000-4000-8000-000000000011'
  const sourceSessionId = '86000000-0000-4000-8000-000000000012'
  const oldTargetId = '86000000-0000-4000-8000-000000000013'
  const newTargetId = '86000000-0000-4000-8000-000000000014'
  let targetSessionId = oldTargetId
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminEmployee) })
  )
  await page.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill({
      json: envelope(
        defaultMockAdminAuth([
          '/orders_sessions_read',
          '/orders_tables_merge',
          '/dining-tables_read',
        ])
      ),
    })
  )
  await page.route('**/api/v1/menu/public/categories', (route) =>
    route.fulfill({ json: envelope([]) })
  )
  await page.route('**/api/v1/menu/public/items?*', (route) =>
    route.fulfill({ json: envelope({ list: [], currentPage: 1, totalPages: 0, totalItems: 0 }) })
  )
  await page.route(`**/api/v1/orders/sessions/${sourceSessionId}`, (route) =>
    route.fulfill({
      json: envelope({
        id: sourceSessionId,
        sessionStatus: 'ACTIVE',
        createdAt: new Date().toISOString(),
        table: { id: sourceTableId, name: 'Source', status: 'OCCUPIED' },
        employee: defaultMockAdminEmployee,
        orderItems: [],
      }),
    })
  )
  await page.route('**/api/v1/dining-tables', (route) =>
    route.fulfill({
      json: envelope([
        {
          id: sourceTableId,
          name: 'Source',
          status: 'OCCUPIED',
          orderSessions: [{ id: sourceSessionId, sessionStatus: 'ACTIVE' }],
        },
        {
          id: targetTableId,
          name: 'Target',
          status: 'OCCUPIED',
          orderSessions: [{ id: targetSessionId, sessionStatus: 'ACTIVE' }],
        },
      ]),
    })
  )
  const payloads: unknown[] = []
  await page.route('**/api/v1/orders/sessions/merge', (route) => {
    payloads.push(route.request().postDataJSON())
    return route.fulfill({ status: 409, json: { message: 'Destination session changed.' } })
  })
  await page.goto(`/staff/pos/sessions/${sourceSessionId}`)
  await page.getByRole('button', { name: 'Gộp bàn', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('combobox', { name: 'Bàn đích', exact: true })
    .selectOption(targetTableId)
  targetSessionId = newTargetId
  await page.evaluate(async (employeeId) => {
    const path = '/src/app/query-client.ts'
    const { queryClient } = await import(path)
    await queryClient.invalidateQueries({ queryKey: ['private', employeeId, 'dining-tables'] })
  }, defaultMockAdminEmployee.id)
  const review = page
    .getByRole('dialog')
    .getByRole('button', { name: 'Kiểm tra trước khi chuyển', exact: true })
  await review.click()
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'Destination session changed' })
  ).toBeVisible()
  expect(payloads).toEqual([
    {
      sourceTableIds: [sourceTableId],
      destinationTableId: targetTableId,
      sourceOrderSessionIds: [sourceSessionId],
      destinationOrderSessionId: oldTargetId,
    },
  ])
})
