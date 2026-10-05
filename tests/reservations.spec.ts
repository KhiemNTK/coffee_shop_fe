import { expect, test } from '@playwright/test'
import { envelope } from './helpers.js'
import {
  fromReservationLocal,
  reservationDayBounds,
  toReservationLocal,
} from '../src/features/reservations/reservation-time.js'

test.use({ timezoneId: 'UTC' })

const employee = {
  id: '10000000-0000-4000-8000-000000000001',
  email: 'staff@example.test',
  username: 'staff',
  fullName: 'Nguyễn Minh An',
  isActive: true,
  position: { id: '20000000-0000-4000-8000-000000000001', name: 'Thu ngân' },
}

const authorization = {
  employeeId: employee.id,
  employeeEmail: employee.email,
  roleNames: ['CASHIER'],
  permissionKeys: [
    '/reservations_read',
    '/reservations_create',
    '/reservations_update',
    '/reservations_cancel',
    '/reservations_check-in',
    '/dining-tables_read',
    '/orders_sessions_read',
  ],
}

const mockDiningTables = [
  { id: '30000000-0000-4000-8000-000000000001', name: 'Bàn 01', status: 'EMPTY' },
  { id: '30000000-0000-4000-8000-000000000002', name: 'Bàn 02', status: 'OCCUPIED' },
  { id: '30000000-0000-4000-8000-000000000003', name: 'Bàn VIP 01', status: 'EMPTY' },
]

test.describe('Public Customer Table Reservations', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-05T01:00:00.000Z'))
    await page.addInitScript(() => {
      ;(window as unknown as { turnstile: unknown }).turnstile = {
        render: (_element: HTMLElement, options: { callback: (token: string) => void }) => {
          queueMicrotask(() => options.callback('test-challenge'))
          return 'test-widget'
        },
        remove: () => {},
      }
    })
  })
  test('customer can fill form, submit reservation request and track status', async ({ page }) => {
    let requestPayload: unknown = null
    let createdRequests = 0

    await page.route('**/api/v1/reservations/public/requests', async (route) => {
      const payload = route.request().postDataJSON() as { clientRequestToken: string }
      createdRequests++
      requestPayload = payload
      await route.fulfill({
        status: 200,
        json: envelope({
          requestId: '40000000-0000-4000-8000-000000000001',
          status: 'PENDING',
          accessToken: payload.clientRequestToken,
        }),
      })
    })

    await page.route('**/api/v1/reservations/public/requests/status', async (route) => {
      await route.fulfill({
        status: 200,
        json: envelope({
          requestId: '40000000-0000-4000-8000-000000000001',
          status: 'PENDING',
          startsAt: '2026-10-05T18:00:00.000Z',
          endsAt: '2026-10-05T19:30:00.000Z',
          guestCount: 4,
          reservationStatus: null,
        }),
      })
    })

    await page.goto('/reservations')
    await expect(page.getByRole('heading', { name: 'Đặt Chỗ Trước Tại Quán' })).toBeVisible()

    // Fill booking form
    await page.getByPlaceholder('Nguyễn Văn A').fill('Trần Thị Bình')
    await page.getByPlaceholder('0912 345 678').fill('0987654321')
    await page.getByRole('spinbutton').fill('4')
    await page.getByLabel('Ngày và giờ đến (Việt Nam)').fill('2026-10-06T18:00')
    await page.getByPlaceholder('Ví dụ: Ghế em bé, bàn gần cửa sổ...').fill('Cần 1 ghế trẻ em')

    // Submit
    await expect(page.getByRole('button', { name: 'Gửi yêu cầu đặt bàn ngay' })).toBeEnabled()
    await page
      .locator('main form')
      .first()
      .evaluate((form) => {
        const booking = form as HTMLFormElement
        booking.requestSubmit()
        booking.requestSubmit()
      })

    // Expect status tracking card to appear
    await expect(page.getByText('Trạng thái yêu cầu đặt bàn của bạn')).toBeVisible()
    await expect(page.getByText('Yêu cầu đang chờ quán xác nhận')).toBeVisible()
    await expect(page.getByText('4 người')).toBeVisible()

    expect(requestPayload).toMatchObject({
      customerName: 'Trần Thị Bình',
      phoneNumber: '0987654321',
      guestCount: 4,
      notes: 'Cần 1 ghế trẻ em',
      startsAt: '2026-10-06T11:00:00.000Z',
      endsAt: '2026-10-06T12:30:00.000Z',
      clientRequestToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    })
    expect(createdRequests).toBe(1)
  })

  test('an uncertain submission keeps the same frozen payload through a rate-limited retry', async ({
    page,
  }) => {
    const payloads: Record<string, unknown>[] = []
    await page.route('**/api/v1/reservations/public/requests', async (route) => {
      const payload = route.request().postDataJSON() as Record<string, unknown>
      payloads.push(payload)
      if (payloads.length === 1) {
        await route.abort()
        return
      }
      if (payloads.length === 2) {
        await route.fulfill({ status: 429, json: { message: 'Rate limited' } })
        return
      }
      await route.fulfill({
        json: envelope({
          requestId: '40000000-0000-4000-8000-000000000001',
          status: 'PENDING',
          accessToken: payload.clientRequestToken,
        }),
      })
    })
    await page.route('**/api/v1/reservations/public/requests/status', (route) => {
      if (payloads.length < 3)
        return route.fulfill({ status: 404, json: { message: 'Request not found' } })
      return route.fulfill({
        json: envelope({
          requestId: '40000000-0000-4000-8000-000000000001',
          status: 'PENDING',
          startsAt: '2026-10-06T11:00:00.000Z',
          endsAt: '2026-10-06T12:30:00.000Z',
          guestCount: 2,
          reservationStatus: null,
        }),
      })
    })
    await page.goto('/reservations')
    await page.getByLabel('Họ và tên của bạn').fill('Khách đặt bàn')
    await page.getByLabel('Số điện thoại liên hệ').fill('0900000000')
    await page.getByRole('button', { name: 'Gửi yêu cầu đặt bàn ngay' }).click()
    await expect(page.getByLabel('Số điện thoại liên hệ')).toBeDisabled()
    await page.getByRole('button', { name: 'Đối chiếu yêu cầu', exact: true }).click()
    await page.getByRole('button', { name: 'Quay lại yêu cầu đã gửi' }).click()
    await expect(page.getByLabel('Số điện thoại liên hệ')).toBeDisabled()
    await expect(page.getByLabel('Số điện thoại liên hệ')).toHaveValue('0900000000')
    await page.getByRole('button', { name: 'Gửi lại yêu cầu đã gửi' }).click()
    await expect(page.getByRole('alert')).toContainText('Bạn thao tác quá nhanh')
    await expect(page.getByLabel('Số điện thoại liên hệ')).toBeDisabled()
    await page.getByRole('button', { name: 'Gửi lại yêu cầu đã gửi' }).click()
    await expect(page.getByText('Yêu cầu đang chờ quán xác nhận')).toBeVisible()
    expect(payloads).toHaveLength(3)
    for (const payload of payloads)
      expect(payload).toMatchObject({ ...payloads[0], turnstileToken: payload.turnstileToken })
  })
})

