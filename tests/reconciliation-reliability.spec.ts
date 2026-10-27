import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee as employee, envelope } from './helpers.js'

const id = '94000000-0000-4000-8000-000000000001'
const attemptId = '94000000-0000-4000-8000-000000000002'
const invoiceId = '94000000-0000-4000-8000-000000000003'
const date = '2026-10-26T01:00:00.000Z'
const paged = (list: unknown[], totalItems = list.length) => ({ list, totalItems, totalPages: Math.ceil(totalItems / 20), currentPage: 1 })
const incident = { id, type: 'STALE_ATTEMPT', status: 'OPEN', title: 'Payment cần kiểm tra', detectedAt: date, paymentAttemptId: attemptId,
  paymentRefundId: null, resolutionNote: null, paymentAttempt: { id: attemptId, status: 'PENDING', amount: '125000', invoiceId, merchantReference: 'PAY-001' } }
const statement = { statementFrom: '2026-10-26T00:00:00Z', statementTo: '2026-10-27T00:00:00Z',
  entries: [{ externalId: 'BANK-001', direction: 'CREDIT', amount: '125000.50', transactionDate: date }] }
const imported = { ...statement, id, sourceFileName: 'statement.json', fundId: id, fund: { id, name: 'Bank' }, createdAt: date }

