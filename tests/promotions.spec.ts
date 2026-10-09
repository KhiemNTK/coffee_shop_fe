import { expect, test, type Page } from '@playwright/test'
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

const paged = (list: unknown[], totalItems = list.length) => ({
  list,
  totalItems,
  totalPages: Math.ceil(totalItems / 12),
  currentPage: 1,
})
async function list(page: Page, values: unknown[] = mockPromotions) {
  await page.route('**/api/v1/promotions?*', (route) =>
    route.fulfill({ json: envelope(paged(values)) }),
  )
}
test.use({ timezoneId: 'UTC' })

test.describe('Staff Promotions Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-05T01:00:00Z'))
    await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: envelope(employee) }))
    await page.route('**/api/v1/auth/me/permissions', (route) =>
      route.fulfill({ json: envelope(authorization) }),
    )
  })

  test('staff sees server totals without treating page-local counts as KPIs', async ({ page }) => {
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
    await expect(page.getByRole('heading', { name: 'Khuyến mãi hóa đơn' })).toBeVisible()

    await expect(page.getByText('Đang áp dụng', { exact: true })).toHaveCount(2)
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
    await page
      .getByPlaceholder('Ví dụ: Khai xuân rộn ràng - Giảm 20%')
      .fill('Ưu đãi thành viên VIP')
    await page.getByRole('spinbutton').first().fill('15')
    await page.getByPlaceholder('Ví dụ: 50000 (để trống nếu không giới hạn)').fill('40000')
    await page.getByLabel('Ngày bắt đầu (Việt Nam)').fill('2026-10-06T07:00')
    await page.getByLabel('Ngày kết thúc (Việt Nam)').fill('2026-10-07T22:00')

    // Expect live preview to reflect input
    await expect(page.getByLabel('Tên chương trình', { exact: true })).toHaveValue(
      'Ưu đãi thành viên VIP',
    )
    await expect(page.getByText('Giảm 15% (Tối đa 40.000 ₫)')).toBeVisible()

    // Submit
    await page.getByRole('button', { name: 'Xác nhận tạo khuyến mãi' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    expect(createdPayload).toMatchObject({
      name: 'Ưu đãi thành viên VIP',
      discountType: 'PERCENTAGE',
      discountValue: '15',
      maxDiscount: '40000',
      startDate: '2026-10-06T00:00:00.000Z',
      endDate: '2026-10-07T15:00:00.000Z',
    })
  })

  test('read failures keep filters and never look like an empty successful result', async ({
    page,
  }) => {
    await page.route('**/api/v1/promotions?*', (route) =>
      route.fulfill({ status: 503, json: { message: 'Unavailable' } }),
    )
    await page.goto('/staff/promotions')
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByLabel('Lọc theo trạng thái khuyến mãi')).toBeVisible()
    await expect(page.getByText('Không có khuyến mãi phù hợp bộ lọc.')).toHaveCount(0)
    await expect(page.getByText('Tìm thấy 0 chương trình')).toHaveCount(0)
  })

  test('fresh detail locks financial fields and PATCH sends only the changed name', async ({
    page,
  }) => {
    await list(page)
    const current = { ...mockPromotions[1]!, name: 'Tên mới trên server', usageCount: 3 }
    let payload: unknown
    await page.route('**/api/v1/promotions/' + current.id, async (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ json: envelope(current) })
      payload = route.request().postDataJSON()
      const { status, usageCount, ...record } = current
      void status
      void usageCount
      return route.fulfill({ json: envelope({ ...record, name: 'Tên chỉnh sửa' }) })
    })
    await page.goto('/staff/promotions')
    await page.getByRole('button', { name: 'Sửa Voucher tri ân khách hàng' }).click()
    await expect(page.getByLabel('Tên chương trình', { exact: true })).toHaveValue(current.name)
    await expect(
      page.getByRole('dialog').getByLabel('Hình thức giảm giá', { exact: true }),
    ).toBeDisabled()
    await page.getByLabel('Tên chương trình', { exact: true }).fill('Tên chỉnh sửa')
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(payload).toEqual({ name: 'Tên chỉnh sửa' })
  })

  test('a raw create response succeeds without fabricated status or usageCount', async ({
    page,
  }) => {
    await list(page)
    let body: Record<string, unknown> | undefined
    await page.route('**/api/v1/promotions', (route) => {
      body = route.request().postDataJSON() as Record<string, unknown>
      return route.fulfill({
        status: 201,
        json: envelope({
          ...body,
          id: '70000000-0000-4000-8000-000000000004',
          createdAt: '2026-10-05T01:00:00Z',
          updatedAt: '2026-10-05T01:00:00Z',
          deletedAt: null,
        }),
      })
    })
    await page.goto('/staff/promotions')
    await page.getByRole('button', { name: 'Tạo khuyến mãi mới' }).click()
    await page.getByLabel('Tên chương trình', { exact: true }).fill('Ưu đãi chính xác')
    await page.getByLabel('Tỷ lệ giảm (%)').fill('12.25')
    await page.getByRole('button', { name: 'Xác nhận tạo khuyến mãi' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(body?.discountValue).toBe('12.25')
  })

  test('a rejected duplicate name can be corrected without closing the form', async ({ page }) => {
    await list(page)
    let writes = 0
    await page.route('**/api/v1/promotions', (route) => {
      writes++
      if (writes === 1)
        return route.fulfill({ status: 409, json: { message: 'Tên khuyến mãi đã tồn tại' } })
      return route.fulfill({
        status: 201,
        json: envelope({
          ...route.request().postDataJSON(),
          id: '70000000-0000-4000-8000-000000000004',
          createdAt: '2026-10-05T01:00:00Z',
          updatedAt: '2026-10-05T01:00:00Z',
          deletedAt: null,
        }),
      })
    })
    await page.goto('/staff/promotions')
    await page.getByRole('button', { name: 'Tạo khuyến mãi mới' }).click()
    await page.getByLabel('Tên chương trình', { exact: true }).fill(mockPromotions[0]!.name)
    await page.getByRole('button', { name: 'Xác nhận tạo khuyến mãi' }).click()
    await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
    await expect(page.getByLabel('Tên chương trình', { exact: true })).toBeEnabled()
    await page.getByLabel('Tên chương trình', { exact: true }).fill('Ưu đãi riêng')
    await page.getByRole('button', { name: 'Xác nhận tạo khuyến mãi' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(writes).toBe(2)
  })

  test('missing usage count fails closed rather than unlocking financial fields', async ({
    page,
  }) => {
    await list(page)
    await page.route('**/api/v1/promotions/' + mockPromotions[0]!.id, (route) =>
      route.fulfill({ json: envelope({ ...mockPromotions[0], usageCount: undefined }) }),
    )
    await page.goto('/staff/promotions')
    await page.getByRole('button', { name: 'Sửa Khai xuân rộn ràng' }).click()
    await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Lưu thay đổi' })).toHaveCount(0)
  })

  test('uncertain creation freezes the form and never offers a blind POST retry', async ({
    page,
  }) => {
    await list(page)
    let writes = 0
    await page.route('**/api/v1/promotions', (route) => {
      writes++
      return route.abort()
    })
    await page.goto('/staff/promotions')
    await page.getByRole('button', { name: 'Tạo khuyến mãi mới' }).click()
    await page.getByLabel('Tên chương trình', { exact: true }).fill('Chưa rõ kết quả')
    await page.getByRole('button', { name: 'Xác nhận tạo khuyến mãi' }).click()
    await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
    await expect(page.getByLabel('Tên chương trình', { exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Xác nhận tạo khuyến mãi' })).toBeDisabled()
    expect(writes).toBe(1)
  })

  test('read/update permissions allow confirmed restore without delete/create actions', async ({
    page,
  }) => {
    await page.route('**/api/v1/auth/me/permissions', (route) =>
      route.fulfill({
        json: envelope({
          ...authorization,
          permissionKeys: ['/promotions_read', '/promotions_update'],
        }),
      }),
    )
    const deleted = { ...mockPromotions[1]!, status: 'DELETED', deletedAt: '2026-10-05T01:00:00Z' }
    await list(page, [deleted])
    await page.route('**/api/v1/promotions/' + deleted.id, (route) =>
      route.fulfill({ json: envelope(deleted) }),
    )
    let writes = 0
    await page.route('**/api/v1/promotions/' + deleted.id + '/restore', (route) => {
      writes++
      const { status, usageCount, ...record } = deleted
      void status
      void usageCount
      return route.fulfill({ json: envelope({ ...record, deletedAt: null }) })
    })
    await page.goto('/staff/promotions')
    await expect(page.getByRole('button', { name: 'Tạo khuyến mãi mới' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Ngừng áp dụng' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Khôi phục', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Xác nhận khôi phục' })).toBeVisible()
    expect(writes).toBe(0)
    await page.getByRole('button', { name: 'Xác nhận khôi phục' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(writes).toBe(1)
  })

  test('stopping the last promotion on a page retains navigation to a valid page', async ({
    page,
  }) => {
    let stopped = false
    await page.route('**/api/v1/promotions?*', (route) => {
      const currentPage = Number(new URL(route.request().url()).searchParams.get('page'))
      return route.fulfill({
        json: envelope({
          list: currentPage === 1 ? [mockPromotions[1]] : stopped ? [] : [mockPromotions[0]],
          totalItems: stopped ? 12 : 13,
          totalPages: stopped ? 1 : 2,
          currentPage,
        }),
      })
    })
    await page.route('**/api/v1/promotions/' + mockPromotions[0]!.id, (route) => {
      if (route.request().method() === 'GET')
        return route.fulfill({ json: envelope(mockPromotions[0]) })
      stopped = true
      return route.fulfill({ json: envelope({ success: true, message: 'Deleted' }) })
    })
    await page.goto('/staff/promotions')
    await page.getByRole('button', { name: 'Trang sau' }).click()
    await expect(page.getByRole('heading', { name: mockPromotions[0]!.name })).toBeVisible()
    await page.getByRole('button', { name: 'Ngừng áp dụng' }).click()
    await page.getByRole('button', { name: 'Xác nhận ngừng áp dụng' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: 'Về trang đầu' }).click()
    await expect(page.getByRole('heading', { name: mockPromotions[1]!.name })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Về trang đầu' })).toHaveCount(0)
  })
})
