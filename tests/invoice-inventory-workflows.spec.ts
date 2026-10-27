import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const item = {
  id: '40000000-0000-4000-8000-000000000001',
  name: 'Cà phê nguyên liệu',
  stock: '100',
  reservedStock: '20',
  reorderPoint: '10',
  averageUnitCost: '1000',
  categoryId: '40000000-0000-4000-8000-000000000002',
  unitId: '40000000-0000-4000-8000-000000000003',
  category: { id: '40000000-0000-4000-8000-000000000002', name: 'Nguyên liệu pha chế' },
  unit: { id: '40000000-0000-4000-8000-000000000003', name: 'g' },
}
const invoice = {
  id: '50000000-0000-4000-8000-000000000001',
  invoiceNumber: 'INV-RECENT',
  subTotal: '35000',
  discountAmount: '0',
  taxAmount: '0',
  taxRate: '0',
  totalAmount: '35000',
  paymentMethod: 'CASH',
  paymentStatus: 'REFUNDED',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  orderSessionId: '50000000-0000-4000-8000-000000000002',
  employeeId: defaultMockAdminEmployee.id,
  orderItems: [],
}
const shiftId = '50000000-0000-4000-8000-000000000003'
const recoveryKey = `coffee-shop:pending:private:intent:${defaultMockAdminEmployee.id}:inventory.movement`
const paged = (list: unknown[], currentPage = 1, totalItems = list.length, totalPages = 1) => ({
  list,
  currentPage,
  totalItems,
  totalPages,
})

async function setup(page: Page) {
  const requests: URL[] = []
  await page.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace('/api/v1', '')
    if (path === '/auth/me') return route.fulfill({ json: envelope(defaultMockAdminEmployee) })
    if (path === '/auth/me/permissions')
      return route.fulfill({
        json: envelope(
          defaultMockAdminAuth([
            '/inventory_read',
            '/inventory_stock_adjust',
            '/inventory_create',
            '/inventory_update',
            '/invoices_read',
            '/cashier-shifts_current',
          ]),
        ),
      })
    if (path === '/inventory/categories')
      return route.fulfill({ json: envelope(paged([item.category])) })
    if (path === '/inventory/units') return route.fulfill({ json: envelope(paged([item.unit])) })
    if (path === '/inventory/items') return route.fulfill({ json: envelope(paged([item])) })
    if (path === '/inventory/transactions') return route.fulfill({ json: envelope(paged([])) })
    if (path === '/inventory/reorder-alerts') {
      const currentPage = Number(url.searchParams.get('page') ?? 1)
      const start = (currentPage - 1) * 10
      const list = Array.from({ length: Math.min(10, 25 - start) }, (_, index) => ({
        ...item,
        id: `alert-${start + index}`,
        name: `Cảnh báo ${start + index + 1}`,
        unitName: 'g',
        categoryName: item.category.name,
        stock: '0',
        shortageQuantity: '10',
      }))
      return route.fulfill({ json: envelope(paged(list, currentPage, 25, 3)) })
    }
    if (path === '/cashier-shifts/current')
      return route.fulfill({
        json: envelope({
          id: shiftId,
          employeeId: defaultMockAdminEmployee.id,
          employee: defaultMockAdminEmployee,
          openedAt: '2026-10-02T00:00:00Z',
          status: 'OPEN',
          startingCash: '0',
        }),
      })
    if (path === '/invoices') {
      requests.push(url)
      const keyword = url.searchParams.get('keyword')
      return route.fulfill({
        json: envelope(
          keyword
            ? paged([{ ...invoice, invoiceNumber: keyword }])
            : paged([invoice], Number(url.searchParams.get('page') ?? 1), 31, 3),
        ),
      })
    }
    return route.fulfill({ status: 404, json: {} })
  })
  return requests
}