async function staff(page: Page, permissions: string[]) {
  await page.route('**/api/v1/**', route => route.fulfill({ status: 503, json: { message: 'Unmocked API' } }))
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: envelope(employee) }))
  await page.route('**/api/v1/auth/me/permissions', route => route.fulfill({ json: envelope(defaultMockAdminAuth(permissions)) }))
}
async function bank(page: Page, manage = false) {
  await staff(page, ['/bank-reconciliation_read', '/bank-reconciliation_import', ...(manage ? ['/bank-reconciliation_manage'] : [])])
  await page.route('**/api/v1/bank-reconciliation/imports?*', route => route.fulfill({ json: envelope(paged([imported])) }))
  await page.route('**/api/v1/bank-reconciliation/entries?*', route => route.fulfill({ json: envelope(paged([])) }))
  await page.goto('/staff/reconciliation?tab=bank')
}
async function preview(page: Page) {
  await page.getByLabel('Quỹ ngân hàng').fill(id)
  await page.getByLabel('Sao kê JSON').setInputFiles({ name: 'statement.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(statement)) })
  await expect(page.getByRole('dialog')).toBeVisible()
}

test('incident summary is unknown on read failure, never a healthy zero', async ({ page }) => {
  await staff(page, ['/payment-reconciliation_read'])
  await page.route('**/api/v1/payment-reconciliation/incidents?*', route => route.fulfill({ status: 503, json: { message: 'Unavailable' } }))
  await page.goto('/staff/reconciliation')
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('definition')).toHaveText('—')
})

test('incident search reaches the server and keeps its filtered total', async ({ page }) => {
  await staff(page, ['/payment-reconciliation_read'])
  const keywords: string[] = []
  await page.route('**/api/v1/payment-reconciliation/incidents?*', route => {
    const keyword = new URL(route.request().url()).searchParams.get('keyword') ?? ''
    keywords.push(keyword)
    return route.fulfill({ json: envelope(paged(keyword === 'INV-PAGE-2' ? [{ ...incident, title: 'Found outside first page' }] : [], keyword ? 1 : 41)) })
  })
  await page.goto('/staff/reconciliation')
  await expect(page.getByRole('definition')).toHaveText('41')
  await page.getByRole('textbox', { name: 'Tìm sự cố thanh toán' }).fill('INV-PAGE-2')
  await expect(page.getByText('Found outside first page')).toBeVisible()
  await expect(page.getByRole('definition')).toHaveText('1')
  expect(keywords).toContain('INV-PAGE-2')
})

test('incident details show the fresh payment state after reconciliation', async ({ page }, info) => {
  await staff(page, ['/payment-reconciliation_read', '/payment-reconciliation_manage'])
  let status = 'PENDING'
  await page.route('**/api/v1/payment-reconciliation/incidents?*', route => route.fulfill({ json: envelope(paged([{ ...incident, paymentAttempt: { ...incident.paymentAttempt, status } }])) }))
  await page.route(`**/api/v1/payment-attempts/${attemptId}/reconcile`, route => {
    status = 'SUCCEEDED'
    return route.fulfill({ json: envelope({ id: attemptId, invoiceId, provider: 'VNPAY', amount: '125000', merchantReference: 'PAY-001', status, providerCreatedAt: date, expiresAt: date, createdAt: date, updatedAt: date }) })
  })
  await page.goto('/staff/reconciliation')
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('PENDING')
  await dialog.getByRole('button', { name: 'Đối soát lại', exact: true }).click()
  await expect(dialog).toContainText('SUCCEEDED')
  await expect(dialog).not.toContainText('PENDING')
  await page.screenshot({ path: info.outputPath('fresh-incident.png') })
})

test('an uncertain incident command requires a successful fresh read before another write', async ({ page }) => {
  await staff(page, ['/payment-reconciliation_read', '/payment-reconciliation_manage'])
  await page.route('**/api/v1/payment-reconciliation/incidents?*', route => route.fulfill({ json: envelope(paged([incident])) }))
  let posts = 0
  await page.route(`**/api/v1/payment-attempts/${attemptId}/reconcile`, route => { posts++; return route.abort() })
  await page.goto('/staff/reconciliation')
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const button = dialog.getByRole('button', { name: 'Đối soát lại', exact: true })
  await button.click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(button).toBeDisabled()
  expect(posts).toBe(1)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click()
  await expect(button).toBeDisabled()
  await dialog.getByRole('button', { name: 'Đọc lại trạng thái' }).click()
  await expect(button).toBeEnabled()
})

test('lost bank import reply survives reload and recovers the original without another import', async ({ page }, info) => {
  await bank(page)
  let posts = 0
  await page.route('**/api/v1/bank-reconciliation/imports', route => { posts++; return route.abort() })
  await page.route('**/api/v1/bank-reconciliation/imports/recover', route => {
    expect(route.request().postDataJSON()).toMatchObject({ ...statement, fundId: id, sourceFileName: 'statement.json' })
    return route.fulfill({ json: envelope({ statementImport: imported, replayed: true }) })
  })
  await preview(page)
  await page.getByRole('button', { name: 'Xác nhận nhập', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Gửi lại phiếu gốc' })).toBeDisabled()
  expect(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('bank-import-recovery.png') })
  await page.reload()
  await expect(page.getByLabel('Sao kê JSON')).toBeDisabled()
  await page.getByRole('button', { name: 'Mở phiếu cần kiểm tra' }).click()
  await page.getByRole('button', { name: 'Kiểm tra phiếu đã nhập' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Đã tìm thấy phiếu gốc.', { exact: false })).toBeVisible()
  expect(posts).toBe(1)
})

test('a not-found recovery only permits resending the frozen original statement', async ({ page }) => {
  await bank(page)
  const bodies: unknown[] = []
  await page.route('**/api/v1/bank-reconciliation/imports', route => {
    bodies.push(route.request().postDataJSON())
    return bodies.length === 1 ? route.abort() : route.fulfill({ json: envelope({ statementImport: imported }) })
  })
  await page.route('**/api/v1/bank-reconciliation/imports/recover', route => route.fulfill({ status: 404, json: { code: 'BANK_IMPORT_RECOVERY_NOT_FOUND', message: 'Not found' } }))
  await preview(page)
  await page.getByRole('button', { name: 'Xác nhận nhập', exact: true }).click()
  await page.getByRole('button', { name: 'Kiểm tra phiếu đã nhập' }).click()
  await expect(page.getByRole('button', { name: 'Gửi lại phiếu gốc' })).toBeEnabled()
  await page.getByRole('button', { name: 'Gửi lại phiếu gốc' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(bodies).toHaveLength(2)
  expect(bodies[1]).toEqual(bodies[0])
})

test('storage failure sends nothing and does not trap the operator after cancelling preview', async ({ page }) => {
  await bank(page)
  let posts = 0
  await page.route('**/api/v1/bank-reconciliation/imports', route => { posts++; return route.abort() })
  await preview(page)
  await page.evaluate(() => {
    Storage.prototype.setItem = function () { throw new DOMException('Quota exceeded', 'QuotaExceededError') }
  })
  await page.getByRole('button', { name: 'Xác nhận nhập', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Chưa gửi')
  expect(posts).toBe(0)
  await page.getByRole('dialog').getByRole('button', { name: 'Hủy', exact: true }).click()
  await expect(page.getByLabel('Sao kê JSON')).toBeEnabled()
  await expect(page.getByLabel('Quỹ ngân hàng')).toBeEnabled()
})

test('bank mismatch shows its reason and can only be ignored with an explicit reason', async ({ page }, info) => {
  await bank(page, true)
  const entry = { id: attemptId, ...statement.entries[0], bankReference: 'BANK-REF', description: null, matchStatus: 'MISMATCH', mismatchReason: 'Amount does not match approved handover.' }
  await page.route('**/api/v1/bank-reconciliation/entries?*', route => route.fulfill({ json: envelope(paged([entry])) }))
  let ignored = 0
  await page.route(`**/api/v1/bank-reconciliation/entries/${attemptId}/ignore`, route => {
    ignored++
    expect(route.request().postDataJSON()).toEqual({ reason: 'Sai tham chiếu ngân hàng' })
    return route.fulfill({ json: envelope({ ...entry, matchStatus: 'IGNORED' }) })
  })
  await page.getByRole('button', { name: /statement.json/ }).click()
  await expect(page.getByText('Lý do: Amount does not match approved handover.')).toBeVisible()
  await page.screenshot({ path: info.outputPath('bank-mismatch.png'), fullPage: true })
  await page.getByRole('button', { name: 'Bỏ qua', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Xác nhận bỏ qua' })).toBeDisabled()
  await page.getByRole('dialog').getByLabel('Lý do', { exact: true }).fill('Sai tham chiếu ngân hàng')
  await page.getByRole('button', { name: 'Xác nhận bỏ qua' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(ignored).toBe(1)
})
