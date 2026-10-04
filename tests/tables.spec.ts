import { expect, test } from '@playwright/test'
import { envelope } from './helpers.js'

const employee = {
  id: '10000000-0000-4000-8000-000000000001',
  email: 'manager@example.test',
  username: 'manager',
  fullName: 'Phạm Minh Đức',
  isActive: true,
  position: { id: '20000000-0000-4000-8000-000000000002', name: 'Quản lý' },
}

const authorization = {
  employeeId: employee.id,
  employeeEmail: employee.email,
  roleNames: ['MANAGER'],
  permissionKeys: [
    '/dining-tables_read',
    '/dining-tables_create',
    '/dining-tables_update',
    '/dining-tables_delete',
    '/orders_tables_clear',
    '/orders_tables_transfer',
    '/orders_sessions_read',
    '/orders_sessions_create',
  ],
}

const mockTables = [
  {
    id: '80000000-0000-4000-8000-000000000001',
    name: 'Bàn 01',
    status: 'EMPTY',
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    orderSessions: [],
  },
  {
    id: '80000000-0000-4000-8000-000000000002',
    name: 'Bàn 02 (VIP)',
    status: 'OCCUPIED',
    createdAt: '2026-10-01T08:10:00.000Z',
    updatedAt: '2026-10-01T08:10:00.000Z',
    orderSessions: [
      {
        id: '90000000-0000-4000-8000-000000000001',
        sessionStatus: 'ACTIVE',
        guestCount: 4,
        createdAt: '2026-10-01T09:00:00.000Z',
        orderItems: [
          { id: 'item-1', quantity: 2, serveStatus: 'COOKING' },
          { id: 'item-2', quantity: 2, serveStatus: 'READY' },
        ],
      },
    ],
  },
  {
    id: '80000000-0000-4000-8000-000000000003',
    name: 'Bàn 03',
    status: 'RESERVED',
    createdAt: '2026-10-01T08:20:00.000Z',
    updatedAt: '2026-10-01T08:20:00.000Z',
    orderSessions: [],
  },
]

