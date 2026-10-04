import { expect, test } from '@playwright/test'
import { envelope } from './helpers.js'

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
  ],
}

const mockDiningTables = [
  { id: '30000000-0000-4000-8000-000000000001', name: 'Bàn 01', status: 'EMPTY' },
  { id: '30000000-0000-4000-8000-000000000002', name: 'Bàn 02', status: 'OCCUPIED' },
  { id: '30000000-0000-4000-8000-000000000003', name: 'Bàn VIP 01', status: 'EMPTY' },
]

test.describe('Public Customer Table Reservations', () => {
  test('customer can fill form, submit reservation request and track status', async ({ page }) => {
    let requestPayload: unknown = null

    await page.route('**/api/v1/reservations/public/requests', async (route) => {
      requestPayload = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        json: envelope({
          requestId: '40000000-0000-4000-8000-000000000001',
          status: 'PENDING',
          accessToken: 'mock_token_12345678901234567890123456789012345',
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
    await page.getByPlaceholder('Ví dụ: Ghế em bé, bàn gần cửa sổ...').fill('Cần 1 ghế trẻ em')

    // Submit
    await page.getByRole('button', { name: 'Gửi yêu cầu đặt bàn ngay' }).click()

    // Expect status tracking card to appear
    await expect(page.getByText('Trạng thái yêu cầu đặt bàn của bạn')).toBeVisible()
    await expect(page.getByText('Yêu cầu đang chờ quán xác nhận')).toBeVisible()
    await expect(page.getByText('4 người')).toBeVisible()

    expect(requestPayload).toMatchObject({
      customerName: 'Trần Thị Bình',
      phoneNumber: '0987654321',
      guestCount: 4,
      notes: 'Cần 1 ghế trẻ em',
    })
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
        startsAt: '2026-10-02T10:00:00.000Z',
        endsAt: '2026-10-02T12:00:00.000Z',
        guestCount: 2,
        notes: 'Khách quen',
        status: 'PENDING',
        tableId: '30000000-0000-4000-8000-000000000001',
        table: { id: '30000000-0000-4000-8000-000000000001', name: 'Bàn 01', status: 'EMPTY' },
        employee: { id: employee.id, fullName: employee.fullName },
        orderSessionId: null,
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

    // Verify check-in dialog
    await expect(page.getByText('Đón khách vào bàn thành công!')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mở phiên POS ngay' })).toBeVisible()
    expect(checkedIn).toBe(true)
  })
})
