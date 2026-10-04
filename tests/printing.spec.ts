import { expect, test } from '@playwright/test'
import { envelope } from './helpers.js'

const employee = {
  id: '10000000-0000-4000-8000-000000000001',
  email: 'admin@coffee.test',
  username: 'admin',
  fullName: 'Quản trị viên Hệ thống',
  isActive: true,
  position: { id: '20000000-0000-4000-8000-000000000001', name: 'Quản trị viên' },
}

const authorization = {
  employeeId: employee.id,
  employeeEmail: employee.email,
  roleNames: ['ADMIN'],
  permissionKeys: [
    '/print-devices_read',
    '/print-devices_manage',
    '/print-jobs_read',
    '/print-jobs_manage',
    '/receipts_reprint',
  ],
}

const mockDevices = [
  {
    id: 'dev-001',
    name: 'Máy in Quầy Thu ngân 1',
    type: 'RECEIPT',
    paperSize: '80mm',
    isActive: true,
    isDefault: true,
    status: 'READY',
    isOnline: true,
    lastSeenAt: '2026-10-02T09:00:00.000Z',
    lastError: null,
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-10-02T09:00:00.000Z',
  },
  {
    id: 'dev-002',
    name: 'Máy in Trạm Pha chế Bar',
    type: 'KITCHEN',
    paperSize: '76mm',
    isActive: true,
    isDefault: false,
    status: 'READY',
    isOnline: true,
    lastSeenAt: '2026-10-02T08:50:00.000Z',
    lastError: null,
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-10-02T08:50:00.000Z',
  },
  {
    id: 'dev-003',
    name: 'Máy in Bếp Nóng',
    type: 'KITCHEN',
    paperSize: '80mm',
    isActive: true,
    isDefault: false,
    status: 'ERROR',
    isOnline: false,
    lastSeenAt: '2026-10-01T15:00:00.000Z',
    lastError: 'Kẹt giấy máy in (Paper jam detected)',
    createdAt: '2026-09-21T00:00:00.000Z',
    updatedAt: '2026-10-01T15:00:00.000Z',
  },
]

const mockJobs = [
  {
    id: 'job-001',
    type: 'RECEIPT',
    status: 'PRINTED',
    copies: 1,
    attempts: 1,
    maxAttempts: 3,
    availableAt: '2026-10-02T09:10:00.000Z',
    leaseExpiresAt: null,
    printedAt: '2026-10-02T09:10:02.000Z',
    failedAt: null,
    lastError: null,
    createdAt: '2026-10-02T09:10:00.000Z',
    updatedAt: '2026-10-02T09:10:02.000Z',
    deviceId: 'dev-001',
    device: { id: 'dev-001', name: 'Máy in Quầy Thu ngân 1', type: 'RECEIPT' },
    requestedById: employee.id,
    requestedBy: { id: employee.id, fullName: employee.fullName },
    invoiceId: 'inv-1001',
    kitchenTicketId: null,
    reprintOfId: null,
  },
  {
    id: 'job-002',
    type: 'KITCHEN_TICKET',
    status: 'FAILED',
    copies: 1,
    attempts: 3,
    maxAttempts: 3,
    availableAt: '2026-10-02T09:15:00.000Z',
    leaseExpiresAt: null,
    printedAt: null,
    failedAt: '2026-10-02T09:15:30.000Z',
    lastError: 'Không thể kết nối đến cổng in mạng 192.168.1.150:9100',
    createdAt: '2026-10-02T09:15:00.000Z',
    updatedAt: '2026-10-02T09:15:30.000Z',
    deviceId: 'dev-003',
    device: { id: 'dev-003', name: 'Máy in Bếp Nóng', type: 'KITCHEN' },
    requestedById: employee.id,
    requestedBy: { id: employee.id, fullName: employee.fullName },
    invoiceId: null,
    kitchenTicketId: 'tick-2001',
    reprintOfId: null,
  },
]