test.describe('Staff Dining Tables Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: envelope(employee) }))
    await page.route('**/api/v1/auth/me/permissions', (route) =>
      route.fulfill({ json: envelope(authorization) }),
    )
  })

  test('loads dining tables layout with KPI metrics and cards', async ({ page }) => {
    await page.route('**/api/v1/dining-tables', (route) =>
      route.fulfill({ json: envelope(mockTables) }),
    )

    await page.goto('/staff/tables')

    await expect(page.getByRole('heading', { name: 'Sơ đồ & Quản lý Bàn ăn' })).toBeVisible()
    await expect(page.getByText('Bàn trong quán')).toBeVisible()

    // Metric numbers
    await expect(page.getByText('3', { exact: true })).toBeVisible() // Total 3
    await expect(page.getByText('Bàn 01')).toBeVisible()
    await expect(page.getByText('Bàn 02 (VIP)')).toBeVisible()
    await expect(page.getByText('Bàn 03')).toBeVisible()

    // Occupied session details
    await expect(page.getByText('4 người')).toBeVisible()
    await expect(page.getByText('2 món')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Vào đơn POS' })).toBeVisible()
  })

  test('filters tables by status and search text', async ({ page }) => {
    await page.route('**/api/v1/dining-tables', (route) =>
      route.fulfill({ json: envelope(mockTables) }),
    )

    await page.goto('/staff/tables')

    // Filter by EMPTY
    await page.getByRole('button', { name: 'Trống' }).click()
    await expect(page.getByText('Bàn 01')).toBeVisible()
    await expect(page.getByText('Bàn 02 (VIP)')).not.toBeVisible()

    // Filter by OCCUPIED
    await page.getByRole('button', { name: 'Có khách' }).click()
    await expect(page.getByText('Bàn 02 (VIP)')).toBeVisible()
    await expect(page.getByText('Bàn 01')).not.toBeVisible()

    // Filter ALL
    await page.getByRole('button', { name: 'Tất cả' }).click()
    await expect(page.getByText('Bàn 01')).toBeVisible()
    await expect(page.getByText('Bàn 02 (VIP)')).toBeVisible()

    // Search by text
    await page.getByPlaceholder(/Tìm kiếm bàn theo tên/).fill('VIP')
    await expect(page.getByText('Bàn 02 (VIP)')).toBeVisible()
    await expect(page.getByText('Bàn 01')).not.toBeVisible()
  })

  test('creates a new dining table', async ({ page }) => {
    let currentTables = [...mockTables]

    await page.route('**/api/v1/dining-tables', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ json: envelope(currentTables) })
      }
      if (route.request().method() === 'POST') {
        const payload = route.request().postDataJSON()
        const newTable = {
          id: '80000000-0000-4000-8000-000000000009',
          name: payload.name,
          status: 'EMPTY',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          orderSessions: [],
        }
        currentTables = [...currentTables, newTable]
        return route.fulfill({ json: envelope(newTable) })
      }
      return route.fallback()
    })

    await page.goto('/staff/tables')

    await page.getByRole('button', { name: 'Thêm bàn mới' }).click()
    await expect(page.getByRole('heading', { name: 'Thêm bàn ăn mới' })).toBeVisible()

    await page.getByPlaceholder(/Nhập tên bàn/).fill('Bàn Ngoài Sân 04')
    await page.getByRole('button', { name: 'Lưu bàn mới' }).click()

    await expect(page.getByText('Đã tạo bàn "Bàn Ngoài Sân 04" thành công')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Bàn Ngoài Sân 04' })).toBeVisible()
  })

  test('renames and deletes an empty table', async ({ page }) => {
    let currentTables = [...mockTables]

    await page.route('**/api/v1/dining-tables/**', (route) => {
      if (route.request().method() === 'PATCH') {
        const payload = route.request().postDataJSON()
        const first = currentTables[0]
        if (!first) return route.fallback()
        const updated = {
          ...first,
          name: String(payload.name),
        }
        currentTables = [updated, ...currentTables.slice(1)]
        return route.fulfill({ json: envelope(updated) })
      }
      if (route.request().method() === 'DELETE') {
        currentTables = currentTables.slice(1)
        return route.fulfill({ json: envelope({ success: true, message: 'Deleted' }) })
      }
      return route.fallback()
    })

    await page.route('**/api/v1/dining-tables', (route) => {
      return route.fulfill({ json: envelope(currentTables) })
    })

    await page.goto('/staff/tables')

    // Click edit on first table
    await page.getByTitle('Đổi tên bàn').first().click()
    await expect(page.getByRole('heading', { name: 'Đổi tên bàn ăn' })).toBeVisible()

    const input = page.locator('input[value="Bàn 01"]')
    await input.fill('Bàn 01 - Cửa sổ')
    await page.getByRole('button', { name: 'Cập nhật' }).click()

    await expect(page.getByText('Đã cập nhật tên bàn thành "Bàn 01 - Cửa sổ"')).toBeVisible()

    // Click delete on empty table
    await page.getByTitle('Xóa bàn').first().click()
    await expect(page.getByRole('heading', { name: 'Xác nhận xóa bàn' })).toBeVisible()
    await page.getByRole('button', { name: 'Xác nhận xóa' }).click()

    await expect(page.getByText('Đã xóa bàn thành công')).toBeVisible()
  })

  test('clears and transfers occupied table', async ({ page }) => {
    let currentTables = [...mockTables]

    await page.route('**/api/v1/orders/tables/**/clear', (route) => {
      const t0 = currentTables[0]
      const t1 = currentTables[1]
      const t2 = currentTables[2]
      if (!t0 || !t1 || !t2) return route.fallback()
      const updated = {
        ...t1,
        status: 'EMPTY',
        orderSessions: [],
      }
      currentTables = [t0, updated, t2]
      return route.fulfill({
        json: envelope({ success: true, message: 'Table cleared and session cancelled.' }),
      })
    })

    await page.route('**/api/v1/orders/sessions/transfer-table', (route) => {
      return route.fulfill({
        json: envelope({ success: true, message: 'Table transferred successfully.' }),
      })
    })

    await page.route('**/api/v1/dining-tables', (route) => {
      return route.fulfill({ json: envelope(currentTables) })
    })

    await page.goto('/staff/tables')

    // Transfer modal
    await page.getByTitle('Chuyển bàn sang bàn khác').click()
    await expect(page.getByRole('heading', { name: 'Chuyển bàn phục vụ' })).toBeVisible()
    await page.getByLabel('Chọn bàn đích').selectOption({ label: 'Bàn 01' })
    await page.getByRole('button', { name: 'Xác nhận chuyển' }).click()
    await expect(page.getByText('Đã chuyển bàn thành công')).toBeVisible()

    // Clear modal
    await page.getByTitle('Dọn / Giải phóng bàn').first().click()
    await expect(page.getByRole('heading', { name: 'Dọn dẹp & Giải phóng bàn' })).toBeVisible()
    await page.getByRole('button', { name: 'Xác nhận dọn bàn' }).click()
    await expect(page.getByText('Đã dọn bàn và giải phóng trạng thái thành công')).toBeVisible()
  })

  test('switches to table list view and back to grid', async ({ page }) => {
    await page.route('**/api/v1/dining-tables', (route) =>
      route.fulfill({ json: envelope(mockTables) }),
    )

    await page.goto('/staff/tables')

    // Switch to table view
    await page.getByTitle('Chế độ bảng danh sách').click()
    await expect(page.getByRole('cell', { name: 'Bàn 01' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Bàn 02 (VIP)' })).toBeVisible()

    // Switch back to grid view
    await page.getByTitle('Chế độ thẻ lưới').click({ force: true })
    await expect(page.getByRole('heading', { name: 'Bàn 01' })).toBeVisible()
  })
})
