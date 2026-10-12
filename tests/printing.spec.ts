import { expect, test } from '@playwright/test'
import { envelope } from './helpers.js'

const employee = {
  id: '10000000-0000-4000-8000-000000000001',
  email: 'admin@coffee.test',
  username: 'admin',
  fullName: 'Quản trị viên Hệ thống',
  isActive: true,
  position: {
    id: '20000000-0000-4000-8000-000000000001',
    name: 'Quản trị viên',
  },
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
    await page.route('**/api/v1/auth/me', (route) =>
      route.fulfill({ json: envelope(employee) }),
    )
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
      const params = new URL(url).searchParams
      const keyword = (params.get('keyword') ?? '').toLowerCase()
      const devices = mockDevices.filter(
        (device) =>
          (!keyword || device.name.toLowerCase().includes(keyword)) &&
          (!params.get('type') || device.type === params.get('type')) &&
          (!params.has('isActive') ||
            String(device.isActive) === params.get('isActive')),
      )
      return route.fulfill({
        json: envelope({
          list: devices,
          totalPages: 1,
          totalItems: devices.length,
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
          id: '70000000-0000-4000-8000-000000000001',
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
    await expect(
      page.getByRole('heading', { name: /Quản trị Thiết bị In & Lệnh In/i }),
    ).toBeVisible()
    await expect(page.getByText('Hardware Infrastructure')).toHaveCount(0)
    await expect(
      page.getByRole('link', { name: /Máy in & Lệnh in/i }).first(),
    ).toBeVisible()
  })

  test('renders print devices without claiming queue health from a partial list', async ({
    page,
  }) => {
    await page.goto('/staff/printing')

    await expect(page.getByText('Lệnh in cần chú ý')).toHaveCount(0)
    await expect(page.getByText('Hàng đợi ổn định')).toHaveCount(0)

    // Devices
    await expect(
      page.getByRole('heading', { name: 'Máy in Quầy Thu ngân 1' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Máy in Trạm Pha chế Bar' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Máy in Bếp Nóng' }),
    ).toBeVisible()

    // Status badges
    await expect(page.getByText('Sẵn sàng').first()).toBeVisible()
    await expect(page.getByText('Báo lỗi')).toBeVisible()
    await expect(
      page.getByText('Kẹt giấy máy in (Paper jam detected)'),
    ).toBeVisible()
  })

  test('filters devices by search keyword and type', async ({ page }) => {
    await page.goto('/staff/printing')

    const searchInput = page.getByPlaceholder(/Tìm theo tên máy in/i)
    await searchInput.fill('Bếp Nóng')

    await expect(
      page.getByRole('heading', { name: 'Máy in Bếp Nóng' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Máy in Quầy Thu ngân 1' }),
    ).not.toBeVisible()

    await searchInput.clear()
    await expect(
      page.getByRole('heading', { name: 'Máy in Quầy Thu ngân 1' }),
    ).toBeVisible()
  })

  test('creates a new print device and views generated API key', async ({
    page,
  }) => {
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

  test('switches to Print Jobs tab and retries a failed job', async ({
    page,
  }) => {
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

  test('reprint submits with Enter and announces success without mobile overflow', async ({
    page,
  }, info) => {
    await page.goto('/staff/printing')

    // Click "In lại Hóa đơn" tab
    await page.getByRole('button', { name: /In lại Hóa đơn/i }).click()

    await expect(page.getByText('Gửi yêu cầu In lại Hóa đơn')).toBeVisible()

    // Fill form
    await page.getByLabel(/Mã Hóa đơn/i).fill('inv-1001')
    await page
      .getByLabel(/Lý do in lại/i)
      .fill('Khách xin thêm phiếu tính tiền')

    // Submit
    await page.getByLabel(/Lý do in lại/i).press('Enter')

    // Expect success message
    await expect(page.getByRole('status')).toContainText('Đã tạo lệnh in lại trong hàng đợi')
    await expect(page.getByLabel(/Mã Hóa đơn/i)).toHaveValue('')
    await expect(page.getByLabel(/Lý do in lại/i)).toHaveValue('')
    await expect(page.locator('form svg:not([aria-hidden="true"])')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath('reprint-success.png'), fullPage: true })
  })

  test('reprint validates trimmed fields and the 500-character reason boundary', async ({ page }) => {
    const writes: Array<{ reason: string; copies: number }> = []
    await page.route('**/api/v1/printing/invoices/*/reprint', (route) => {
      writes.push(route.request().postDataJSON())
      return route.fulfill({ json: envelope({ ...mockJobs[0], status: 'PENDING' }) })
    })
    await page.goto('/staff/printing')
    await page.getByRole('button', { name: 'In lại Hóa đơn', exact: true }).click()
    const invoice = page.getByLabel(/Mã Hóa đơn/i)
    const reason = page.getByLabel(/Lý do in lại/i)
    const submit = page.getByRole('button', { name: 'Gửi lệnh in lại hóa đơn', exact: true })
    await expect(invoice).toHaveAttribute('required', '')
    await expect(reason).toHaveAttribute('required', '')
    await expect(reason).toHaveAttribute('minlength', '3')
    await expect(reason).toHaveAttribute('maxlength', '500')
    await invoice.fill('inv-1001')
    for (const value of ['   ', ' ab ']) {
      await reason.fill(value)
      await expect(submit).toBeDisabled()
      await page.locator('form').dispatchEvent('submit')
    }
    await reason.fill('Valid reason')
    await invoice.fill(' ')
    await expect(submit).toBeDisabled()
    await page.locator('form').dispatchEvent('submit')
    expect(writes).toHaveLength(0)
    await invoice.fill(' inv-1001 ')
    // Bypass native maxlength to exercise the submit guard as well as the input limit.
    await reason.evaluate((input: HTMLInputElement) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'r'.repeat(501))
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await expect(submit).toBeDisabled()
    await page.locator('form').dispatchEvent('submit')
    expect(writes).toHaveLength(0)
    await reason.fill('r'.repeat(500))
    await expect(submit).toBeEnabled()
    await reason.press('Enter')
    await expect(page.getByRole('status')).toBeVisible()
    expect(writes).toHaveLength(1)
    expect(writes[0]?.reason).toBe('r'.repeat(500))
  })

  test('reprint synchronously blocks two submits before pending state renders', async ({ page }) => {
    let writes = 0
    let release!: () => void
    const responseGate = new Promise<void>((resolve) => { release = resolve })
    await page.route('**/api/v1/printing/invoices/*/reprint', async (route) => {
      writes++
      await responseGate
      await route.fulfill({ json: envelope({ ...mockJobs[0], status: 'PENDING' }) })
    })
    await page.goto('/staff/printing')
    await page.getByRole('button', { name: 'In lại Hóa đơn', exact: true }).click()
    await page.getByLabel(/Mã Hóa đơn/i).fill('inv-1001')
    await page.getByLabel(/Lý do in lại/i).fill('Customer requested another copy')
    try {
      await page.locator('form').evaluate((form) => {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      })
      await expect.poll(() => writes).toBe(1)
      await expect(page.getByRole('button', { name: 'Gửi lệnh in lại hóa đơn', exact: true })).toBeDisabled()
      await expect(page.getByLabel(/Mã Hóa đơn/i)).toBeDisabled()
    } finally {
      release()
    }
    await expect(page.getByRole('status')).toBeVisible()
    expect(writes).toBe(1)
  })

  for (const outcome of ['network', 408, 429, 503, 'invalid-response'] as const) {
    test(`reprint retains exact command and key after ${outcome} and a rejected retry`, async ({ page }, info) => {
      const writes: Array<{ reason: string; copies: number; deviceId: string; idempotencyKey: string }> = []
      await page.route('**/api/v1/printing/invoices/*/reprint', (route) => {
        writes.push(route.request().postDataJSON())
        if (writes.length === 1) {
          if (outcome === 'network') return route.abort('failed')
          if (outcome === 'invalid-response') return route.fulfill({ json: envelope({ id: 'incomplete' }) })
          return route.fulfill({ status: outcome, json: { message: 'Unknown print outcome' } })
        }
        if (writes.length === 2) return route.fulfill({ status: 400, json: { message: 'Retry rejected' } })
        return route.fulfill({ json: envelope({ ...mockJobs[0], status: 'PENDING', copies: 2 }) })
      })
      await page.goto('/staff/printing')
      await page.getByRole('button', { name: 'In lại Hóa đơn', exact: true }).click()
      await page.getByLabel(/Mã Hóa đơn/i).fill(' inv-1001 ')
      await page.getByLabel(/Lý do in lại/i).fill(' Customer requested another copy ')
      await page.getByLabel('Số lượng bản in').selectOption('2')
      await expect(page.getByLabel('Máy in xuất hóa đơn').locator('option', { hasText: mockDevices[0]!.name })).toHaveCount(1)
      await page.getByLabel('Máy in xuất hóa đơn').selectOption('dev-001')
      await page.getByRole('button', { name: 'Gửi lệnh in lại hóa đơn', exact: true }).click()
      const retry = page.getByRole('button', { name: 'Gửi lại lệnh chưa xác nhận', exact: true })
      const pendingKeys = () => page.evaluate(() => Object.entries(sessionStorage)
        .filter(([key]) => key.startsWith('coffee-shop:pending:private:/printing/invoices/'))
        .map(([, key]) => key))
      await expect(page.getByRole('alert')).toBeVisible()
      await expect(retry).toBeEnabled()
      for (const label of [/Mã Hóa đơn/i, /Lý do in lại/i, 'Số lượng bản in', 'Máy in xuất hóa đơn']) {
        await expect(page.getByLabel(label)).toBeDisabled()
      }
      expect(writes).toHaveLength(1)
      expect(writes[0]).toMatchObject({ reason: 'Customer requested another copy', copies: 2, deviceId: 'dev-001' })
      expect(writes[0]?.idempotencyKey).toBeTruthy()
      expect(await pendingKeys()).toEqual([writes[0]?.idempotencyKey])
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: info.outputPath('reprint-unknown.png'), fullPage: true })
      await retry.click()
      await expect(page.getByRole('alert')).toHaveText('Retry rejected')
      await expect(retry).toBeEnabled()
      await expect(page.getByLabel(/Lý do in lại/i)).toBeDisabled()
      expect(writes).toHaveLength(2)
      expect(writes[1]).toEqual(writes[0])
      expect(await pendingKeys()).toEqual([writes[0]?.idempotencyKey])
      await retry.click()
      await expect(page.getByRole('status')).toBeVisible()
      await expect(page.getByRole('alert')).toHaveCount(0)
      await expect(page.getByLabel(/Mã Hóa đơn/i)).toBeEnabled()
      await expect(page.getByLabel(/Mã Hóa đơn/i)).toHaveValue('')
      expect(writes).toHaveLength(3)
      expect(writes[2]).toEqual(writes[0])
      expect(await pendingKeys()).toEqual([])
    })
  }

  test('reprint allows editing and a fresh command after a definitive first rejection', async ({ page }) => {
    const writes: Array<{ reason: string; idempotencyKey: string }> = []
    await page.route('**/api/v1/printing/invoices/*/reprint', (route) => {
      writes.push(route.request().postDataJSON())
      return writes.length === 1
        ? route.fulfill({ status: 400, json: { message: 'Reason rejected' } })
        : route.fulfill({ json: envelope({ ...mockJobs[0], status: 'PENDING' }) })
    })
    await page.goto('/staff/printing')
    await page.getByRole('button', { name: 'In lại Hóa đơn', exact: true }).click()
    await page.getByLabel(/Mã Hóa đơn/i).fill('inv-1001')
    const reason = page.getByLabel(/Lý do in lại/i)
    await reason.fill('First reason')
    await reason.press('Enter')
    await expect(page.getByRole('alert')).toHaveText('Reason rejected')
    await expect(reason).toBeEnabled()
    await expect(page.getByLabel(/Mã Hóa đơn/i)).toHaveValue('inv-1001')
    await expect(reason).toHaveValue('First reason')
    await reason.fill('Corrected reason')
    await reason.press('Enter')
    await expect(page.getByRole('status')).toBeVisible()
    expect(writes).toHaveLength(2)
    expect(writes[1]?.reason).toBe('Corrected reason')
    expect(writes[1]?.idempotencyKey).not.toBe(writes[0]?.idempotencyKey)
  })
})