test('invoice search is server-wide, resets pagination and keeps Vietnam day and shift boundaries', async ({
  page,
}, info) => {
  const requests = await setup(page)
  await page.goto('/staff/invoices')
  await expect(
    page.getByText('Giá trị HĐ đã thanh toán trước hoàn · trang này', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect.poll(() => requests.at(-1)?.searchParams.get('page')).toBe('2')
  await page.getByRole('searchbox', { name: 'Tìm hóa đơn' }).fill('INV-OLD')
  await expect(page.getByRole('row', { name: 'Chi tiết hóa đơn INV-OLD' })).toBeVisible()
  expect(requests.at(-1)?.searchParams.get('keyword')).toBe('INV-OLD')
  expect(requests.at(-1)?.searchParams.get('page')).toBe('1')
  await page.getByLabel('Từ ngày (giờ Việt Nam)').fill('2026-10-02')
  await page.getByLabel('Đến ngày (giờ Việt Nam)').fill('2026-10-02')
  await page.getByLabel('Ca hiện tại của tôi').check()
  await expect.poll(() => requests.at(-1)?.searchParams.get('shiftId')).toBe(shiftId)
  expect(requests.at(-1)?.searchParams.get('createdFrom')).toBe('2026-10-01T17:00:00.000Z')
  expect(requests.at(-1)?.searchParams.get('createdTo')).toBe('2026-10-02T16:59:59.999Z')
  await page.getByLabel('Từ ngày (giờ Việt Nam)').fill('2026-10-04')
  await expect(page.getByRole('alert')).toContainText('Ngày bắt đầu phải trước')
  expect(
    requests.some((url) => url.searchParams.get('createdFrom') === '2026-10-03T17:00:00.000Z'),
  ).toBe(false)
  await page.getByRole('button', { name: 'Xóa bộ lọc' }).click()
  await expect(page.getByRole('row', { name: 'Chi tiết hóa đơn INV-RECENT' })).toBeVisible()
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect.poll(() => requests.at(-1)?.searchParams.has('keyword')).toBe(false)
  expect(requests.at(-1)?.searchParams.has('shiftId')).toBe(false)
  await page.screenshot({ path: info.outputPath('invoice-search.png'), fullPage: true })
})

test('reorder alerts expose every server page rather than only the first ten rows', async ({
  page,
}) => {
  await setup(page)
  await page.goto('/staff/inventory')
  await page.getByRole('button', { name: 'Cảnh báo cần nhập hàng', exact: false }).click()
  const alerts = page.getByRole('region', { name: 'Cảnh báo nhập hàng', exact: true })
  await expect(alerts.getByText('Cảnh báo 1', { exact: true })).toBeVisible()
  await alerts.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(alerts.getByText('Cảnh báo 11', { exact: true })).toBeVisible()
  await alerts.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(alerts.getByText('Cảnh báo 25', { exact: true })).toBeVisible()
  await expect(alerts.getByRole('button', { name: 'Trang sau', exact: true })).toBeDisabled()
  await page.route('**/api/v1/inventory/reorder-alerts?*', route => {
    const page = Number(new URL(route.request().url()).searchParams.get('page'))
    const list = page === 3 ? [] : [{ ...item, unitName: 'g', categoryName: item.category.name, stock: '0', shortageQuantity: '10' }]
    return route.fulfill({ json: envelope(paged(list, page, 20, 2)) })
  })
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await alerts.getByRole('button', { name: 'Về trang đầu', exact: true }).click()
  await expect(alerts.getByText(item.name, { exact: true })).toBeVisible()
})

test('stock receipt has no invented defaults and recovers the identical request after close and reload', async ({
  page,
}, info) => {
  await setup(page)
  await page.addInitScript(() => localStorage.setItem('coffee_theme', 'dark'))
  if (info.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 844 })
  const writes: Record<string, unknown>[] = []
  await page.route(`**/api/v1/inventory/items/${item.id}/import`, (route) => {
    writes.push(route.request().postDataJSON() as Record<string, unknown>)
    return writes.length === 1
      ? route.abort()
      : route.fulfill({ json: envelope({ success: true }) })
  })
  await page.goto('/staff/inventory')
  await page.getByRole('button', { name: 'Nhập', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Nhập kho nguyên liệu' })
  await expect(dialog.getByLabel('Số lượng (g)', { exact: true })).toHaveValue('')
  await expect(dialog.getByLabel('Đơn giá nhập (VND / g)', { exact: true })).toHaveValue('')
  await expect(dialog.getByLabel('Lý do / Nguồn gốc')).toHaveValue('')
  await dialog.getByLabel('Số lượng (g)', { exact: true }).fill('2.5')
  await dialog.getByLabel('Đơn giá nhập (VND / g)', { exact: true }).fill('50000.25')
  await dialog.getByLabel('Lý do / Nguồn gốc').fill('Nhập theo phiếu NCC 001')
  await expect(dialog).toContainText('125.000,63 ₫')
  await dialog.getByRole('button', { name: 'Xác nhận nhập kho', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByLabel('Số lượng (g)', { exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Đóng để đối soát' }).click()
  await expect(dialog).toHaveCount(0)
  await page.getByRole('button', { name: 'Xuất', exact: true }).click()
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Xuất kho nguyên liệu' })).toHaveCount(0)
  await page.reload()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Số lượng (g)', { exact: true })).toHaveValue('2.5')
  await expect(dialog.getByLabel('Số lượng (g)', { exact: true })).toBeDisabled()
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('stock-recovery-dark.png') })
  await dialog.getByRole('button', { name: 'Kiểm tra lại cùng yêu cầu', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes).toHaveLength(2)
  expect(writes[1]).toEqual(writes[0])
  expect(await page.evaluate((key) => sessionStorage.getItem(key), recoveryKey)).toBeNull()
})

test('a first rejected stock issue can be corrected without reusing a successful or unknown write', async ({
  page,
}) => {
  await setup(page)
  const writes: Record<string, unknown>[] = []
  await page.route(`**/api/v1/inventory/items/${item.id}/export`, (route) => {
    writes.push(route.request().postDataJSON() as Record<string, unknown>)
    return writes.length === 1
      ? route.fulfill({ status: 409, json: { message: 'Insufficient stock' } })
      : route.fulfill({ json: envelope({ success: true }) })
  })
  await page.goto('/staff/inventory')
  await page.getByRole('button', { name: 'Xuất', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Xuất kho nguyên liệu' })
  await dialog.getByLabel('Số lượng (g)', { exact: true }).fill('81')
  await dialog.getByLabel('Lý do / Nguồn gốc').fill('Xuất nguyên liệu cho quầy')
  await dialog.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  expect(writes).toHaveLength(0)
  await dialog.getByLabel('Số lượng (g)', { exact: true }).fill('5')
  await dialog.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Insufficient stock')
  await expect(dialog.getByLabel('Số lượng (g)', { exact: true })).toBeEnabled()
  await dialog.getByLabel('Số lượng (g)', { exact: true }).fill('1')
  await dialog.getByRole('button', { name: 'Xác nhận xuất kho', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes).toHaveLength(2)
  expect(writes[0]?.idempotencyKey).not.toBe(writes[1]?.idempotencyKey)
})

test('expired recovery cannot create a replacement stock write', async ({ page }) => {
  await setup(page)
  await page.addInitScript(({ key, value }) => sessionStorage.setItem(key, JSON.stringify(value)), {
    key: recoveryKey,
    value: {
      payload: {
        type: 'IMPORT',
        item,
        quantity: '1',
        unitPrice: '1000',
        note: 'Phiếu nhập chưa rõ kết quả',
      },
      idempotencyKey: '90000000-0000-4000-8000-000000000001',
      createdAt: Date.now() - 24 * 3600_000,
      uncertain: true,
    },
  })
  let writes = 0
  await page.route('**/api/v1/inventory/items/*/import', (route) => {
    writes++
    return route.fulfill({ json: envelope({}) })
  })
  await page.goto('/staff/inventory')
  const dialog = page.getByRole('dialog', { name: 'Nhập kho nguyên liệu' })
  await expect(dialog.getByRole('alert')).toContainText('quá thời hạn phục hồi')
  await expect(
    dialog.getByRole('button', { name: 'Kiểm tra lại cùng yêu cầu', exact: true }),
  ).toBeDisabled()
  expect(writes).toBe(0)
})

test('ingredient creation labels are associated and decimal inputs are sent without Number rounding', async ({
  page,
}) => {
  await setup(page)
  let input: Record<string, unknown> | undefined
  await page.route('**/api/v1/inventory/items', (route) => {
    input = route.request().postDataJSON() as Record<string, unknown>
    return route.fulfill({ json: envelope({ ...item, ...input, reservedStock: '0' }) })
  })
  await page.goto('/staff/inventory')
  await page.getByRole('button', { name: 'Thêm nguyên liệu', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Thêm nguyên vật liệu mới' })
  await dialog.getByLabel('Tên nguyên liệu', { exact: false }).fill('Nguyên liệu định lượng')
  await expect(dialog.getByLabel('Nhóm danh mục', { exact: true })).toHaveValue(item.categoryId)
  await expect(dialog.getByLabel('Đơn vị tính', { exact: true })).toHaveValue(item.unitId)
  await dialog.getByLabel('Số lượng ban đầu', { exact: true }).fill('9007199254.1234')
  await expect(dialog.getByLabel('Giá vốn ban đầu (VND / đơn vị)', { exact: true })).toHaveValue('')
  await dialog.getByLabel('Giá vốn ban đầu (VND / đơn vị)', { exact: true }).fill('12.34')
  await dialog.getByLabel('Mức tối thiểu cảnh báo', { exact: true }).fill('0.0001')
  await dialog.getByRole('button', { name: 'Tạo nguyên liệu', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(input).toMatchObject({
    stock: '9007199254.1234',
    initialUnitCost: '12.34',
    reorderPoint: '0.0001',
  })
})

for (const recovery of ['unreadable', 'legacy'] as const) {
  test(`${recovery} recovery never silently becomes a new stock transaction`, async ({ page }) => {
    await setup(page)
    const key =
      recovery === 'unreadable'
        ? recoveryKey
        : `coffee-shop:pending:private:/inventory/items/${item.id}/import:legacy-fingerprint`
    await page.addInitScript((key) => sessionStorage.setItem(key, 'broken recovery data'), key)
    let writes = 0
    await page.route('**/api/v1/inventory/items/*/import', (route) => {
      writes++
      return route.fulfill({ json: envelope({}) })
    })
    await page.goto('/staff/inventory')
    await expect(page.getByRole('alert')).toContainText('Không đọc được yêu cầu kho')
    await page.getByRole('button', { name: 'Nhập', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(writes).toBe(0)
  })
}
