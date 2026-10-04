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
    '/promotions_read',
    '/promotions_create',
    '/promotions_update',
    '/promotions_delete',
  ],
}

const mockPromotions = [
  {
    id: '70000000-0000-4000-8000-000000000001',
    name: 'Khai xuân rộn ràng',
    discountType: 'PERCENTAGE',
    discountValue: 20,
    maxDiscount: 50000,
    startDate: '2026-10-01T00:00:00.000Z',
    endDate: '2026-10-31T23:59:59.000Z',
    status: 'ACTIVE',
    usageCount: 12,
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    deletedAt: null,
  },
  {
    id: '70000000-0000-4000-8000-000000000002',
    name: 'Voucher tri ân khách hàng',
    discountType: 'FIXED_AMOUNT',
    discountValue: 30000,
    maxDiscount: null,
    startDate: '2026-10-01T00:00:00.000Z',
    endDate: '2026-10-31T23:59:59.000Z',
    status: 'ACTIVE',
    usageCount: 0,
    createdAt: '2026-10-01T08:30:00.000Z',
    updatedAt: '2026-10-01T08:30:00.000Z',
    deletedAt: null,
  },
]

test.describe('Staff Promotions Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: envelope(employee) }))
    await page.route('**/api/v1/auth/me/permissions', (route) =>
      route.fulfill({ json: envelope(authorization) }),
    )
  })

  test('staff can view promotion stats, cards and filter list', async ({ page }) => {
    await page.route('**/api/v1/promotions?*', (route) =>
      route.fulfill({
        json: envelope({
          list: mockPromotions,
          totalItems: 2,
          totalPages: 1,
          currentPage: 1,
        }),
      }),
    )

    await page.goto('/staff/promotions')
    await expect(
      page.getByRole('heading', { name: 'Chương trình Khuyến mãi & Voucher' }),
    ).toBeVisible()

    // Verify KPI stats
    await expect(page.getByText('Đang áp dụng', { exact: true })).toBeVisible()
    await expect(page.getByText('12 hóa đơn')).toBeVisible()

    // Verify promotion cards
    await expect(page.getByText('Khai xuân rộn ràng')).toBeVisible()
    await expect(page.getByText('Giảm 20%')).toBeVisible()
    await expect(page.getByText('50.000 ₫')).toBeVisible()

    await expect(page.getByText('Voucher tri ân khách hàng')).toBeVisible()
    await expect(page.getByText('Giảm 30.000 ₫')).toBeVisible()
  })

  test('staff can create a new promotion with live preview', async ({ page }) => {
    let createdPayload: unknown = null

    await page.route('**/api/v1/promotions?*', (route) =>
      route.fulfill({
        json: envelope({
          list: mockPromotions,
          totalItems: 2,
          totalPages: 1,
          currentPage: 1,
        }),
      }),
    )

    await page.route('**/api/v1/promotions', async (route) => {
      if (route.request().method() === 'POST') {
        createdPayload = route.request().postDataJSON()
        await route.fulfill({
          status: 201,
          json: envelope({
            id: '70000000-0000-4000-8000-000000000003',
            name: 'Ưu đãi thành viên VIP',
            discountType: 'PERCENTAGE',
            discountValue: 15,
            maxDiscount: 40000,
            startDate: '2026-10-02T00:00:00.000Z',
            endDate: '2026-11-02T00:00:00.000Z',
            status: 'ACTIVE',
            usageCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            deletedAt: null,
          }),
        })
      } else {
        await route.fallback()
      }
    })

    await page.goto('/staff/promotions')
    await page.getByRole('button', { name: 'Tạo khuyến mãi mới' }).click()

    await expect(page.getByText('Tạo chương trình khuyến mãi mới')).toBeVisible()

    // Fill form
    await page.getByPlaceholder('Ví dụ: Khai xuân rộn ràng - Giảm 20%').fill('Ưu đãi thành viên VIP')
    await page.getByRole('spinbutton').first().fill('15')
    await page.getByPlaceholder('Ví dụ: 50000 (để trống nếu không giới hạn)').fill('40000')

    // Expect live preview to reflect input
    await expect(page.getByText('Ưu đãi thành viên VIP')).toBeVisible()
    await expect(page.getByText('Giảm 15% (Tối đa 40.000 ₫)')).toBeVisible()

    // Submit
    await page.getByRole('button', { name: 'Xác nhận tạo khuyến mãi' }).click()

    expect(createdPayload).toMatchObject({
      name: 'Ưu đãi thành viên VIP',
      discountType: 'PERCENTAGE',
      discountValue: 15,
      maxDiscount: 40000,
    })
  })
})
