import { expect, test } from '@playwright/test'
import { envelope } from './helpers.js'

const employee = {
  id: '10000000-0000-4000-8000-000000000001',
  email: 'manager@coffee.test',
  username: 'manager',
  fullName: 'Quản lý Trưởng Ca',
  isActive: true,
  position: { id: '20000000-0000-4000-8000-000000000001', name: 'Quản lý Cửa hàng' },
}

const allPermissions = [
  '/cashier-shifts_current',
  '/cashier-shifts_open',
  '/cashier-shifts_close',
  '/cashier-shifts_transactions-create',
  '/cashier-shifts_read',
  '/cashier-shifts_expenses-review',
  '/cash-handovers_read',
  '/cash-handovers_create',
  '/cash-handovers_review',
  '/cash-handovers_settle',
  '/funds_read',
  '/funds_manage',
]

const mockFunds = [
  {
    id: 'f-001',
    name: 'Quỹ Tiền mặt Quầy Thu ngân 1',
    type: 'CASH',
    balance: '1500000',
    createdAt: '2026-09-01T00:00:00.000Z',
    _count: { shifts: 24, cashTransactions: 58 },
  },
  {
    id: 'f-002',
    name: 'Két Sắt An Toàn Trung Tâm',
    type: 'CASH',
    balance: '25000000',
    createdAt: '2026-09-01T00:00:00.000Z',
    _count: { shifts: 5, cashTransactions: 12 },
  },
  {
    id: 'f-003',
    name: 'Tài khoản Ngân hàng Vietcombank',
    type: 'BANK',
    balance: '120500000',
    createdAt: '2026-09-01T00:00:00.000Z',
    _count: { shifts: 0, cashTransactions: 140 },
  },
]

const mockOpenShift = {
  id: 'shift-open-001',
  openedAt: '2026-10-02T08:00:00.000Z',
  closedAt: null,
  startingCash: '1000000',
  reportedEndingCash: null,
  actualEndingCash: '1450000',
  status: 'OPEN',
  employeeId: employee.id,
  employee: { id: employee.id, fullName: employee.fullName },
  fundId: 'f-001',
  fund: { id: 'f-001', name: 'Quỹ Tiền mặt Quầy Thu ngân 1', type: 'CASH', balance: '1500000' },
  reconciliation: {
    paidInvoiceCount: 15,
    cashSales: '450000',
    nonCashSales: '820000',
    totalSales: '1270000',
    actualEndingCash: '1450000',
    reportedEndingCash: null,
    difference: null,
  },
}

const mockMovement = { movement: { id: 'movement', type: 'INCOME', amount: '50000' }, fundBalance: '1550000', expenseRequest: null }

const mockClosedShift = {
  id: 'shift-closed-001',
  openedAt: '2026-10-01T08:00:00.000Z',
  closedAt: '2026-10-01T16:00:00.000Z',
  startingCash: '1000000',
  reportedEndingCash: '2650000',
  actualEndingCash: '2650000',
  status: 'CLOSED',
  employeeId: employee.id,
  employee: { id: employee.id, fullName: employee.fullName },
  fundId: 'f-001',
  fund: { id: 'f-001', name: 'Quỹ Tiền mặt Quầy Thu ngân 1', type: 'CASH', balance: '2650000' },
  reconciliation: {
    paidInvoiceCount: 38,
    cashSales: '1650000',
    nonCashSales: '2400000',
    totalSales: '4050000',
    actualEndingCash: '2650000',
    reportedEndingCash: '2650000',
    difference: '0',
  },
}

