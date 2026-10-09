import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const id = '71000000-0000-4000-8000-000000000001'
const itemId = '71000000-0000-4000-8000-000000000002'
const date = '2026-10-05T08:00:00.000Z'
const token = 'c'.repeat(64)
const readyOrder = {
  id,
  pickupName: 'Pickup fixture',
  phoneNumber: '0901234567',
  quotedSubtotal: '50000.25',
  createdAt: date,
  pickupAt: date,
  isOverdue: true,
  isNoShowEligible: true,
  fulfillmentStatus: 'READY',
  orderSessionId: id,
  sessionStatus: 'ACTIVE',
  orderItems: [
    {
      id: itemId,
      quantity: 1,
      priceAtTime: '50000.25',
      serveStatus: 'READY',
      isPaid: false,
      selectedOptions: [],
      menuItem: { name: 'Coffee' },
    },
  ],
}
const paged = (list: unknown[], currentPage = 1, totalPages = 1) => ({
  list,
  currentPage,
  totalPages,
  totalItems: list.length * totalPages,
})
async function staff(page: Page, permissions: string[]) {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminEmployee) }),
  )
  await page.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminAuth(permissions)) }),
  )
}
async function fulfillment(page: Page) {
  await staff(page, ['/online-orders_read', '/orders_items_handoff', '/invoices_create'])
  await page.route('**/api/v1/online-orders/requests?*', (route) =>
    route.fulfill({ json: envelope(paged([])) }),
  )
  await page.route('**/api/v1/online-orders/requests/fulfillment?*', (route) =>
    route.fulfill({ json: envelope(paged([readyOrder])) }),
  )
  await page.goto('/staff/online-orders')
  await page.getByRole('tab', { name: 'Đang chế biến & Chờ nhận' }).click()
  await expect(page.getByRole('button', { name: 'Khách nhận & Thu tiền' })).toBeEnabled()
}

test('uncertain KDS status requires a fresh read before the next step', async ({ page }) => {
  await staff(page, ['/kitchen-tickets_read', '/orders_items_update-status'])
  await page.route('**/api/v1/kitchen/events', (route) => route.abort())
  await page.route('**/api/v1/kitchen/workload', (route) =>
    route.fulfill({ json: envelope({ asOf: date, dueSoonWindowSeconds: 60, stations: [] }) }),
  )
  let status = 'PENDING'
  await page.route('**/api/v1/kitchen/tickets?*', (route) =>
    route.fulfill({
      json: envelope(
        paged([
          {
            id,
            sequence: 1,
            ticketNumber: 'SAFE-1',
            state: status === 'PENDING' ? 'PENDING' : 'IN_PROGRESS',
            isOverdue: false,
            dueAt: date,
            createdAt: date,
            station: { id, code: 'BAR', name: 'Bar' },
            orderSessionId: id,
            table: null,
            items: [
              {
                id: itemId,
                orderItemId: itemId,
                itemName: 'Coffee',
                quantity: 1,
                selectedOptions: [],
                serveStatus: status,
                currentTable: null,
              },
            ],
          },
        ]),
      ),
    }),
  )
  const writes: string[] = []
  await page.route('**/api/v1/orders/items/' + itemId + '/status', (route) => {
    status = route.request().postDataJSON().serveStatus
    writes.push(status)
    return writes.length === 1
      ? route.abort()
      : route.fulfill({ json: envelope({ id: itemId, serveStatus: status }) })
  })
  await page.goto('/staff/kitchen')
  await page.getByRole('button', { name: 'Bắt đầu làm' }).click()
  await expect(page.getByRole('button', { name: 'Xong món' })).toBeDisabled()
  await page.getByRole('button', { name: 'Đối chiếu vé bếp' }).click()
  await expect(page.getByRole('button', { name: 'Xong món' })).toBeEnabled()
  expect(writes).toEqual(['COOKING'])
  await page.getByRole('button', { name: 'Xong món' }).click()
  await expect(page.getByText('Chờ quầy giao món')).toBeVisible()
  expect(writes).toEqual(['COOKING', 'READY'])
})

