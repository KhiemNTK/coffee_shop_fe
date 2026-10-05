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
    '/equipment_read',
    '/equipment_create',
    '/equipment_update',
    '/equipment_transition',
    '/system-settings_read',
    '/system-settings_create',
    '/system-settings_update',
    '/system-settings_delete',
    '/management-exceptions_read',
  ],
}

const mockEquipment = [
  {
    id: 'eq-001',
    assetCode: 'EQ-ESPRESSO-01',
    serialNumber: 'SN-LM-9921',
    name: 'Máy Pha Cà Phê La Marzocco',
    status: 'IN_USE',
    quantity: 1,
    unitPrice: '120000000',
    totalAmount: '120000000',
    purchaseDate: '2026-01-15T00:00:00.000Z',
    warrantyExpiresAt: '2028-01-15T00:00:00.000Z',
    nextMaintenanceAt: '2026-11-01T00:00:00.000Z',
    location: 'Quầy Bar chính',
    notes: 'Bảo trì định kỳ mỗi 6 tháng',
    employee: { id: employee.id, fullName: employee.fullName },
    _count: { lifecycleEvents: 2 },
  },
  {
    id: 'eq-002',
    assetCode: 'EQ-GRINDER-01',
    serialNumber: 'SN-MK-4412',
    name: 'Máy Xay Cà Phê Mahlkonig',
    status: 'MAINTENANCE',
    quantity: 2,
    unitPrice: '35000000',
    totalAmount: '70000000',
    purchaseDate: '2026-02-10T00:00:00.000Z',
    warrantyExpiresAt: '2027-02-10T00:00:00.000Z',
    nextMaintenanceAt: '2026-10-15T00:00:00.000Z',
    location: 'Quầy Bar 1',
    notes: 'Đang gửi cân chỉnh đĩa xay',
    employee: { id: employee.id, fullName: employee.fullName },
    _count: { lifecycleEvents: 1 },
  },
  {
    id: 'eq-003',
    assetCode: 'EQ-BLENDER-01',
    serialNumber: 'SN-VM-1102',
    name: 'Máy Xay Sinh Tố Vitamix',
    status: 'BROKEN',
    quantity: 1,
    unitPrice: '25000000',
    totalAmount: '25000000',
    purchaseDate: '2026-03-01T00:00:00.000Z',
    warrantyExpiresAt: '2027-03-01T00:00:00.000Z',
    nextMaintenanceAt: null,
    location: 'Khu pha chế',
    notes: 'Hỏng cối xay',
    employee: { id: employee.id, fullName: employee.fullName },
    _count: { lifecycleEvents: 0 },
  },
]

const mockEquipmentEvents = [
  {
    id: 'ev-001',
    equipmentId: 'eq-001',
    fromStatus: 'MAINTENANCE',
    toStatus: 'IN_USE',
    reason: 'Thay gioăng cao su và vệ sinh van áp suất',
    cost: '500000',
    occurredAt: '2026-05-10T09:00:00.000Z',
    employee: { id: employee.id, fullName: employee.fullName },
  },
]

const mockSettings = [
  {
    id: 'set-001',
    key: 'store.vat_rate',
    value: 0.08,
    valueType: 'NUMBER',
    description: 'Thuế suất GTGT áp dụng cho hóa đơn',
    isPublic: true,
    version: 1,
    updatedBy: { id: employee.id, fullName: employee.fullName },
    updatedAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'set-002',
    key: 'store.name',
    value: 'The Coffee Sanctuary',
    valueType: 'STRING',
    description: 'Tên quán hiển thị trên hóa đơn và web',
    isPublic: true,
    version: 2,
    updatedBy: { id: employee.id, fullName: employee.fullName },
    updatedAt: '2026-10-01T09:00:00.000Z',
  },
  {
    id: 'set-003',
    key: 'pos.allow_guest_order',
    value: true,
    valueType: 'BOOLEAN',
    description: 'Cho phép khách tự đặt món qua QR tại bàn',
    isPublic: false,
    version: 1,
    updatedBy: { id: employee.id, fullName: employee.fullName },
    updatedAt: '2026-10-01T10:00:00.000Z',
  },
]