const mockHandovers = [
  {
    id: 'handover-001',
    shiftId: 'shift-closed-001',
    sourceFundId: 'f-001',
    destinationFundId: 'f-002',
    requestedById: 'other-emp-001',
    expectedCash: '2650000',
    countedCash: '2650000',
    varianceAmount: '0',
    retainedCash: '500000',
    transferAmount: '2150000',
    status: 'PENDING',
    settlementStatus: 'PENDING',
    settlementDueAt: null,
    resolvedAt: null,
    resolutionNote: null,
    settledAt: null,
    bankReference: null,
    evidenceReference: null,
    note: 'Bàn giao ca sáng ngày 01/10',
    createdAt: '2026-10-01T16:15:00.000Z',
    requestedBy: { id: 'other-emp-001', fullName: 'Nguyễn Thu Ngân' },
    resolvedBy: null,
    settledBy: null,
    sourceFund: { id: 'f-001', name: 'Quỹ Tiền mặt Quầy Thu ngân 1', type: 'CASH' },
    destinationFund: { id: 'f-002', name: 'Két Sắt An Toàn Trung Tâm', type: 'CASH' },
  },
  {
    id: 'handover-002',
    shiftId: 'shift-closed-002',
    sourceFundId: 'f-002',
    destinationFundId: 'f-003',
    requestedById: employee.id,
    expectedCash: '10000000',
    countedCash: '10000000',
    varianceAmount: '0',
    retainedCash: '2000000',
    transferAmount: '8000000',
    status: 'APPROVED',
    settlementStatus: 'PENDING',
    settlementDueAt: '2026-10-01T12:00:00.000Z', // Overdue
    resolvedAt: '2026-10-01T10:00:00.000Z',
    resolutionNote: 'Đồng ý nộp tiền vào VCB',
    settledAt: null,
    bankReference: null,
    evidenceReference: null,
    note: 'Nộp tiền mặt doanh thu tuần vào tài khoản VCB',
    createdAt: '2026-10-01T09:30:00.000Z',
    requestedBy: { id: employee.id, fullName: employee.fullName },
    resolvedBy: { id: 'admin-001', fullName: 'Chủ Cửa hàng' },
    settledBy: null,
    sourceFund: { id: 'f-002', name: 'Két Sắt An Toàn Trung Tâm', type: 'CASH' },
    destinationFund: { id: 'f-003', name: 'Tài khoản Ngân hàng Vietcombank', type: 'BANK' },
  },
]

const mockExpenseRequests = [
  {
    id: 'exp-001',
    amount: '150000',
    description: 'Mua thêm đá viên và túi nilon khẩn cấp',
    status: 'PENDING',
    requestedById: 'other-emp-001',
    shiftId: 'shift-open-001',
    fundId: 'f-001',
    reviewedById: null,
    reviewedAt: null,
    reviewNote: null,
    createdAt: '2026-10-02T09:15:00.000Z',
    requestedBy: { id: 'other-emp-001', fullName: 'Nguyễn Thu Ngân' },
    reviewedBy: null,
    fund: { id: 'f-001', name: 'Quỹ Tiền mặt Quầy Thu ngân 1' },
  },
]