test('uncertain walk-in handoff is reviewed inside the dialog without another write', async ({
  page,
}) => {
  await staff(page, ['/orders_sessions_read', '/orders_items_handoff'])
  await page.route('**/api/v1/dining-tables', (route) => route.fulfill({ json: envelope([]) }))
  await page.route('**/api/v1/orders/sessions', (route) => route.fulfill({ json: envelope([]) }))
  await page.route('**/api/v1/cashier-shifts/current', (route) =>
    route.fulfill({ status: 404, json: {} }),
  )
  let handed = false
  let writes = 0
  await page.route('**/api/v1/orders/takeaway/handoff?*', (route) =>
    route.fulfill({
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
                  ticketNumber: 'BAR-SAFE',
                },
              ],
        ),
      ),
    }),
  )
  await page.route('**/api/v1/orders/items/' + itemId + '/handoff', (route) => {
    handed = true
    writes++
    return route.abort()
  })
  await page.goto('/staff/pos')
  await page.getByRole('button', { name: 'Giao món', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Đã giao cho khách' }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Đã giao cho khách' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Đối chiếu món chờ giao' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('Không có món chờ giao tại quầy.')).toBeVisible()
  expect(writes).toBe(1)
})

test('KDS rejects a missing current table and does not fabricate workload zeros', async ({
  page,
}) => {
  await staff(page, ['/kitchen-tickets_read', '/orders_items_update-status'])
  await page.route('**/api/v1/kitchen/events', (route) => route.abort())
  await page.route('**/api/v1/kitchen/workload', (route) =>
    route.fulfill({ status: 503, json: {} }),
  )
  await page.route('**/api/v1/kitchen/tickets?*', (route) =>
    route.fulfill({
      json: envelope(
        paged([
          {
            id,
            sequence: 1,
            ticketNumber: 'MISSING-TABLE',
            state: 'PENDING',
            isOverdue: false,
            dueAt: date,
            createdAt: date,
            station: { id, code: 'BAR', name: 'Bar' },
            orderSessionId: id,
            table: { id, name: 'Historical table' },
            items: [
              {
                id: itemId,
                orderItemId: itemId,
                itemName: 'Coffee',
                quantity: 1,
                serveStatus: 'PENDING',
              },
            ],
          },
        ]),
      ),
    }),
  )
  await page.goto('/staff/kitchen')
  await expect(page.getByRole('alert').filter({ hasText: 'Phản hồi không hợp lệ' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Bắt đầu làm' })).toHaveCount(0)
  await expect(page.getByText('Món cần làm', { exact: true })).toHaveCount(0)
})

test('online queue pages only the active tab and no-show requires review permission and confirmation', async ({
  page,
}) => {
  await staff(page, ['/online-orders_read', '/online-orders_review'])
  await page.route('**/api/v1/online-orders/requests?*', (route) => {
    const p = Number(new URL(route.request().url()).searchParams.get('page'))
    return route.fulfill({
      json: envelope(
        paged(
          [
            {
              id,
              pickupName: 'Pending page ' + p,
              phoneNumber: '0901234567',
              quotedSubtotal: '50000.25',
              expiresAt: '2099-01-01T00:00:00Z',
              createdAt: date,
              items: [],
            },
          ],
          p,
          2,
        ),
      ),
    })
  })
  const reads: URL[] = []
  await page.route('**/api/v1/online-orders/requests/fulfillment?*', (route) => {
    reads.push(new URL(route.request().url()))
    return route.fulfill({ json: envelope(paged([readyOrder])) })
  })
  let writes = 0
  await page.route('**/api/v1/online-orders/requests/' + id + '/no-show', (route) => {
    writes++
    return route.abort()
  })
  await page.goto('/staff/online-orders')
  await expect(page.getByText('Pending page 1', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Trang sau' }).click()
  await expect(page.getByText('Pending page 2', { exact: true })).toBeVisible()
  expect(reads).toHaveLength(0)
  await page.getByRole('tab', { name: 'Đang chế biến & Chờ nhận' }).click()
  await expect(page.getByRole('button', { name: 'Báo vắng mặt (No-show)' })).toBeEnabled()
  expect(reads[0]?.searchParams.get('page')).toBe('1')
  await page.getByRole('checkbox', { name: 'Chỉ hiển thị đơn trễ hẹn' }).check()
  await expect
    .poll(() => reads.some((url) => url.searchParams.get('overdueOnly') === 'true'))
    .toBe(true)
  await page.getByRole('button', { name: 'Báo vắng mặt (No-show)' }).click()
  expect(writes).toBe(0)
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: /Xác nhận ghi nhận/ }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByRole('button', { name: /Xác nhận ghi nhận/ })).toBeDisabled()
  expect(writes).toBe(1)
  await dialog.getByRole('button', { name: 'Đối chiếu danh sách' }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes).toBe(1)
})

test('cash collection retries the exact frozen decimal payload and idempotency key', async ({
  page,
}) => {
  await fulfillment(page)
  await expect(page.getByRole('button', { name: 'Hủy đơn', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Báo vắng mặt (No-show)' })).toHaveCount(0)
  const writes: Record<string, unknown>[] = []
  await page.route('**/api/v1/online-orders/requests/' + id + '/collect', (route) => {
    writes.push(route.request().postDataJSON())
    return writes.length === 1
      ? route.abort()
      : route.fulfill({
          json: envelope({
            requestId: id,
            invoiceId: id,
            invoiceNumber: 'INV-SAFE',
            totalAmount: '50000.25',
            amountTendered: '60000.50',
            changeAmount: '10000.25',
            collectedItemIds: [itemId],
            collectedAt: date,
          }),
        })
  })
  await page.getByRole('button', { name: 'Khách nhận & Thu tiền' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Mã xác thực khách hàng').fill(token)
  await dialog.getByLabel('Tiền khách đưa (VNĐ)').fill('60000.50')
  await dialog.getByRole('button', { name: 'Xác nhận thu tiền & Giao' }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByLabel('Tiền khách đưa (VNĐ)')).toBeDisabled()
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Kiểm tra lại cùng lần thu tiền' }).click()
  await expect(dialog.getByRole('status')).toContainText('INV-SAFE')
  expect(writes).toHaveLength(2)
  expect(writes[1]).toEqual(writes[0])
  expect(writes[0]).toMatchObject({
    accessToken: token,
    amountTendered: '60000.50',
    idempotencyKey: expect.any(String),
  })
  await expect(dialog.getByText('10.000,25 ₫', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Hoàn tất', exact: true }).click()
  await expect(dialog).toHaveCount(0)
})

test('uncertain collection can resolve read-only without claiming this cashier collected it', async ({
  page,
}) => {
  await fulfillment(page)
  let writes = 0
  await page.route('**/api/v1/online-orders/requests/' + id + '/collect', (route) => {
    writes++
    return route.abort()
  })
  await page.route('**/api/v1/online-orders/requests/status', (route) =>
    route.fulfill({
      json: envelope({
        requestId: id,
        status: 'ACCEPTED',
        expiresAt: '2099-01-01T00:00:00Z',
        quotedSubtotal: '50000.25',
        items: [],
        orderItems: [],
        isPaid: true,
        fulfillmentStatus: 'COLLECTED',
      }),
    }),
  )
  await page.getByRole('button', { name: 'Khách nhận & Thu tiền' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Mã xác thực khách hàng').fill(token)
  await dialog.getByRole('button', { name: 'Xác nhận thu tiền & Giao' }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await dialog.getByRole('button', { name: 'Đối chiếu trạng thái đơn' }).click()
  await expect(
    dialog.getByRole('button', { name: 'Kiểm tra lại cùng lần thu tiền' }),
  ).toBeDisabled()
  await dialog.getByRole('button', { name: 'Quay lại', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes).toBe(1)
  await expect(page.getByText('Thu tiền và giao món thành công.')).toHaveCount(0)
})

test('public tracking cannot cancel cooking items and preserves exact options, price and store time', async ({
  page,
}) => {
  await page.addInitScript(
    (value) => sessionStorage.setItem('coffee_shop_takeaway_order', JSON.stringify(value)),
    { requestId: id, accessToken: token },
  )
  await page.route('**/api/v1/online-orders/requests/status', (route) =>
    route.fulfill({
      json: envelope({
        requestId: id,
        status: 'ACCEPTED',
        expiresAt: '2099-01-01T00:00:00Z',
        pickupAt: date,
        quotedSubtotal: '50000.25',
        isPaid: false,
        fulfillmentStatus: 'PREPARING',
        items: [
          {
            lineNumber: 1,
            menuItemId: itemId,
            quotedName: 'Coffee',
            quotedUnitPrice: '50000.25',
            quantity: 1,
            quotedOptions: [{ id, groupName: 'Size', name: 'Large', priceDelta: '5000.25' }],
          },
        ],
        orderItems: [
          {
            id: itemId,
            menuItemId: itemId,
            quantity: 1,
            serveStatus: 'COOKING',
            isPaid: false,
            selectedOptions: [],
          },
        ],
      }),
    }),
  )
  await page.goto('/order')
  await expect(page.getByText('Size: Large')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hủy đơn hàng này' })).toHaveCount(0)
  await expect(page.getByText('50.000,25 ₫', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/15:00:00/)).toBeVisible()
})
