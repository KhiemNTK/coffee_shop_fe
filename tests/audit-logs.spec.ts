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
  permissionKeys: ['/audit-logs_read'],
}

const mockAuditLogs = [
  {
    id: 'log-001',
    actionType: 'PROMOTION_CREATED',
    createdAt: '2026-10-02T10:15:00.000Z',
    requestId: 'req-alpha-001',
    details: {
      promotionId: 'pro-001',
      code: 'SUMMER2026',
      discountPercent: 15,
      maxDiscountAmount: 50000,
    },
    employee: { id: employee.id, fullName: employee.fullName },
  },
  {
    id: 'log-002',
    actionType: 'SYSTEM_SETTING_UPDATED',
    createdAt: '2026-10-02T09:30:00.000Z',
    requestId: 'req-beta-002',
    details: {
      key: 'pos.allow_guest_order',
      oldValue: false,
      newValue: true,
      reason: 'Bật đặt món tại bàn giờ cao điểm',
    },
    employee: { id: employee.id, fullName: employee.fullName },
  },
  {
    id: 'log-003',
    actionType: 'ORDER_CHECKOUT',
    createdAt: '2026-10-01T16:45:00.000Z',
    requestId: null,
    details: {
      orderId: 'ord-9921',
      totalAmount: 185000,
      paymentMethod: 'CASH',
      itemsCount: 3,
    },
    employee: { id: '10000000-0000-4000-8000-000000000002', fullName: 'Thu ngân Ca Sáng' },
  },
  {
    id: 'log-004',
    actionType: 'EQUIPMENT_STATUS_CHANGED',
    createdAt: '2026-09-28T14:00:00.000Z',
    requestId: 'req-gamma-004',
    details: {
      equipmentId: 'eq-001',
      fromStatus: 'IN_USE',
      toStatus: 'MAINTENANCE',
      cost: 200000,
    },
    employee: { id: employee.id, fullName: employee.fullName },
  },
]

test.describe('Audit Logs & System Trail Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: envelope(employee) }))
    await page.route('**/api/v1/auth/me/permissions', (route) =>
      route.fulfill({ json: envelope(authorization) }),
    )

    await page.route('**/api/v1/audit-logs**', (route) => {
      const url = new URL(route.request().url())
      const actionType = url.searchParams.get('actionType')

      let filtered = [...mockAuditLogs]
      if (actionType) {
        filtered = filtered.filter((log) =>
          log.actionType.toLowerCase().includes(actionType.toLowerCase()),
        )
      }

      return route.fulfill({
        json: envelope({
          list: filtered,
          totalPages: 1,
          totalItems: filtered.length,
          currentPage: 1,
        }),
      })
    })
  })

  test('staff layout displays audit logs navigation item for authorized staff', async ({ page }) => {
    await page.goto('/staff/audit-logs')
    await expect(page.getByRole('heading', { name: /Nhật ký Kiểm toán & Truy vết/i })).toBeVisible()
    await expect(page.getByText('Security Audit')).toBeVisible()
    await expect(page.getByRole('link', { name: /Nhật ký kiểm toán/i }).first()).toBeVisible()
  })

  test('renders KPI cards and audit log entries correctly', async ({ page }) => {
    await page.goto('/staff/audit-logs')

    // KPI cards
    await expect(page.getByText('Tổng lượt ghi nhận')).toBeVisible()
    await expect(page.getByText('Trong trang hiện tại')).toBeVisible()
    await expect(page.getByText('Bảo mật & Cấu hình')).toBeVisible()
    await expect(page.getByText('Nghiệp vụ vận hành')).toBeVisible()

    // Table rows
    await expect(page.getByText('PROMOTION_CREATED')).toBeVisible()
    await expect(page.getByText('SYSTEM_SETTING_UPDATED')).toBeVisible()
    await expect(page.getByText('ORDER_CHECKOUT')).toBeVisible()
    await expect(page.getByText('EQUIPMENT_STATUS_CHANGED')).toBeVisible()

    // Staff names
    await expect(page.getByText('Quản trị viên Hệ thống').first()).toBeVisible()
    await expect(page.getByText('Thu ngân Ca Sáng')).toBeVisible()

    // Request IDs
    await expect(page.getByText('req-alpha-001')).toBeVisible()
  })

  test('filters audit logs using preset dropdown and keyword search', async ({ page }) => {
    await page.goto('/staff/audit-logs')

    // Filter by preset "Khuyến mãi & Giảm giá"
    const presetSelect = page.getByRole('combobox', { name: /Lọc nhóm hành động/i })
    await presetSelect.selectOption('PROMOTION')

    await expect(page.getByText('PROMOTION_CREATED')).toBeVisible()
    await expect(page.getByText('ORDER_CHECKOUT')).not.toBeVisible()

    // Reset to all
    await presetSelect.selectOption('ALL')
    await expect(page.getByText('ORDER_CHECKOUT')).toBeVisible()

    // Filter using search keyword
    const searchInput = page.getByPlaceholder(/Tìm theo loại hành động/i)
    await searchInput.fill('SYSTEM_SETTING')

    await expect(page.getByText('SYSTEM_SETTING_UPDATED')).toBeVisible()
    await expect(page.getByText('PROMOTION_CREATED')).not.toBeVisible()
  })

  test('opens audit log detail dialog and views formatted payload', async ({ page }) => {
    await page.goto('/staff/audit-logs')

    // Click "Chi tiết" for the first log (PROMOTION_CREATED)
    const detailButtons = page.getByRole('button', { name: /Chi tiết/i })
    await detailButtons.first().click({ force: true })

    // Dialog should be visible
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Chi tiết Nhật ký Kiểm toán')).toBeVisible()
    await expect(dialog.getByText('PROMOTION_CREATED')).toBeVisible()
    await expect(dialog.getByText('SUMMER2026')).toBeVisible()
    await expect(dialog.getByText('req-alpha-001')).toBeVisible()

    // Close dialog
    await dialog.getByLabel('Đóng').click({ force: true })
    await expect(dialog).not.toBeVisible()
  })

  test('shows empty state when no audit logs match query', async ({ page }) => {
    await page.goto('/staff/audit-logs')

    const searchInput = page.getByPlaceholder(/Tìm theo loại hành động/i)
    await searchInput.fill('NON_EXISTENT_ACTION_XYZ')

    await expect(page.getByText('Không tìm thấy nhật ký kiểm toán nào')).toBeVisible()
    await expect(page.getByRole('button', { name: /Đặt lại bộ lọc/i })).toBeVisible()

    // Click reset filter button
    await page.getByRole('button', { name: /Đặt lại bộ lọc/i }).click()
    await expect(page.getByText('PROMOTION_CREATED')).toBeVisible()
  })
})
