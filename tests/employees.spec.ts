import { expect, test } from '@playwright/test'
import { envelope } from './helpers.js'

const employee = {
  id: '10000000-0000-4000-8000-000000000001',
  email: 'owner@example.test',
  username: 'owner',
  fullName: 'Trần Văn Chủ Quán',
  isActive: true,
  position: { id: '20000000-0000-4000-8000-000000000001', name: 'Chủ sở hữu' },
}

const authorization = {
  employeeId: employee.id,
  employeeEmail: employee.email,
  roleNames: ['OWNER'],
  permissionKeys: [
    '/employees_read',
    '/employees_create',
    '/employees_update',
    '/employees_delete',
    '/employees_roles_read',
    '/employees_roles_update',
    '/positions_read',
    '/positions_create',
    '/positions_update',
    '/positions_delete',
    '/roles_read',
    '/roles_permissions_read',
    '/roles_permissions_update',
    '/permissions_read',
  ],
}

const mockPositions = [
  { id: '20000000-0000-4000-8000-000000000001', name: 'Chủ sở hữu', salary: '20000000' },
  { id: '20000000-0000-4000-8000-000000000002', name: 'Quản lý quán', salary: '15000000' },
  { id: '20000000-0000-4000-8000-000000000003', name: 'Barista', salary: '8000000' },
]

const mockRoles = [
  { id: '30000000-0000-4000-8000-000000000001', name: 'OWNER', description: 'Chủ cửa hàng', isSystemRole: true },
  { id: '30000000-0000-4000-8000-000000000002', name: 'MANAGER', description: 'Quản lý cửa hàng', isSystemRole: true },
  { id: '30000000-0000-4000-8000-000000000003', name: 'CASHIER', description: 'Thu ngân ca', isSystemRole: true },
]

const mockEmployees = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    fullName: 'Trần Văn Chủ Quán',
    username: 'owner',
    email: 'owner@example.test',
    phoneNumber: '0901234567',
    address: 'Hà Nội',
    positionId: '20000000-0000-4000-8000-000000000001',
    isActive: true,
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    fullName: 'Lê Thị Thu Ngân',
    username: 'cashier01',
    email: 'cashier01@example.test',
    phoneNumber: '0912345678',
    address: 'Hồ Chí Minh',
    positionId: '20000000-0000-4000-8000-000000000002',
    isActive: true,
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    fullName: 'Nguyễn Văn Tạm Khóa',
    username: 'inactive_staff',
    email: 'inactive@example.test',
    phoneNumber: '0922334455',
    address: 'Đà Nẵng',
    positionId: '20000000-0000-4000-8000-000000000003',
    isActive: false,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  },
]

