import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const supplier = { id: 'supplier-fixture', code: 'SUP', name: 'Fixture supplier' }
const item = { id: 'item-fixture', name: 'Fixture beans', stock: '1.2345', averageUnitCost: '20000',
  categoryId: 'category-fixture', unitId: 'unit-fixture', unit: { id: 'unit-fixture', name: 'kg' } }
const receipt = { id: 'receipt-fixture', receiptNumber: 'PR-FIXTURE', supplierId: supplier.id,
  supplier, status: 'DRAFT', totalAmount: '115000', receivedAt: '2026-10-04T01:00:00.000Z', note: 'Old note',
  items: [{ inventoryItemId: item.id, inventoryItemName: item.name, unitName: 'kg',
    quantity: '5', unitPrice: '23000', totalAmount: '115000' }] }
const permissions = ['/inventory_read', '/inventory_suppliers_read', '/inventory_purchase-receipts_read',
  '/inventory_purchase-receipts_create', '/inventory_purchase-receipts_post']
const stocktake = { id: 'stocktake-fixture', stocktakeNumber: 'ST-FIXTURE', status: 'DRAFT',
  createdAt: '2026-10-05T01:00:00.000Z', note: null,
  items: [{ inventoryItemId: item.id, inventoryItemName: item.name, unitName: 'kg',
    expectedQuantity: '1.2345', countedQuantity: '0.2344', differenceQuantity: null }] }
const stocktakePermissions = ['/inventory_read', '/inventory_stocktakes_read', '/inventory_stocktakes_create', '/inventory_stocktakes_post']
const paginated = (list: unknown[]) => ({ list, currentPage: 1, totalItems: list.length, totalPages: list.length ? 1 : 0 })

async function mockInventory(page: Page, keys = permissions) {
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: envelope(defaultMockAdminEmployee) }))
  await page.route('**/api/v1/auth/me/permissions', route => route.fulfill({ json: envelope(defaultMockAdminAuth(keys)) }))
  await page.route('**/api/v1/inventory/**', route => {
    const url = new URL(route.request().url())
    const data = url.pathname.endsWith('/suppliers') ? paginated(url.searchParams.get('keyword') === 'none' ? [] : [supplier])
      : url.pathname.endsWith('/purchase-receipts/receipt-fixture') ? receipt
        : url.pathname.endsWith('/purchase-receipts') ? paginated([receipt])
          : url.pathname.endsWith('/stocktakes/stocktake-fixture') ? stocktake
            : url.pathname.endsWith('/stocktakes') ? paginated([stocktake])
              : url.pathname.endsWith('/items') ? paginated(url.searchParams.get('keyword') === 'none' ? [] : [item]) : paginated([])
    return route.fulfill({ json: envelope(data) })
  })
  await page.goto('/staff/inventory')
  await page.getByRole('button', { name: 'Mua hàng & Kiểm kê' }).click()
  await page.getByRole('button', { name: 'Phiếu nhập', exact: true }).click()
}