test.describe('Printing & Print Jobs Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: envelope(employee) }))
    await page.route('**/api/v1/auth/me/permissions', (route) =>
      route.fulfill({ json: envelope(authorization) }),
    )

    // Mock Print Devices API
    await page.route('**/api/v1/printing/devices**', (route) => {
      const req = route.request()
      const method = req.method()
      const url = req.url()

      if (url.includes('/rotate-key')) {
        return route.fulfill({
          json: envelope({
            printDeviceId: 'dev-001',
            apiKey: 'mock-rotated-api-key-xyz-789',
          }),
        })
      }

      if (method === 'POST') {
        const body = req.postDataJSON()
        const newDevice = {
          id: 'dev-new-999',
          name: body.name || 'Máy in Mới',
          type: body.type || 'RECEIPT',
          paperSize: body.paperSize || '80mm',
          isActive: true,
          isDefault: !!body.isDefault,
          status: 'READY',
          isOnline: false,
          lastSeenAt: null,
          lastError: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        return route.fulfill({
          json: envelope({
            device: newDevice,
            apiKey: 'mock-agent-key-alpha-123456',
          }),
        })
      }

      if (method === 'PATCH') {
        const body = req.postDataJSON()
        return route.fulfill({
          json: envelope({
            ...mockDevices[0],
            ...body,
          }),
        })
      }

      if (method === 'DELETE') {
        return route.fulfill({ json: envelope({ success: true }) })
      }

      // GET devices
      return route.fulfill({
        json: envelope({
          list: mockDevices,
          totalPages: 1,
          totalItems: mockDevices.length,
          currentPage: 1,
        }),
      })
    })

    // Mock Print Jobs API
    await page.route('**/api/v1/printing/jobs**', (route) => {
      const req = route.request()
      const method = req.method()
      const url = req.url()

      if (url.includes('/retry')) {
        return route.fulfill({
          json: envelope({
            ...mockJobs[1],
            status: 'PENDING',
            attempts: 0,
            lastError: null,
          }),
        })
      }

      if (method === 'GET') {
        return route.fulfill({
          json: envelope({
            list: mockJobs,
            totalPages: 1,
            totalItems: mockJobs.length,
            currentPage: 1,
          }),
        })
      }

      return route.continue()
    })

    // Mock Reprint API
    await page.route('**/api/v1/printing/invoices/*/reprint', (route) => {
      return route.fulfill({
        json: envelope({
          id: 'job-reprint-888',
          type: 'RECEIPT',
          status: 'PENDING',
          copies: 1,
          attempts: 0,
          maxAttempts: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deviceId: 'dev-001',
          requestedById: employee.id,
          invoiceId: 'inv-1001',
          reprintOfId: 'job-001',
        }),
      })
    })
  })

  test('staff layout displays printing nav item and loads printing management page', async ({
    page,
  }) => {
    await page.goto('/staff/printing')
    await expect(page.getByRole('heading', { name: /Quản trị Thiết bị In & Lệnh In/i })).toBeVisible()
    await expect(page.getByText('Hardware Infrastructure')).toBeVisible()
    await expect(page.getByRole('link', { name: /Máy in & Lệnh in/i }).first()).toBeVisible()
  })

  test('renders top KPI cards and print devices list', async ({ page }) => {
    await page.goto('/staff/printing')

    // KPI cards
    await expect(page.getByText('Tổng thiết bị in')).toBeVisible()
    await expect(page.getByText('Máy in Hóa đơn', { exact: true })).toBeVisible()
    await expect(page.getByText('Máy in Bếp & Bar')).toBeVisible()
    await expect(page.getByText('Lệnh in cần chú ý')).toBeVisible()

    // Devices
    await expect(page.getByRole('heading', { name: 'Máy in Quầy Thu ngân 1' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Máy in Trạm Pha chế Bar' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Máy in Bếp Nóng' })).toBeVisible()

    // Status badges
    await expect(page.getByText('Sẵn sàng').first()).toBeVisible()
    await expect(page.getByText('Báo lỗi')).toBeVisible()
    await expect(page.getByText('Kẹt giấy máy in (Paper jam detected)')).toBeVisible()
  })

  test('filters devices by search keyword and type', async ({ page }) => {
    await page.goto('/staff/printing')

    const searchInput = page.getByPlaceholder(/Tìm theo tên máy in/i)
    await searchInput.fill('Bếp Nóng')

    await expect(page.getByRole('heading', { name: 'Máy in Bếp Nóng' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Máy in Quầy Thu ngân 1' })).not.toBeVisible()

    await searchInput.clear()
    await expect(page.getByRole('heading', { name: 'Máy in Quầy Thu ngân 1' })).toBeVisible()
  })

  test('creates a new print device and views generated API key', async ({ page }) => {
    await page.goto('/staff/printing')

    // Click "Thêm máy in"
    await page.getByRole('button', { name: /Thêm máy in/i }).click()

    const createDialog = page.getByRole('dialog')
    await expect(createDialog).toBeVisible()
    await expect(createDialog.getByText('Thêm Máy in Mới')).toBeVisible()

    // Fill form
    await createDialog.getByLabel(/Tên máy in/i).fill('Máy in Quầy 2')
    await createDialog.getByRole('button', { name: /Tạo máy in/i }).click()

    // API Key dialog should appear
    await expect(page.getByText('Khóa xác thực Print Agent')).toBeVisible()
    await expect(page.getByText('mock-agent-key-alpha-123456')).toBeVisible()

    // Click dismiss button
    await page.getByRole('button', { name: /Tôi đã lưu API Key/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('switches to Print Jobs tab and retries a failed job', async ({ page }) => {
    await page.goto('/staff/printing')

    // Click "Hàng đợi Lệnh in" tab
    await page.getByRole('button', { name: /Hàng đợi Lệnh in/i }).click()

    // Check table rows
    await expect(page.getByText('job-001')).toBeVisible()
    await expect(page.getByText('job-002')).toBeVisible()
    await expect(page.getByText('Đã in', { exact: true })).toBeVisible()
    await expect(page.getByText('Thất bại', { exact: true })).toBeVisible()

    // Click "Thử lại" on failed job
    const retryBtn = page.getByRole('button', { name: /Thử lại/i }).first()
    await retryBtn.click({ force: true })

    const retryDialog = page.getByRole('dialog')
    await expect(retryDialog).toBeVisible()
    await expect(retryDialog.getByText('Thử lại Lệnh in')).toBeVisible()

    await retryDialog.getByRole('button', { name: /Thực hiện lại/i }).click()
    await expect(retryDialog).not.toBeVisible()
  })

  test('switches to Reprint Receipt tab and submits reprint request', async ({ page }) => {
    await page.goto('/staff/printing')

    // Click "In lại Hóa đơn" tab
    await page.getByRole('button', { name: /In lại Hóa đơn/i }).click()

    await expect(page.getByText('Gửi yêu cầu In lại Hóa đơn')).toBeVisible()

    // Fill form
    await page.getByLabel(/Mã Hóa đơn/i).fill('inv-1001')
    await page.getByLabel(/Lý do in lại/i).fill('Khách xin thêm phiếu tính tiền')

    // Submit
    await page.getByRole('button', { name: /Gửi lệnh in lại hóa đơn/i }).click()

    // Expect success message
    await expect(page.getByText(/Đã tạo lệnh in lại thành công/i)).toBeVisible()
  })
})