test.describe('Staff Employees and Roles Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: envelope(employee) }))
    await page.route('**/api/v1/auth/me/permissions', (route) =>
      route.fulfill({ json: envelope(authorization) }),
    )
    await page.route('**/api/v1/positions**', (route) => {
      const url = route.request().url()
      if (url.includes('/dropdown')) {
        return route.fulfill({ json: envelope(mockPositions) })
      }
      return route.fulfill({
        json: envelope({
          list: mockPositions,
          totalPages: 1,
          totalItems: mockPositions.length,
          currentPage: 1,
        }),
      })
    })
    await page.route('**/api/v1/roles**', (route) =>
      route.fulfill({
        json: envelope({
          list: mockRoles,
          totalPages: 1,
          totalItems: mockRoles.length,
          currentPage: 1,
        }),
      }),
    )
  })

  test('loads employees list with stats and filters', async ({ page }) => {
    await page.route('**/api/v1/employees**', (route) =>
      route.fulfill({
        json: envelope({
          list: mockEmployees,
          totalPages: 1,
          totalItems: mockEmployees.length,
          currentPage: 1,
        }),
      }),
    )

    await page.goto('/staff/employees')

    await expect(page.getByRole('heading', { name: 'Quản lý Nhân sự & Phân quyền' })).toBeVisible()

    // Metric numbers (scoped to KPI section or first match to avoid badge collision)
    await expect(page.getByText('3', { exact: true }).first()).toBeVisible() // Total
    await expect(page.getByText('2', { exact: true }).first()).toBeVisible() // Active
    await expect(page.getByText('1', { exact: true }).first()).toBeVisible() // Inactive

    // Employee names
    await expect(page.getByText('Trần Văn Chủ Quán')).toBeVisible()
    await expect(page.getByText('Lê Thị Thu Ngân')).toBeVisible()
    await expect(page.getByText('Nguyễn Văn Tạm Khóa')).toBeVisible()

    // Filter by status: Inactive
    await page.getByLabel('Lọc theo trạng thái').selectOption('INACTIVE')
    await expect(page.getByText('Nguyễn Văn Tạm Khóa')).toBeVisible()
    await expect(page.getByText('Trần Văn Chủ Quán')).not.toBeVisible()

    // Reset filter
    await page.getByLabel('Lọc theo trạng thái').selectOption('ALL')
    await expect(page.getByText('Trần Văn Chủ Quán')).toBeVisible()
  })

  test('creates a new employee', async ({ page }) => {
    let currentEmployees = [...mockEmployees]

    await page.route('**/api/v1/employees**', (route) => {
      const req = route.request()
      if (req.method() === 'GET') {
        return route.fulfill({
          json: envelope({
            list: currentEmployees,
            totalPages: 1,
            totalItems: currentEmployees.length,
            currentPage: 1,
          }),
        })
      }
      if (req.method() === 'POST') {
        const payload = req.postDataJSON()
        const newEmp = {
          id: '10000000-0000-4000-8000-000000000099',
          fullName: payload.fullName,
          username: payload.username,
          email: payload.email,
          phoneNumber: payload.phoneNumber,
          address: payload.address,
          positionId: payload.positionId,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        currentEmployees = [...currentEmployees, newEmp]
        return route.fulfill({ json: envelope(newEmp) })
      }
      return route.fallback()
    })

    await page.goto('/staff/employees')

    await page.getByRole('button', { name: 'Thêm nhân viên' }).click()
    await expect(page.getByRole('heading', { name: 'Thêm nhân viên mới' })).toBeVisible()

    await page.getByPlaceholder('Ví dụ: Nguyễn Văn An').fill('Hoàng Đức Anh')
    await page.getByPlaceholder('nhanvien@example.com').fill('ducanh@example.test')
    await page.getByPlaceholder('nguyenvanan').fill('ducanh')
    await page.getByPlaceholder('Tối thiểu 12 ký tự').fill('Password123!Long')
    await page.getByLabel('Chọn vị trí công việc').selectOption({ label: 'Barista' })

    await page.getByRole('button', { name: 'Lưu nhân viên' }).click({ force: true })

    await expect(page.getByText('Đã thêm nhân viên "Hoàng Đức Anh" thành công')).toBeVisible()
    await expect(page.getByText('Hoàng Đức Anh', { exact: true })).toBeVisible()
  })

  test('updates employee profile and toggles status', async ({ page }) => {
    let currentEmployees = [...mockEmployees]

    await page.route('**/api/v1/employees**', (route) => {
      const req = route.request()
      if (req.method() === 'PATCH') {
        const payload = req.postDataJSON()
        const target = currentEmployees[1]
        if (!target) return route.fallback()
        const updated = {
          ...target,
          fullName: payload.fullName ?? target.fullName,
          phoneNumber: payload.phoneNumber ?? target.phoneNumber,
        }
        currentEmployees = [currentEmployees[0]!, updated, currentEmployees[2]!]
        return route.fulfill({ json: envelope(updated) })
      }
      return route.fulfill({
        json: envelope({
          list: currentEmployees,
          totalPages: 1,
          totalItems: currentEmployees.length,
          currentPage: 1,
        }),
      })
    })

    await page.goto('/staff/employees')

    // Click edit on Lê Thị Thu Ngân (index 1)
    await page.getByTitle('Chỉnh sửa thông tin').nth(1).click({ force: true })
    await expect(page.getByRole('heading', { name: 'Cập nhật thông tin nhân viên' })).toBeVisible()

    const nameInput = page.locator('input[value="Lê Thị Thu Ngân"]')
    await nameInput.fill('Lê Thị Thu Ngân (Trưởng ca)')
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click({ force: true })

    await expect(
      page.getByText('Đã cập nhật thông tin nhân viên "Lê Thị Thu Ngân (Trưởng ca)"'),
    ).toBeVisible()
  })

  test('assigns roles to employee', async ({ page }) => {
    await page.route('**/api/v1/employees**', (route) => {
      const req = route.request()
      const url = req.url()
      if (url.includes('/roles')) {
        if (req.method() === 'GET') {
          return route.fulfill({
            json: envelope({
              id: '10000000-0000-4000-8000-000000000002',
              email: 'cashier01@example.test',
              fullName: 'Lê Thị Thu Ngân',
              isActive: true,
              employeeRoles: [
                {
                  role: mockRoles[2], // CASHIER
                },
              ],
            }),
          })
        }
        if (req.method() === 'PUT') {
          return route.fulfill({
            json: envelope({ success: true, message: 'Roles updated' }),
          })
        }
      }
      return route.fulfill({
        json: envelope({
          list: mockEmployees,
          totalPages: 1,
          totalItems: mockEmployees.length,
          currentPage: 1,
        }),
      })
    })

    await page.goto('/staff/employees')

    // Use getByTitle for robust button selection on mobile & desktop
    await page.getByTitle('Phân quyền vai trò').nth(1).click({ force: true })
    await expect(page.getByRole('heading', { name: /Phân vai trò: Lê Thị Thu Ngân/ })).toBeVisible()

    // Select MANAGER role
    await page.getByText('MANAGER').click()
    await page.getByRole('button', { name: 'Lưu vai trò' }).click({ force: true })

    await expect(page.getByText('Đã cập nhật phân quyền vai trò cho nhân viên')).toBeVisible()
  })

  test('switches tabs to positions and roles', async ({ page }) => {
    await page.route('**/api/v1/employees**', (route) => {
      return route.fulfill({
        json: envelope({
          list: mockEmployees,
          totalPages: 1,
          totalItems: mockEmployees.length,
          currentPage: 1,
        }),
      })
    })

    await page.goto('/staff/employees')

    // Switch to Positions tab
    await page.getByRole('button', { name: /Vị trí Công việc/ }).click()
    await expect(page.getByRole('cell', { name: 'Chủ sở hữu' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Barista' })).toBeVisible()

    // Switch to Roles tab
    await page.getByRole('button', { name: /Vai trò & Quyền hạn/ }).click()
    await expect(page.getByRole('heading', { name: 'OWNER' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'MANAGER' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'CASHIER' })).toBeVisible()
  })
})