test.describe('Cash & Shifts Management Feature (Slice 1)', () => {
  test.beforeEach(async ({ page }) => {
    // Auth session mock
    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({ json: envelope(employee) })
    })

    await page.route('**/api/v1/auth/me/permissions', async (route) => {
      await route.fulfill({
        json: envelope({
          employeeId: employee.id,
          employeeEmail: employee.email,
          roleNames: ['MANAGER'],
          permissionKeys: allPermissions,
        }),
      })
    })

    // Funds mock
    await page.route(/\/api\/v1\/funds/, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          json: envelope({
            list: mockFunds,
            totalItems: mockFunds.length,
            totalPages: 1,
            currentPage: 1,
          }),
        })
      } else if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}')
        await route.fulfill({
          json: envelope({
            id: 'f-new-999',
            name: body.name,
            type: body.type,
            balance: body.openingBalance || '0',
            _count: { shifts: 0, cashTransactions: 0 },
          }),
        })
      } else if (route.request().method() === 'PATCH') {
        await route.fulfill({
          json: envelope({ ...mockFunds[0], name: 'Quỹ Thu ngân 1 - Đã cập nhật' }),
        })
      } else if (route.request().method() === 'DELETE') {
        await route.fulfill({ json: envelope({ success: true, id: 'f-001' }) })
      } else {
        await route.fallback()
      }
    })

    // Unified Cashier Shifts handler
    await page.route(/\/api\/v1\/cashier-shifts/, async (route) => {
      const url = route.request().url()

      if (url.includes('/current/expense-requests')) {
        await route.fulfill({
          json: envelope({
            list: mockExpenseRequests,
            totalItems: mockExpenseRequests.length,
            totalPages: 1,
            currentPage: 1,
          }),
        })
      } else if (url.includes('/current/close')) {
        await route.fulfill({ json: envelope(mockClosedShift) })
      } else if (url.includes('/current/transactions')) {
        await route.fulfill({ json: envelope(mockMovement) })
      } else if (url.includes('/current')) {
        await route.fulfill({ json: envelope(mockOpenShift) })
      } else if (url.includes('/expense-requests')) {
        if (url.includes('/approve')) {
          await route.fulfill({ json: envelope({ ...mockExpenseRequests[0], status: 'APPROVED' }) })
        } else if (url.includes('/reject')) {
          await route.fulfill({ json: envelope({ ...mockExpenseRequests[0], status: 'REJECTED' }) })
        } else {
          await route.fulfill({
            json: envelope({
              list: mockExpenseRequests,
              totalItems: mockExpenseRequests.length,
              totalPages: 1,
              currentPage: 1,
            }),
          })
        }
      } else if (url.includes('/open')) {
        await route.fulfill({ json: envelope(mockOpenShift) })
      } else {
        // GET /cashier-shifts (with or without query parameters)
        await route.fulfill({
          json: envelope({
            list: [mockOpenShift, mockClosedShift],
            totalItems: 2,
            totalPages: 1,
            currentPage: 1,
          }),
        })
      }
    })

    // Cash handovers mock
    await page.route(/\/api\/v1\/cash-handovers/, async (route) => {
      const url = route.request().url()
      const method = route.request().method()

      if (method === 'GET') {
        await route.fulfill({
          json: envelope({
            list: mockHandovers,
            totalItems: mockHandovers.length,
            totalPages: 1,
            currentPage: 1,
          }),
        })
      } else if (method === 'POST') {
        if (url.includes('/approve')) {
          await route.fulfill({ json: envelope({ ...mockHandovers[0], status: 'APPROVED' }) })
        } else if (url.includes('/reject')) {
          await route.fulfill({ json: envelope({ ...mockHandovers[0], status: 'REJECTED' }) })
        } else if (url.includes('/settle') || url.includes('/register-deposit')) {
          await route.fulfill({
            json: envelope({ ...mockHandovers[1], settlementStatus: 'SETTLED' }),
          })
        } else if (url.includes('/cancel')) {
          await route.fulfill({ json: envelope({ ...mockHandovers[0], status: 'CANCELLED' }) })
        } else {
          // Create handover
          await route.fulfill({ json: envelope(mockHandovers[0]) })
        }
      } else {
        await route.fallback()
      }
    })
  })

  test('TC-CS-01: Displays all 5 tabs and navigation with full permissions', async ({ page }) => {
    await page.goto('/staff/shifts')
    await expect(page.getByRole('heading', { name: 'Quản lý Ca & Quỹ tiền mặt' })).toBeVisible()

    // 5 Tabs
    await expect(page.getByRole('button', { name: /Ca làm việc của tôi/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Bàn giao két & Nộp tiền/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Duyệt phiếu chi tiền/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Danh mục Quỹ két/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Lịch sử ca thu ngân/i })).toBeVisible()
  })

  test('TC-CS-02: Displays active shift overview KPIs and handles cash movement', async ({ page }) => {
    await page.goto('/staff/shifts')

    // Active shift stats
    await expect(page.getByText('Tiền quỹ đầu ca')).toBeVisible()
    await expect(page.getByText('Doanh thu tiền mặt')).toBeVisible()
    await expect(page.getByText('Doanh thu chuyển khoản/thẻ')).toBeVisible()
    await expect(page.getByText('Tiền mặt dự kiến trong két')).toBeVisible()

    // Add cash movement
    await page.getByRole('button', { name: 'Thêm giao dịch' }).click({ force: true })
    await page.getByPlaceholder('Ví dụ: 100000').fill('50000')
    await page.getByPlaceholder('Ví dụ: Mua đá lạnh khẩn cấp...').fill('Nộp thêm tiền lẻ')
    await page.getByRole('button', { name: 'Lưu giao dịch' }).click({ force: true })

    await expect(page.getByText('Đã tiếp nhận yêu cầu thu / chi tiền mặt!')).toBeVisible()
  })

  test('TC-CS-03: Closes shift with reported cash count', async ({ page }) => {
    await page.goto('/staff/shifts')

    await page.getByPlaceholder('Ví dụ: 2500000').fill('1450000')
    await page.getByPlaceholder('Ghi chú chênh lệch tiền mặt, bàn giao tiền lẻ...').fill('Đóng ca chuẩn số dư')
    await page.getByRole('button', { name: 'Xác nhận đóng ca & Chốt sổ' }).click({ force: true })

    await expect(page.getByText('Đã đóng ca và chốt sổ tiền mặt an toàn!')).toBeVisible()
  })

  test('TC-CS-04: Navigates to Cash Handovers tab and views KPI metrics', async ({ page }) => {
    await page.goto('/staff/shifts')
    await page.getByRole('button', { name: /Bàn giao két & Nộp tiền/i }).click({ force: true })

    await expect(page.getByText('Biên bản chờ duyệt')).toBeVisible()
    await expect(page.getByText('Nộp ngân hàng quá hạn')).toBeVisible()
    await expect(page.getByText('Chờ nộp/quyết toán')).toBeVisible()
    await expect(page.getByText('Đã hoàn tất quyết toán')).toBeVisible()

    // Table rows
    await expect(page.getByText('Nguyễn Thu Ngân')).toBeVisible()
    await expect(page.getByText(/2\.150\.000/)).toBeVisible()
  })

  test('TC-CS-05: Opens handover details dialog', async ({ page }) => {
    await page.goto('/staff/shifts')
    await page.getByRole('button', { name: /Bàn giao két & Nộp tiền/i }).click({ force: true })
    await expect(page.getByText('Nguyễn Thu Ngân')).toBeVisible()

    // Click Eye button
    const detailButtons = page.getByTitle('Xem chi tiết')
    await detailButtons.first().click({ force: true })

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Thu ngân lập phiếu:')).toBeVisible()
    await expect(dialog.getByText('Bàn giao ca sáng ngày 01/10')).toBeVisible()

    await dialog.getByRole('button', { name: 'Đóng' }).first().click({ force: true })
  })

  test('TC-CS-06: Manager approves pending cash handover', async ({ page }) => {
    await page.goto('/staff/shifts')
    await page.getByRole('button', { name: /Bàn giao két & Nộp tiền/i }).click({ force: true })
    await expect(page.getByText('Nguyễn Thu Ngân')).toBeVisible()

    // Click Approve button (Check icon)
    await page.getByTitle('Duyệt bàn giao').click({ force: true })
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Xác nhận Phê duyệt Biên bản Bàn giao')).toBeVisible()

    await dialog.getByPlaceholder('Đã nhận đủ túi tiền niêm phong...').fill('Đã kiểm đếm đủ tiền')
    await dialog.getByRole('button', { name: 'Phê duyệt bàn giao' }).click({ force: true })

    await expect(page.getByText('Phê duyệt biên bản bàn giao thành công!')).toBeVisible()
  })

  test('TC-CS-07: Records bank deposit for approved handover', async ({ page }) => {
    await page.goto('/staff/shifts')
    await page.getByRole('button', { name: /Bàn giao két & Nộp tiền/i }).click()
    await expect(page.getByText('Nguyễn Thu Ngân')).toBeVisible()

    // Click Nộp tiền
    await page.getByRole('button', { name: 'Nộp tiền', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/Biên bản Nộp tiền/i)).toBeVisible()

    await dialog.getByPlaceholder('Ví dụ: VCB-20261002-889922').fill('VCB-20261002-998811')
    await dialog.getByPlaceholder('Ví dụ: Biên lai nộp tiền quầy giao dịch số 0928...').fill('UNC-001293')
    await dialog.getByRole('button', { name: 'Xác nhận nộp tiền' }).click()

    await expect(page.getByText(/thành công!/)).toBeVisible()
  })

  test('TC-CS-08: Creates a new cash handover request via modal', async ({ page }) => {
    await page.goto('/staff/shifts')

    await page.getByRole('button', { name: 'Lập biên bản bàn giao' }).first().click({ force: true })
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Lập biên bản Bàn giao Két tiền mặt')).toBeVisible()

    await dialog.getByPlaceholder('UUID ca làm việc...').fill('shift-closed-001')
    await dialog.locator('select').selectOption('f-002')
    await dialog.getByPlaceholder('Ví dụ: 500000').fill('500000')
    await dialog.getByPlaceholder('Ghi chú người nhận, niêm phong túi tiền...').fill('Bàn giao nộp két an toàn')

    await dialog.getByRole('button', { name: 'Xác nhận gửi biên bản' }).click({ force: true })
    await expect(page.getByText('Lập biên bản bàn giao két tiền mặt thành công!')).toBeVisible()
  })

  test('TC-CS-09: Manager reviews and approves expense request', async ({ page }) => {
    await page.goto('/staff/shifts')
    await page.getByRole('button', { name: /Duyệt phiếu chi tiền/i }).click({ force: true })

    await expect(page.getByText('Hàng đợi Phê duyệt Phiếu chi Tiền mặt khẩn cấp')).toBeVisible()
    await expect(page.getByText('Mua thêm đá viên và túi nilon khẩn cấp')).toBeVisible()

    await page.getByRole('button', { name: 'Duyệt', exact: true }).click({ force: true })
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Duyệt Phiếu chi Tiền mặt')).toBeVisible()

    await dialog.getByPlaceholder('Đã xác nhận hóa đơn chứng từ...').fill('Hóa đơn bán lẻ đính kèm hợp lệ')
    await dialog.getByRole('button', { name: 'Xác nhận duyệt chi' }).click({ force: true })

    await expect(page.getByText('Đã phê duyệt phiếu chi tiền mặt!')).toBeVisible()
  })

  test('TC-CS-10: Funds management lists funds and creates new fund', async ({ page }) => {
    await page.goto('/staff/shifts')
    await page.getByRole('button', { name: /Danh mục Quỹ két/i }).click({ force: true })

    await expect(page.getByText('Quỹ Tiền mặt Quầy Thu ngân 1')).toBeVisible()
    await expect(page.getByText('Két Sắt An Toàn Trung Tâm')).toBeVisible()
    await expect(page.getByText('Tài khoản Ngân hàng Vietcombank')).toBeVisible()

    // Create new fund
    await page.getByRole('button', { name: 'Thêm quỹ mới' }).click({ force: true })
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Thêm Quỹ tiền mặt mới')).toBeVisible()

    await dialog.getByPlaceholder('Ví dụ: Két sắt an toàn trung tâm...').fill('Quỹ Quầy Pha chế Bar 2')
    await dialog.getByRole('button', { name: 'Tạo quỹ' }).click({ force: true })

    await expect(page.getByText('Tạo quỹ tiền mặt/ngân hàng mới thành công!')).toBeVisible()
  })

  test('TC-CS-11: Shift history displays past shift records with reconciliation', async ({ page }) => {
    await page.goto('/staff/shifts')
    await page.getByRole('button', { name: /Lịch sử ca thu ngân/i }).click({ force: true })

    await expect(page.getByText('Nhật ký Lịch sử Toàn bộ Ca làm việc')).toBeVisible()
    await expect(page.getByRole('table').getByRole('cell', { name: 'Quản lý Trưởng Ca', exact: true }).first()).toBeVisible()
    await expect(page.getByText(/Khớp/)).toBeVisible()
  })

  for (const kind of ['open', 'close', 'transactions'] as const) {
    test(`uncertain ${kind} survives logout cleanup and reload with the same command`, async ({ page }) => {
      const bodies: Record<string, unknown>[] = []
      if (kind === 'open') await page.route('**/api/v1/cashier-shifts/current', route => route.fulfill({ status: 404, json: { message: 'No shift' } }))
      await page.route(`**/api/v1/cashier-shifts/${kind === 'open' ? 'open' : `current/${kind}`}`, route => {
        bodies.push(route.request().postDataJSON())
        return bodies.length === 1 ? route.abort() : route.fulfill({ json: envelope(kind === 'transactions' ? mockMovement : kind === 'open' ? mockOpenShift : mockClosedShift) })
      })
      await page.goto('/staff/shifts')
      if (kind === 'transactions') {
        await page.getByRole('button', { name: 'Thêm giao dịch' }).click()
        await page.getByPlaceholder('Ví dụ: 100000').fill('50000')
        await page.getByPlaceholder('Ví dụ: Mua đá lạnh khẩn cấp...').fill('Frozen movement')
        await page.getByRole('button', { name: 'Lưu giao dịch' }).click()
      } else if (kind === 'close') {
        await page.getByPlaceholder('Ví dụ: 2500000').fill('1450000')
        await page.getByRole('button', { name: 'Xác nhận đóng ca & Chốt sổ' }).click()
      } else {
        await page.locator('main select').selectOption('f-001')
        await page.getByRole('button', { name: 'Xác nhận mở ca thu ngân' }).click()
      }
      const recovery = page.getByRole('region', { name: 'Phục hồi giao dịch ca' })
      await expect(recovery).toBeVisible()
      await expect(recovery.getByRole('status')).toContainText('Chưa xác nhận được')
      expect(bodies).toHaveLength(1)
      await page.evaluate(async () => {
        const path = '/src/shared/api/idempotency.ts'
        const { clearPrivatePendingOperations } = await import(/* @vite-ignore */ path)
        clearPrivatePendingOperations()
      })
      await page.reload()
      await expect(recovery).toBeVisible()
      await expect(page.getByPlaceholder('Ví dụ: 100000')).toHaveCount(0)
      await recovery.getByRole('button', { name: 'Kiểm tra lại cùng yêu cầu' }).click()
      await expect.poll(() => bodies.length).toBe(2)
      expect(bodies[1]).toEqual(bodies[0])
      expect(bodies[0]?.idempotencyKey).toBeTruthy()
      await expect(recovery).toHaveCount(0)
    })
  }

  test('failed current-shift reads never expose a fresh opening command', async ({ page }) => {
    await page.route('**/api/v1/cashier-shifts/current', route => route.fulfill({ status: 503, json: { message: 'Unavailable' } }))
    await page.goto('/staff/shifts')
    await expect(page.getByRole('button', { name: 'Kiểm tra lại ca' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Xác nhận mở ca thu ngân' })).toHaveCount(0)
  })

  test('a rejected retry does not clear a previously uncertain cash command', async ({ page }) => {
    let writes = 0
    await page.route('**/api/v1/cashier-shifts/current/transactions', route => {
      writes++
      return writes === 1 ? route.abort() : route.fulfill({ status: 403, json: { message: 'Permission revoked' } })
    })
    await page.goto('/staff/shifts')
    await page.getByRole('button', { name: 'Thêm giao dịch' }).click()
    await page.getByPlaceholder('Ví dụ: 100000').fill('50000')
    await page.getByPlaceholder('Ví dụ: Mua đá lạnh khẩn cấp...').fill('Uncertain movement')
    await page.getByRole('button', { name: 'Lưu giao dịch' }).click()
    const recovery = page.getByRole('region', { name: 'Phục hồi giao dịch ca' })
    await recovery.getByRole('button', { name: 'Kiểm tra lại cùng yêu cầu' }).click()
    await expect.poll(() => writes).toBe(2)
    await page.reload()
    await expect(recovery).toContainText('Uncertain movement')
    await expect(page.getByPlaceholder('Ví dụ: 100000')).toHaveCount(0)
  })

  test('malformed movement success keeps the recovery command rather than claiming it was posted', async ({ page }) => {
    await page.route('**/api/v1/cashier-shifts/current/transactions', route => route.fulfill({ json: envelope({ success: true }) }))
    await page.goto('/staff/shifts')
    await page.getByRole('button', { name: 'Thêm giao dịch' }).click()
    await page.getByPlaceholder('Ví dụ: 100000').fill('50000')
    await page.getByPlaceholder('Ví dụ: Mua đá lạnh khẩn cấp...').fill('Invalid response')
    await page.getByRole('button', { name: 'Lưu giao dịch' }).click()
    await expect(page.getByRole('region', { name: 'Phục hồi giao dịch ca' })).toContainText('Phản hồi không hợp lệ')
    await expect(page.getByText('Đã tiếp nhận yêu cầu thu / chi tiền mặt!')).toHaveCount(0)
  })

  test('pending expense approval does not claim that the cash fund was debited', async ({ page }) => {
    await page.route('**/api/v1/cashier-shifts/current/transactions', route => route.fulfill({ json: envelope({ movement: null, fundBalance: '1500000', expenseRequest: mockExpenseRequests[0] }) }))
    await page.goto('/staff/shifts')
    await page.getByRole('button', { name: 'Thêm giao dịch' }).click()
    await page.getByPlaceholder('Ví dụ: 100000').fill('150000')
    await page.getByRole('button', { name: /EXPENSE/ }).click()
    await page.getByPlaceholder('Ví dụ: Mua đá lạnh khẩn cấp...').fill(mockExpenseRequests[0]!.description)
    await page.getByRole('button', { name: 'Lưu giao dịch' }).click()
    await expect(page.getByText('Đã gửi phiếu chi chờ phê duyệt; chưa trừ quỹ.')).toBeVisible()
  })
})