test.describe('Staff Reservations Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: envelope(employee) }))
    await page.route('**/api/v1/auth/me/permissions', (route) =>
      route.fulfill({ json: envelope(authorization) }),
    )
    await page.route('**/api/v1/dining-tables', (route) =>
      route.fulfill({ json: envelope(mockDiningTables) }),
    )
  })

  test('staff can view reservations and perform check-in', async ({ page }) => {
    const mockReservations = [
      {
        id: 101,
        customerName: 'Lê Hoàng Long',
        phoneNumber: '0901234567',
        startsAt: new Date(Date.now() + 60_000).toISOString(),
        endsAt: new Date(Date.now() + 7_200_000).toISOString(),
        guestCount: 2,
        notes: 'Khách quen',
        status: 'PENDING',
        tableId: '30000000-0000-4000-8000-000000000001',
        table: { id: '30000000-0000-4000-8000-000000000001', name: 'Bàn 01', status: 'EMPTY' },
        employee: { id: employee.id, fullName: employee.fullName },
        orderSessionId: null,
        updatedAt: '2026-10-05T01:00:00.000Z',
      },
    ]

    await page.route('**/api/v1/reservations?*', (route) =>
      route.fulfill({
        json: envelope({
          list: mockReservations,
          totalItems: 1,
          totalPages: 1,
          currentPage: 1,
        }),
      }),
    )

    await page.route('**/api/v1/reservations/requests?*', (route) =>
      route.fulfill({
        json: envelope({
          list: [],
          totalItems: 0,
          totalPages: 0,
          currentPage: 1,
        }),
      }),
    )

    let checkedIn = false
    await page.route('**/api/v1/reservations/101', (route) =>
      route.fulfill({ json: envelope(mockReservations[0]) }),
    )
    await page.route('**/api/v1/reservations/101/check-in', async (route) => {
      checkedIn = true
      await route.fulfill({
        status: 200,
        json: envelope({
          reservation: {
            id: 101,
            status: 'ARRIVED',
            checkedInAt: new Date().toISOString(),
            orderSessionId: '50000000-0000-4000-8000-000000000001',
          },
          orderSession: {
            id: '50000000-0000-4000-8000-000000000001',
            tableId: '30000000-0000-4000-8000-000000000001',
            sessionStatus: 'ACTIVE',
            createdAt: new Date().toISOString(),
          },
        }),
      })
    })

    await page.goto('/staff/reservations')
    await expect(page.getByRole('heading', { name: 'Quản lý Đặt bàn' })).toBeVisible()

    // Verify reservation card content
    await expect(page.getByText('Lê Hoàng Long')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Bàn 01' })).toBeVisible()
    await expect(page.getByText('Chờ đón khách', { exact: true })).toBeVisible()

    // Click "Đón khách" button
    const checkInBtn = page.getByRole('button', { name: 'Đón khách', exact: true })
    await expect(checkInBtn).toBeVisible()
    await checkInBtn.click()
    expect(checkedIn).toBe(false)
    await page.getByRole('button', { name: 'Xác nhận đón khách' }).click()

    // Verify check-in dialog
    await expect(page.getByText('Đón khách vào bàn thành công!')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mở phiên POS ngay' })).toBeVisible()
    expect(checkedIn).toBe(true)
  })

  test('list errors are not rendered as empty results and preserve the selected filter', async ({
    page,
  }) => {
    let fail = true
    let lastStatus = ''
    await page.route('**/api/v1/reservations?*', (route) => {
      lastStatus = new URL(route.request().url()).searchParams.get('status') ?? ''
      return route.fulfill(
        fail
          ? { status: 500, json: { message: 'Unavailable' } }
          : {
              json: envelope({ list: [], totalItems: 0, totalPages: 0, currentPage: 1 }),
            },
      )
    })
    await page.goto('/staff/reservations')
    await expect(page.getByRole('button', { name: 'Tải lại danh sách' })).toBeVisible()
    await expect(page.getByText('Không có lịch đặt bàn nào phù hợp')).toHaveCount(0)
    fail = false
    await page.getByRole('button', { name: 'Tải lại danh sách' }).click()
    await page.getByLabel('Lọc theo trạng thái đặt bàn').selectOption('NO_SHOW')
    await expect.poll(() => lastStatus).toBe('NO_SHOW')
    await page.getByRole('button', { name: 'Làm mới' }).click()
    await expect(page.getByLabel('Lọc theo trạng thái đặt bàn')).toHaveValue('NO_SHOW')
  })

  test('update-only staff can reject but cannot approve or fetch unauthorized tables; ALL is explicit', async ({
    page,
  }) => {
    await page.route('**/api/v1/auth/me/permissions', (route) =>
      route.fulfill({
        json: envelope({
          ...authorization,
          permissionKeys: ['/reservations_read', '/reservations_update'],
        }),
      }),
    )
    let tableReads = 0
    let lastStatus = ''
    await page.route('**/api/v1/dining-tables', (route) => {
      tableReads++
      return route.fulfill({ status: 403, json: {} })
    })
    await page.route('**/api/v1/reservations?*', (route) =>
      route.fulfill({ json: envelope({ list: [], totalItems: 0, totalPages: 0, currentPage: 1 }) }),
    )
    await page.route('**/api/v1/reservations/requests?*', (route) => {
      lastStatus = new URL(route.request().url()).searchParams.get('status') ?? ''
      return route.fulfill({
        json: envelope({
          list: [
            {
              id: '40000000-0000-4000-8000-000000000001',
              customerName: 'Khách online',
              phoneNumber: '0900000000',
              startsAt: '2026-10-06T11:00:00.000Z',
              endsAt: '2026-10-06T12:30:00.000Z',
              guestCount: 2,
              status: 'PENDING',
              createdAt: '2026-10-05T11:00:00.000Z',
            },
          ],
          totalItems: 1,
          totalPages: 1,
          currentPage: 1,
        }),
      })
    })
    await page.goto('/staff/reservations')
    await page.getByRole('button', { name: 'Yêu cầu từ khách online' }).click()
    await expect(page.getByRole('button', { name: 'Từ chối', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Duyệt & Xếp bàn' })).toHaveCount(0)
    await page.getByLabel('Lọc theo trạng thái yêu cầu').selectOption('ALL')
    await expect.poll(() => lastStatus).toBe('ALL')
    expect(tableReads).toBe(0)
  })

  test('edits load fresh detail and clear notes with a minimal versioned patch', async ({
    page,
  }) => {
    const reservation = {
      id: 101,
      customerName: 'Khách hàng',
      phoneNumber: '0900000000',
      startsAt: new Date(Date.now() + 3_600_000).toISOString(),
      endsAt: new Date(Date.now() + 7_200_000).toISOString(),
      guestCount: 2,
      notes: 'Ghi chú cũ',
      status: 'PENDING',
      tableId: mockDiningTables[0]!.id,
      table: mockDiningTables[0],
      updatedAt: '2026-10-05T01:00:00.000Z',
    }
    await page.route('**/api/v1/reservations?*', (route) =>
      route.fulfill({
        json: envelope({ list: [reservation], totalItems: 1, totalPages: 1, currentPage: 1 }),
      }),
    )
    let patch: unknown
    await page.route('**/api/v1/reservations/101', (route) => {
      if (route.request().method() === 'PATCH') {
        patch = route.request().postDataJSON()
        return route.fulfill({ json: envelope({ ...reservation, notes: null }) })
      }
      return route.fulfill({
        json: envelope({ ...reservation, customerName: 'Tên mới nhất', notes: 'Ghi chú mới nhất' }),
      })
    })
    await page.goto('/staff/reservations')
    await page.getByRole('button', { name: 'Đổi giờ hoặc bàn' }).click()
    await expect(page.getByLabel('Tên khách hàng', { exact: true })).toHaveValue('Tên mới nhất')
    await page.getByLabel('Ghi chú', { exact: true }).fill('')
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click()
    await expect
      .poll(() => patch)
      .toEqual({ notes: null, expectedUpdatedAt: reservation.updatedAt })
  })

  test('check-in recovers a committed result by reading detail without a second write or POS permission bypass', async ({
    page,
  }) => {
    await page.route('**/api/v1/auth/me/permissions', (route) =>
      route.fulfill({
        json: envelope({
          ...authorization,
          permissionKeys: ['/reservations_read', '/reservations_check-in'],
        }),
      }),
    )
    const reservation = {
      id: 101,
      customerName: 'Khách đến quán',
      table: mockDiningTables[0],
      updatedAt: '2026-10-05T01:00:00.000Z',
      phoneNumber: '0900000000',
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 3_600_000).toISOString(),
      guestCount: 2,
      status: 'PENDING',
      tableId: mockDiningTables[0]!.id,
    }
    let writes = 0
    await page.route('**/api/v1/reservations?*', (route) =>
      route.fulfill({
        json: envelope({ list: [reservation], totalItems: 1, totalPages: 1, currentPage: 1 }),
      }),
    )
    await page.route('**/api/v1/reservations/101', (route) =>
      route.fulfill({
        json: envelope({
          ...reservation,
          status: writes ? 'ARRIVED' : 'PENDING',
          orderSessionId: writes ? '50000000-0000-4000-8000-000000000001' : null,
        }),
      }),
    )
    await page.route('**/api/v1/reservations/101/check-in', (route) => {
      writes++
      return route.abort()
    })
    await page.goto('/staff/reservations')
    await page.getByRole('button', { name: 'Đón khách', exact: true }).click()
    await page.getByRole('button', { name: 'Xác nhận đón khách' }).click()
    await page.getByRole('button', { name: 'Đối chiếu trạng thái' }).click()
    await expect(page.getByRole('dialog').getByRole('status')).toContainText('ARRIVED')
    await expect(page.getByRole('button', { name: 'Mở phiên POS ngay' })).toHaveCount(0)
    expect(writes).toBe(1)
  })
})

test('reservation input and day boundaries are independent of the device timezone', () => {
  expect(fromReservationLocal('2026-10-06T18:00').toISOString()).toBe('2026-10-06T11:00:00.000Z')
  expect(toReservationLocal(new Date('2026-10-05T18:00:00.000Z'))).toBe('2026-10-06T01:00')
  expect(reservationDayBounds(0, new Date('2026-10-05T18:00:00.000Z'))).toEqual({
    startsFrom: '2026-10-05T17:00:00.000Z',
    startsTo: '2026-10-06T16:59:59.999Z',
  })
  expect(() => fromReservationLocal('2026-02-31T18:00')).toThrow()
})