const mockSettingRevisions = [
  {
    id: 'rev-001',
    settingId: 'set-002',
    version: 1,
    value: 'Coffee Corner Old',
    valueType: 'STRING',
    description: 'Tên quán ban đầu',
    isPublic: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    employee: { id: employee.id, fullName: employee.fullName },
  },
]

const mockExceptionsSummary = {
  counts: {
    PAYMENT: 1,
    CASH_EXPENSE: 1,
    CASH_HANDOVER: 0,
    FEEDBACK: 2,
  },
  total: 4,
}

const mockExceptionsPaymentList = [
  {
    id: 'exc-pay-01',
    type: 'WEBHOOK_TIMEOUT',
    title: 'Lệch tiền cổng PayOS - Mã đơn #ORD-8821',
    status: 'OPEN',
    detectedAt: '2026-10-01T14:30:00.000Z',
    paymentAttemptId: 'att-123',
    paymentRefundId: null,
  },
]

const mockExceptionsFeedbackList = [
  {
    id: 'exc-fb-01',
    rating: 1,
    comment: 'Cà phê bị nguội khi giao tới nơi',
    createdAt: '2026-10-01T16:00:00.000Z',
    invoiceId: 'inv-441',
  },
  {
    id: 'exc-fb-02',
    rating: 2,
    comment: 'Đóng gói bị đổ ra ngoài ly',
    createdAt: '2026-10-01T17:15:00.000Z',
    invoiceId: 'inv-442',
  },
]