for (const failure of ['network', 'invalid-response'] as const) {
  test(`uncertain receipt creation freezes the original intent after ${failure}`, async ({ page }) => {
    await mockInventory(page)
    const bodies: Record<string, unknown>[] = []
    await page.route('**/api/v1/inventory/purchase-receipts', route => {
      if (route.request().method() !== 'POST') return route.fallback()
      bodies.push(route.request().postDataJSON())
      if (bodies.length === 1) return failure === 'network' ? route.abort()
        : route.fulfill({ json: envelope({ id: 'receipt-fixture', status: 'WRONG' }) })
      return route.fulfill({ json: envelope(receipt) })
    })
    await page.getByRole('button', { name: 'Tạo mới', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Tạo phiếu nhập nháp' })
    await dialog.getByRole('combobox', { name: 'Nhà cung cấp', exact: true }).selectOption(supplier.id)
    await dialog.getByRole('combobox', { name: 'Nguyên liệu', exact: true }).selectOption(item.id)
    await dialog.getByLabel('Số lượng', { exact: true }).fill('1.2345')
    await dialog.getByLabel('Đơn giá', { exact: true }).fill('23000.50')
    await dialog.getByLabel('Ghi chú', { exact: true }).fill('Original intent')
    await dialog.getByRole('button', { name: 'Lưu phiếu nháp', exact: true }).click()
    const retry = dialog.getByRole('button', { name: 'Thử lại phiếu đã gửi', exact: true })
    await expect(retry).toBeVisible()
    await expect(dialog.getByLabel('Ghi chú', { exact: true })).toBeDisabled()
    await expect(dialog.getByLabel('Số lượng', { exact: true })).toBeDisabled()
    await dialog.getByRole('button', { name: 'Đóng', exact: true }).click()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    await retry.click()
    await expect(dialog).not.toBeVisible()
    expect(bodies).toHaveLength(2)
    expect(bodies[0]).toEqual(bodies[1])
    expect(bodies[0]).toMatchObject({ note: 'Original intent', items: [{
      inventoryItemId: item.id, quantity: '1.2345', unitPrice: '23000.50',
    }] })
  })
}

test('draft receipt can clear its note without supplier lookup permission', async ({ page }) => {
  await mockInventory(page, permissions.filter(key => key !== '/inventory_suppliers_read'))
  let supplierReads = 0
  let submitted: Record<string, unknown> | undefined
  await page.route('**/api/v1/inventory/suppliers**', route => { supplierReads++; return route.fallback() })
  await page.route('**/api/v1/inventory/purchase-receipts/receipt-fixture', route => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    submitted = route.request().postDataJSON()
    return route.fulfill({ json: envelope({ ...receipt, note: null }) })
  })
  await expect(page.getByRole('button', { name: 'Tạo mới', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'PR-FIXTURE' })
  await expect(dialog.getByRole('combobox', { name: 'Nhà cung cấp', exact: true })).toBeDisabled()
  await dialog.getByLabel('Ghi chú', { exact: true }).fill('')
  await dialog.getByRole('button', { name: 'Lưu phiếu nháp', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(submitted).toMatchObject({ supplierId: supplier.id, note: null })
  expect(supplierReads).toBe(0)
})

test('selected supplier remains selected when search returns no matches', async ({ page }) => {
  await mockInventory(page)
  await page.getByRole('button', { name: 'Tạo mới', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Tạo phiếu nhập nháp' })
  await dialog.getByRole('combobox', { name: 'Nhà cung cấp', exact: true }).selectOption(supplier.id)
  const search = page.waitForResponse(response => response.url().includes('/inventory/suppliers?') && response.url().includes('keyword=none'))
  await dialog.getByLabel('Tìm nhà cung cấp', { exact: true }).fill('none')
  await search
  await expect(dialog.getByRole('combobox', { name: 'Nhà cung cấp', exact: true })).toHaveValue(supplier.id)
  await expect(dialog.getByRole('option', { name: supplier.name, exact: true })).toBeAttached()
})

test('new document confirmation does not inherit another failed action', async ({ page }) => {
  await mockInventory(page)
  await page.route('**/api/v1/inventory/purchase-receipts/receipt-fixture/post', route =>
    route.fulfill({ status: 409, json: { code: 'CONFLICT', message: 'Fixture posting conflict' } }))
  await page.getByRole('button', { name: 'Ghi sổ', exact: true }).click()
  const posting = page.getByRole('dialog', { name: 'Xác nhận ghi sổ' })
  await posting.getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(posting.getByRole('alert')).toHaveText('Fixture posting conflict')
  await posting.getByRole('button', { name: 'Đóng', exact: true }).click()
  await page.getByRole('button', { name: 'Hủy', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Hủy chứng từ' }).getByRole('alert')).toHaveCount(0)
})

test('inventory quantity display preserves four decimal places and large values', async ({ page }) => {
  await mockInventory(page)
  await page.getByRole('button', { name: 'Kho hàng & Tồn kho' }).click()
  await expect(page.getByRole('row').filter({ hasText: item.name })).toContainText('1,2345 kg')
  const values = await page.evaluate(async () => {
    const path = '/src/features/inventory/quantity.ts'
    const { formatQuantity, quantitySchema, quantityDifference } = await import(path)
    return { values: ['1.2345', '99999999999999.1234', '-0.0001', '10.5000'].map(formatQuantity),
      unsafe: quantitySchema.safeParse(Number('99999999999999.1234')).success,
      differences: [quantityDifference('99999999999999.1234', '99999999999999.1233'), quantityDifference('0', '0.0001'), quantityDifference('1.0001', '-0.0001')] }
  })
  expect(values).toEqual({ values: ['1,2345', '99.999.999.999.999,1234', '-0,0001', '10,5'], unsafe: false,
    differences: ['0.0001', '-0.0001', '1.0002'] })
})

async function openStocktakes(page: Page, keys = stocktakePermissions) {
  await mockInventory(page, keys)
  await page.getByRole('button', { name: 'Kiểm kê', exact: true }).click()
}

for (const failure of ['network', 'invalid-response'] as const) {
  test(`uncertain stocktake creation retains selection and original intent after ${failure}`, async ({ page }) => {
    await openStocktakes(page)
    const bodies: Record<string, unknown>[] = []
    await page.route('**/api/v1/inventory/stocktakes', route => {
      if (route.request().method() !== 'POST') return route.fallback()
      bodies.push(route.request().postDataJSON())
      if (bodies.length === 1) return failure === 'network' ? route.abort()
        : route.fulfill({ json: envelope({ id: stocktake.id }) })
      return route.fulfill({ json: envelope(stocktake) })
    })
    await page.getByRole('button', { name: 'Tạo mới', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Tạo phiếu kiểm kê' })
    await dialog.getByRole('checkbox').check()
    await dialog.getByLabel('Ghi chú', { exact: true }).fill('Original stocktake')
    const search = page.waitForResponse(response => response.url().includes('/inventory/items?') && response.url().includes('keyword=none'))
    await dialog.getByLabel('Tìm nguyên liệu', { exact: true }).fill('none')
    await search
    await expect(dialog.getByRole('list', { name: 'Nguyên liệu đã chọn' })).toContainText(item.name)
    await dialog.getByRole('button', { name: 'Tạo phiếu kiểm kê', exact: true }).click()
    await expect(dialog.getByRole('button', { name: 'Thử lại phiếu đã gửi', exact: true })).toBeVisible()
    await expect(dialog.getByLabel('Ghi chú', { exact: true })).toBeDisabled()
    await expect(dialog.getByRole('button', { name: `Bỏ chọn ${item.name}` })).toBeDisabled()
    await dialog.getByRole('button', { name: 'Đóng', exact: true }).click()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Thử lại phiếu đã gửi', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    expect(bodies).toHaveLength(2)
    expect(bodies[0]).toEqual(bodies[1])
    expect(bodies[0]).toMatchObject({ inventoryItemIds: [item.id], note: 'Original stocktake' })
  })
}

test('uncertain counts read server state instead of overwriting with a blind retry', async ({ page }) => {
  await openStocktakes(page)
  let writes = 0
  let stored = stocktake
  await page.route('**/api/v1/inventory/stocktakes/stocktake-fixture', route => route.fulfill({ json: envelope(stored) }))
  await page.route('**/api/v1/inventory/stocktakes/stocktake-fixture/counts', route => {
    writes++
    expect(route.request().postDataJSON()).toEqual({ items: [{ inventoryItemId: item.id, countedQuantity: '0.1234' }] })
    stored = { ...stocktake, items: [{ ...stocktake.items[0]!, countedQuantity: '0.1234' }] }
    return route.abort()
  })
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: stocktake.stocktakeNumber })
  const count = dialog.getByRole('spinbutton', { name: `Số lượng thực đếm ${item.name}` })
  await count.fill('0.1234')
  await expect(dialog.getByRole('table')).toContainText('-1,0001')
  await dialog.getByRole('button', { name: 'Lưu số đếm', exact: true }).click()
  await expect(count).toBeDisabled()
  await dialog.getByRole('button', { name: 'Đọc lại phiếu', exact: true }).click()
  await expect(count).toBeEnabled()
  await expect(count).toHaveValue('0.1234')
  await expect(dialog.getByRole('table')).toContainText('-1,1111')
  expect(writes).toBe(1)
})

test('stocktake posting cannot bypass a missing saved count or failed preview', async ({ page }) => {
  await openStocktakes(page)
  let reads = 0
  let posts = 0
  await page.route('**/api/v1/inventory/stocktakes/stocktake-fixture', route => {
    reads++
    return reads === 1 ? route.fulfill({ status: 503, json: { message: 'Fixture preview unavailable' } })
      : route.fulfill({ json: envelope({ ...stocktake, items: [{ ...stocktake.items[0]!, countedQuantity: null }] }) })
  })
  await page.route('**/api/v1/inventory/stocktakes/stocktake-fixture/post', route => { posts++; return route.abort() })
  await page.getByRole('button', { name: 'Ghi sổ', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Xác nhận ghi sổ' })
  await expect(dialog.getByRole('alert')).toHaveText('Dịch vụ tạm thời không khả dụng. Vui lòng thử lại.')
  await expect(dialog.getByRole('button', { name: 'Xác nhận', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Tải lại phiếu', exact: true }).click()
  await expect(dialog.getByRole('table')).toContainText('Chưa đếm')
  await expect(dialog.getByRole('button', { name: 'Xác nhận', exact: true })).toBeDisabled()
  expect(posts).toBe(0)
})

test('stocktake preview displays exact saved variances and an unknown post reuses its key', async ({ page }, info) => {
  await openStocktakes(page)
  const bodies: Record<string, unknown>[] = []
  await page.route('**/api/v1/inventory/stocktakes/stocktake-fixture/post', route => {
    bodies.push(route.request().postDataJSON())
    return bodies.length === 1 ? route.abort() : route.fulfill({ json: envelope({ id: stocktake.id, status: 'POSTED' }) })
  })
  await page.getByRole('button', { name: 'Ghi sổ', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Xác nhận ghi sổ' })
  await expect(dialog.getByRole('table')).toContainText('1,2345')
  await expect(dialog.getByRole('table')).toContainText('0,2344')
  await expect(dialog.getByRole('table')).toContainText('-1,0001')
  await expect(dialog.getByRole('button', { name: 'Xác nhận', exact: true })).toBeEnabled()
  await expect(dialog.getByRole('cell').filter({ hasText: '-1,0001' })).toBeInViewport()
  if (info.project.name === 'desktop') await expect(dialog.getByRole('columnheader', { name: 'Sổ sách', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('stocktake-review.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(bodies).toHaveLength(2)
  expect(bodies[0]).toEqual(bodies[1])
  expect(bodies[0]).toMatchObject({ expectedCounts: [{ inventoryItemId: item.id, countedQuantity: '0.2344' }] })
})

test('reopening a stocktake does not initialize edits from cached counts', async ({ page }) => {
  await openStocktakes(page)
  let stored = stocktake
  await page.route('**/api/v1/inventory/stocktakes/stocktake-fixture', route => route.fulfill({ json: envelope(stored) }))
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: stocktake.stocktakeNumber })
  await expect(dialog.getByRole('spinbutton')).toHaveValue('0.2344')
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click()
  stored = { ...stocktake, items: [{ ...stocktake.items[0]!, countedQuantity: '0.1234' }] }
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click()
  await expect(dialog.getByRole('spinbutton')).toHaveValue('0.1234')
})

test('changed reviewed counts expose read-only recovery before a new confirmation', async ({ page }) => {
  await openStocktakes(page)
  let stored = stocktake
  const bodies: Record<string, unknown>[] = []
  await page.route('**/api/v1/inventory/stocktakes/stocktake-fixture', route => route.fulfill({ json: envelope(stored) }))
  await page.route('**/api/v1/inventory/stocktakes/stocktake-fixture/post', route => {
    bodies.push(route.request().postDataJSON())
    if (bodies.length > 1) return route.fulfill({ json: envelope({ id: stocktake.id, status: 'POSTED' }) })
    stored = { ...stocktake, items: [{ ...stocktake.items[0]!, countedQuantity: '0.1234' }] }
    return route.fulfill({ status: 409, json: { code: 'INVENTORY_STOCKTAKE_COUNTS_CHANGED', message: 'Counts changed after review' } })
  })
  await page.getByRole('button', { name: 'Ghi sổ', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Xác nhận ghi sổ' })
  await expect(dialog.getByRole('button', { name: 'Xác nhận', exact: true })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Số đếm đã thay đổi sau khi đối soát. Tải lại phiếu và xác nhận số đếm mới.')
  await dialog.getByRole('button', { name: 'Tải lại phiếu', exact: true }).click()
  await expect(dialog.getByRole('table')).toContainText('-1,1111')
  expect(bodies).toHaveLength(1)
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(bodies[1]).toMatchObject({ expectedCounts: [{ inventoryItemId: item.id, countedQuantity: '0.1234' }] })
  expect(bodies[1]?.idempotencyKey).not.toBe(bodies[0]?.idempotencyKey)
})

test('posted stocktake detail is read-only and retains the persisted adjustment', async ({ page }) => {
  await openStocktakes(page, stocktakePermissions.filter(key => key !== '/inventory_stocktakes_create'))
  await page.route('**/api/v1/inventory/stocktakes/stocktake-fixture', route => route.fulfill({ json: envelope({
    ...stocktake, status: 'POSTED', items: [{ ...stocktake.items[0]!, differenceQuantity: '-1.0001' }],
  }) }))
  await expect(page.getByRole('button', { name: 'Tạo mới', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: stocktake.stocktakeNumber })
  await expect(dialog.getByRole('table')).toContainText('-1,0001')
  await expect(dialog.getByRole('spinbutton')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Lưu số đếm', exact: true })).toHaveCount(0)
})

test('receipt cache cannot hide a stocktake read failure with the same document ID', async ({ page }) => {
  await mockInventory(page, [...permissions, ...stocktakePermissions])
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click()
  await expect(page.getByRole('dialog', { name: receipt.receiptNumber })).toBeVisible()
  await page.getByRole('dialog', { name: receipt.receiptNumber }).getByRole('button', { name: 'Đóng', exact: true }).click()
  await page.route('**/api/v1/inventory/stocktakes?**', route => route.fulfill({ json: envelope(paginated([{ ...stocktake, id: receipt.id }])) }))
  await page.route(`**/api/v1/inventory/stocktakes/${receipt.id}`, route => route.fulfill({ status: 503, json: { message: 'Fixture stocktake read unavailable' } }))
  await page.getByRole('button', { name: 'Kiểm kê', exact: true }).click()
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Chi tiết chứng từ' }).getByRole('alert')).toHaveText('Dịch vụ tạm thời không khả dụng. Vui lòng thử lại.')
})
