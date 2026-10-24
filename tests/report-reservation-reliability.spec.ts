import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const period = { from: '2026-10-24T00:00:00Z', to: '2026-10-24T02:00:00Z' }
const summary = {
  paidInvoiceCount: 0, grossSales: '0', discountAmount: '0', taxAmount: '0', netRevenue: '0',
  averageTicket: '0', cancelledItemCount: 0, wasteEntryCount: 0, closedShiftCount: 0,
  discrepantShiftCount: 0, cashShortageAmount: '0', cashOverageAmount: '0',
}
const dashboard = {
  period, summary,
  profitability: {
    asOf: period.to, paidInvoiceCount: 0, grossSales: '0', discountAmount: '0', taxAmount: '0',
    refundCount: 0, refundAmount: '0', netReceipts: '0', estimatedNetSalesExTax: '0',
    ingredientCost: '0', wasteCost: '0', estimatedGrossProfit: '0', soldItemCount: 0,
    itemsWithCostSnapshot: 0, zeroCostSnapshotCount: 0,
  },
  trend: [], paymentMethods: [], topItems: [], promotions: [], cashRisk: {},
  lowStockItems: [{ id: 'beans', name: 'Reserved coffee beans', stock: '10', reservedStock: '10', availableStock: '0', unitName: 'kg' }],
}

async function staff(page: Page, permissions = ['/reports_read']) {
  await page.route('**/api/v1/**', route => route.fulfill({ status: 503, json: { message: 'Unmocked API' } }))
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: envelope(defaultMockAdminEmployee) }))
  await page.route('**/api/v1/auth/me/permissions', route => route.fulfill({ json: envelope(defaultMockAdminAuth(permissions)) }))
  await page.route('**/api/v1/reports/dashboard?*', route => route.fulfill({ json: envelope(dashboard) }))
}

test('refresh advances the report window without fetching inactive reports and preserves threshold zero', async ({ page }, info) => {
  await page.clock.install({ time: new Date('2026-10-24T02:00:00Z') })
  await staff(page)
  const reads: URL[] = []
  let kitchenReads = 0
  await page.route('**/api/v1/reports/dashboard?*', route => {
    reads.push(new URL(route.request().url()))
    return route.fulfill({ json: envelope(dashboard) })
  })
  await page.route('**/api/v1/reports/kitchen-*', route => {
    kitchenReads++
    return route.fulfill({ status: 400, json: {} })
  })
  await page.goto('/staff/reports')
  const stock = page.getByRole('row', { name: /Reserved coffee beans/ })
  await expect(stock).toContainText('0 kg')
  await expect(stock.getByRole('cell')).toHaveCount(4)
  await page.clock.setFixedTime(new Date('2026-10-24T03:00:00Z'))
  await page.getByRole('button', { name: 'Làm mới dữ liệu', exact: true }).click()
  await expect.poll(() => reads.at(-1)?.searchParams.get('to')).toBe('2026-10-24T03:00:00.000Z')
  expect(reads.at(-1)?.searchParams.get('from')).toBe('2026-10-23T17:00:00.000Z')
  expect(kitchenReads).toBe(0)
  await page.evaluate(async () => {
    const path = '/src/features/reports/reports.api.ts'
    const api = await import(path)
    await api.getDashboardReport({ lowStockThreshold: 0 })
  })
  expect(reads.at(-1)?.searchParams.get('lowStockThreshold')).toBe('0')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('report-available-stock.png'), fullPage: true })
})

for (const canReadShifts of [false, true]) {
  test(`daily close explains blockers and respects link permissions: ${canReadShifts}`, async ({ page }) => {
    await staff(page, ['/reports_read', '/reports_close', ...(canReadShifts ? ['/cashier-shifts_read'] : [])])
    await page.route('**/api/v1/reports/daily-closes/*', route => route.fulfill({ status: 404, json: {} }))
    await page.route('**/api/v1/reports/daily-closes', route => route.fulfill({ status: 409, json: {
      data: null, code: 'DAILY_CLOSE_BLOCKED', errors: [{ message: 'Resolve unfinished operations before closing the day.' }],
      details: { blockers: { openShifts: 1, unpaidInvoices: 2, unfinishedItems: 0, uncertainPayments: 0, uncertainRefunds: 1, openIncidents: 0 } },
    } }))
    await page.goto('/staff/reports')
    await page.getByRole('tab', { name: 'Chốt sổ doanh thu ngày' }).click()
    await page.getByLabel('Ngày chốt sổ').fill('2026-10-07')
    await page.getByRole('button', { name: 'Tiến hành Chốt sổ ngày 2026-10-07' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Xác nhận Chốt sổ', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('Ca thu ngân chưa đóng: 1')
    await expect(dialog.getByRole('alert')).toContainText('Hóa đơn chưa thanh toán: 2')
    await expect(dialog.getByRole('alert')).toContainText('Hoàn tiền chưa có kết quả cuối: 1')
    await expect(dialog.getByRole('link', { name: 'Ca thu ngân chưa đóng: 1' })).toHaveCount(canReadShifts ? 1 : 0)
    await expect(dialog.getByRole('link', { name: /Hóa đơn chưa thanh toán/ })).toHaveCount(0)
  })
}

test('kitchen alerts prioritize overdue work and paginate every affected slot', async ({ page }) => {
  await staff(page)
  const slots = Array.from({ length: 12 }, (_, i) => ({
    stationId: `station-${i}`, stationName: `Trạm ${i}`, bucketStartAt: `2026-10-24T${String(i).padStart(2, '0')}:00:00Z`,
    ticketCount: 10, completedCount: 9, lateCompletedCount: 1, overdueOpenCount: i === 11 ? 4 : 0,
    lateRatePercent: '11.11', orderedUnitCount: 20,
  }))
  await page.route('**/api/v1/reports/kitchen-sla?*', route => route.fulfill({ json: envelope({ period, stations: [] }) }))
  await page.route('**/api/v1/reports/kitchen-bottlenecks?*', route => route.fulfill({ json: envelope({ period, slots }) }))
  await page.goto('/staff/reports')
  await page.getByRole('tab', { name: 'Vận hành Bếp & SLA' }).click()
  const table = page.getByRole('table').filter({ has: page.getByRole('columnheader', { name: 'Khung giờ', exact: true }) })
  await expect(table.getByRole('row').nth(1)).toContainText('Trạm 11')
  await expect(table.getByRole('row')).toHaveCount(11)
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(table.getByRole('row')).toHaveCount(3)
  await expect(table).toContainText('Trạm 0')
})

test('public tracking displays the revised approved reservation returned by the server', async ({ page }) => {
  const token = 'a'.repeat(43)
  await page.addInitScript(value => sessionStorage.setItem('coffee_shop_reservation_access_token', value), token)
  await page.route('**/api/v1/reservations/public/requests/status', route => route.fulfill({ json: envelope({
    requestId: 'request-id', status: 'APPROVED', reservationStatus: 'PENDING',
    startsAt: '2026-10-25T12:00:00Z', endsAt: '2026-10-25T13:30:00Z', guestCount: 4,
  }) }))
  await page.goto('/reservations')
  await expect(page.getByText(/19:00/)).toBeVisible()
  await expect(page.getByText('4 người', { exact: true })).toBeVisible()
})