test.describe('Settings, Equipment and Exceptions Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/auth/me', (route) =>
      route.fulfill({ json: envelope(employee) }),
    )
    await page.route('**/api/v1/auth/me/permissions', (route) =>
      route.fulfill({ json: envelope(authorization) }),
    )

    // Setup Equipment mock
    await page.route('**/api/v1/equipment**', (route) => {
      const req = route.request()
      const url = req.url()

      if (url.includes('/events')) {
        return route.fulfill({
          json: envelope({
            list: mockEquipmentEvents,
            totalPages: 1,
            totalItems: mockEquipmentEvents.length,
            currentPage: 1,
          }),
        })
      }

      if (url.includes('/transitions')) {
        return route.fulfill({
          json: envelope({
            equipment: {
              ...mockEquipment[0],
              status: 'MAINTENANCE',
            },
            event: {
              id: 'ev-new',
              equipmentId: 'eq-001',
              fromStatus: 'IN_USE',
              toStatus: 'MAINTENANCE',
              reason: 'Bảo trì khẩn cấp',
              cost: '200000',
              occurredAt: new Date().toISOString(),
            },
          }),
        })
      }

      if (req.method() === 'POST') {
        const body = req.postDataJSON()
        return route.fulfill({
          json: envelope({
            id: 'eq-new',
            assetCode: body.assetCode || 'EQ-NEW-01',
            name: body.name || 'Thiết bị mới',
            status: 'IN_USE',
            quantity: body.quantity || 1,
            unitPrice: body.unitPrice || '10000000',
            totalAmount: body.unitPrice || '10000000',
            purchaseDate: body.purchaseDate || '2026-10-01T00:00:00.000Z',
            location: body.location || 'Quầy Bar',
            notes: body.notes || '',
          }),
        })
      }

      if (req.method() === 'PATCH') {
        const body = req.postDataJSON()
        const target = mockEquipment[0]!
        return route.fulfill({
          json: envelope({
            ...target,
            name: body.name || target.name,
            location: body.location || target.location,
          }),
        })
      }

      return route.fulfill({
        json: envelope({
          list: mockEquipment,
          totalPages: 1,
          totalItems: mockEquipment.length,
          currentPage: 1,
        }),
      })
    })

    // Setup System Settings mock
    await page.route('**/api/v1/system-settings**', (route) => {
      const req = route.request()
      const url = req.url()

      if (url.includes('/revisions')) {
        return route.fulfill({
          json: envelope({
            list: mockSettingRevisions,
            totalPages: 1,
            totalItems: mockSettingRevisions.length,
            currentPage: 1,
          }),
        })
      }

      if (req.method() === 'POST') {
        const body = req.postDataJSON()
        return route.fulfill({
          json: envelope({
            id: 'set-new',
            key: body.key,
            value: body.value,
            valueType: body.valueType,
            description: body.description,
            isPublic: body.isPublic || false,
            version: 1,
          }),
        })
      }

      if (req.method() === 'PATCH') {
        const body = req.postDataJSON()
        const defaultSetting = mockSettings[0]!
        const settingKey =
          url.split('/system-settings/')[1]?.split('?')[0] || defaultSetting.key
        const existing =
          mockSettings.find((s) => s.key === settingKey) || defaultSetting
        return route.fulfill({
          json: envelope({
            ...existing,
            value: body.value !== undefined ? body.value : existing.value,
            description:
              body.description !== undefined
                ? body.description
                : existing.description,
            version: existing.version + 1,
          }),
        })
      }

      if (req.method() === 'DELETE') {
        return route.fulfill({
          json: envelope({
            success: true,
            key: 'store.vat_rate',
            version: 2,
          }),
        })
      }

      return route.fulfill({
        json: envelope({
          list: mockSettings,
          totalPages: 1,
          totalItems: mockSettings.length,
          currentPage: 1,
        }),
      })
    })

    // Setup Exceptions mock
    await page.route('**/api/v1/management/exceptions**', (route) => {
      const url = route.request().url()
      if (url.includes('/summary')) {
        return route.fulfill({ json: envelope(mockExceptionsSummary) })
      }
      if (url.includes('kind=FEEDBACK')) {
        return route.fulfill({
          json: envelope({
            kind: 'FEEDBACK',
            list: mockExceptionsFeedbackList,
            totalPages: 1,
            totalItems: mockExceptionsFeedbackList.length,
            currentPage: 1,
          }),
        })
      }
      return route.fulfill({
        json: envelope({
          kind: 'PAYMENT',
          list: mockExceptionsPaymentList,
          totalPages: 1,
          totalItems: mockExceptionsPaymentList.length,
          currentPage: 1,
        }),
      })
    })
  })

  test('loads equipment list without treating page-local status counts as totals', async ({
    page,
  }) => {
    await page.goto('/staff/settings')

    // Page header
    await expect(
      page.getByRole('heading', { name: /Cài đặt & Thiết bị/ }),
    ).toBeVisible()

    await expect(page.getByText('Tổng thiết bị', { exact: true })).toHaveCount(
      0,
    )
    await expect(
      page.getByText('Hỏng / Thanh lý', { exact: true }),
    ).toHaveCount(0)

    // Equipment items in table
    await expect(page.getByText('Máy Pha Cà Phê La Marzocco')).toBeVisible()
    await expect(page.getByText('EQ-ESPRESSO-01')).toBeVisible()
    await expect(page.getByText('Máy Xay Cà Phê Mahlkonig')).toBeVisible()
    await expect(page.getByText('Máy Xay Sinh Tố Vitamix')).toBeVisible()
  })

  test('filters equipment by search keyword', async ({ page }) => {
    await page.goto('/staff/settings')

    const searchInput = page.getByPlaceholder(
      'Tìm theo tên thiết bị, mã tài sản, serial number...',
    )
    await searchInput.fill('Marzocco')

    await expect(searchInput).toHaveValue('Marzocco')
  })

  test('creates new equipment successfully', async ({ page }) => {
    await page.goto('/staff/settings')

    await page
      .getByRole('button', { name: 'Thêm thiết bị mới' })
      .click({ force: true })
    await expect(
      page.getByRole('heading', { name: /Thêm thiết bị/ }),
    ).toBeVisible()

    await page.locator('input[placeholder="VD: EQ-ESP-01"]').fill('EQ-WATER-01')
    await page
      .locator(
        'input[placeholder="VD: Máy pha cà phê La Marzocco Linea PB 2 Group"]',
      )
      .fill('Máy Lọc Nước Công Nghiệp')
    await page.locator('input[placeholder="250000000"]').fill('15000000')

    await page
      .getByRole('button', { name: 'Lưu thiết bị' })
      .click({ force: true })

    await expect(
      page.getByText('Đã thêm thiết bị "Máy Lọc Nước Công Nghiệp" thành công'),
    ).toBeVisible()
  })

  test('transitions equipment status to maintenance', async ({ page }) => {
    await page.goto('/staff/settings')

    // Click transition button for first item
    await page
      .getByTitle('Chuyển trạng thái thiết bị')
      .first()
      .click({ force: true })
    await expect(
      page.getByRole('heading', {
        name: /Chuyển trạng thái: Máy Pha Cà Phê La Marzocco/,
      }),
    ).toBeVisible()

    // Fill reason and submit
    await page
      .locator(
        'input[placeholder="VD: Thay gioăng cao su định kỳ, sửa bơm nước..."]',
      )
      .fill('Bảo trì khẩn cấp')
    await page
      .getByRole('button', { name: 'Xác nhận chuyển' })
      .click({ force: true })

    await expect(
      page.getByText(
        'Đã chuyển trạng thái thiết bị "Máy Pha Cà Phê La Marzocco" thành công',
      ),
    ).toBeVisible()
  })

  test('views equipment maintenance lifecycle history', async ({ page }) => {
    await page.goto('/staff/settings')

    await page
      .getByTitle('Xem lịch sử bảo trì & vòng đời')
      .first()
      .click({ force: true })
    await expect(
      page.getByRole('heading', {
        name: /Lịch sử.*Máy Pha Cà Phê La Marzocco/,
      }),
    ).toBeVisible()

    await expect(
      page.getByText('Thay gioăng cao su và vệ sinh van áp suất'),
    ).toBeVisible()
    await expect(page.getByText('Chi phí: 500.000 ₫')).toBeVisible()
  })

  test('switches to system settings tab and views settings list', async ({
    page,
  }) => {
    await page.goto('/staff/settings')

    // Switch tab
    await page
      .getByRole('button', { name: /Cấu hình Tham số Quán/ })
      .click({ force: true })

    await expect(page.getByText('store.vat_rate')).toBeVisible()
    await expect(page.getByText('store.name')).toBeVisible()
    await expect(page.getByText('pos.allow_guest_order')).toBeVisible()
  })

  test('edits a system setting successfully', async ({ page }) => {
    await page.goto('/staff/settings')

    await page
      .getByRole('button', { name: /Cấu hình Tham số Quán/ })
      .click({ force: true })

    // Click edit for store.name
    await page.getByTitle('Sửa giá trị cài đặt').nth(1).click({ force: true })
    await expect(
      page.getByRole('heading', { name: /Cập nhật cấu hình: store\.name/ }),
    ).toBeVisible()

    await page
      .getByRole('button', { name: 'Lưu thay đổi' })
      .click({ force: true })
    await expect(
      page.getByText('Đã cập nhật cấu hình "store.name" thành công'),
    ).toBeVisible()
  })

  test('switches to management exceptions tab and displays queue', async ({
    page,
  }) => {
    await page.goto('/staff/settings')

    // Switch tab
    await page
      .getByRole('button', { name: /Hàng đợi Ngoại lệ/ })
      .click({ force: true })

    await expect(page.getByText('Đối soát Cổng TT')).toBeVisible()
    await expect(
      page.getByText('Lệch tiền cổng PayOS - Mã đơn #ORD-8821'),
    ).toBeVisible()

    // Switch exception sub-kind to FEEDBACK
    await page.getByText('Khiếu nại khách').first().click()
    await expect(
      page.getByText('Cà phê bị nguội khi giao tới nơi').first(),
    ).toBeVisible()
    await expect(
      page.getByText('Đóng gói bị đổ ra ngoài ly').first(),
    ).toBeVisible()
  })
})
