import { expect, test, type Page } from '@playwright/test'
import type { QueryClient } from '@tanstack/react-query'
import { defaultMockAdminAuth, defaultMockAdminEmployee as employee, envelope } from './helpers.js'

const id = '94000000-0000-4000-8000-000000000001'
const date = '2026-11-01T01:00:00.000Z'
const paged = (list: unknown[]) => ({
  list,
  totalItems: list.length,
  totalPages: list.length ? 1 : 0,
  currentPage: 1,
})
const incident = {
  id,
  type: 'REFUND_STATE_MISMATCH',
  status: 'OPEN',
  title: 'Refund review',
  detectedAt: date,
  paymentAttemptId: id,
  paymentRefundId: id,
  resolutionNote: null,
  paymentAttempt: {
    id,
    amount: '100000',
    status: 'SUCCEEDED',
    invoiceId: id,
    merchantReference: 'PAY-001',
    provider: 'VNPAY',
    invoice: { invoiceNumber: 'INV-001', paymentStatus: 'PAID' },
    lastReconciledAt: date,
    nextReconcileAt: null,
    reconciliationAttempts: 5,
  },
  paymentRefund: {
    id,
    amount: '20000',
    status: 'REQUIRES_REVIEW',
    updatedAt: date,
    requestedById: 'another-employee',
    providerRequestId: 'REFUND-REQ-001',
    providerTransactionNo: null,
  },
}
const summary = {
  MATCHED: { count: 30, amount: '3000000' },
  UNMATCHED: { count: 2, amount: '250000' },
  MISMATCH: { count: 1, amount: '20000' },
  IGNORED: { count: 4, amount: '90000' },
}

async function auth(page: Page, permissions: string[]) {
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({ status: 503, json: { message: 'Unmocked API' } })
  )
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: envelope(employee) }))
  await page.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminAuth(permissions)) })
  )
}

test('refund incidents show the actual partial amount and record evidence without another provider refund', async ({
  page,
}, info) => {
  await auth(page, [
    '/payment-reconciliation_read',
    '/payment-reconciliation_manage',
    '/payment-refunds_read',
  ])
  let closed = false
  let review: unknown
  let refundPosts = 0
  let release!: () => void
  const responseGate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/v1/payment-attempts/*/refunds', (route) => {
    refundPosts++
    return route.abort()
  })
  await page.route('**/api/v1/payment-reconciliation/incidents?*', (route) =>
    route.fulfill({ json: envelope(paged(closed ? [] : [incident])) })
  )
  await page.route(`**/api/v1/payment-refunds/${id}/reconcile`, async (route) => {
    review = route.request().postDataJSON()
    await responseGate
    closed = true
    return route.fulfill({ json: envelope({ id, status: 'SUCCEEDED' }) })
  })
  await page.goto('/staff/reconciliation')
  const row = page.getByRole('row').filter({ hasText: 'Refund review' })
  await expect(row).toContainText('20.000')
  await expect(row).not.toContainText('100.000')
  await row.getByRole('button', { name: 'Chi tiết', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Thanh toán gốc', { exact: true })).toBeVisible()
  await dialog
    .getByLabel('Mã giao dịch hoàn tiền / mã xác nhận của cổng', { exact: true })
    .fill('VNP-REFUND-20')
  await dialog
    .getByLabel('Tham chiếu chứng từ hoặc mã hỗ trợ từ cổng', { exact: true })
    .fill('Provider support case CASE-123')
  await dialog
    .getByLabel('Nội dung đối chiếu và lý do xác nhận', { exact: true })
    .fill('Verified exact refund request and amount with provider.')
  const save = dialog.getByRole('button', { name: 'Xác nhận kết quả đối chiếu', exact: true })
  await expect(save).toBeDisabled()
  await dialog.getByRole('checkbox').check()
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('refund-review.png'), fullPage: true })
  await save.click()
  await expect(save).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  release()
  await expect(dialog).toHaveCount(0)
  expect(review).toMatchObject({
    expectedUpdatedAt: date,
    expectedAmount: '20000',
    outcome: 'SUCCEEDED',
    providerReference: 'VNP-REFUND-20',
  })
  expect(refundPosts).toBe(0)
})

test('long payment references do not expand the reconciliation column', async ({ page }, info) => {
  await auth(page, ['/payment-reconciliation_read', '/invoices_read'])
  const reference = `PA${'1234567890ABCDEF'.repeat(6)}`
  const number = `INV-${reference}`
  const title = `Payment review ${reference}`
  await page.route('**/api/v1/payment-reconciliation/incidents?*', route => route.fulfill({
    json: envelope(paged([{ ...incident, title, paymentAttempt: {
      ...incident.paymentAttempt, merchantReference: reference,
      invoice: { ...incident.paymentAttempt.invoice, invoiceNumber: number },
    } }])),
  }))
  await page.goto('/staff/reconciliation')
  const row = page.getByRole('row').filter({ hasText: title })
  await expect(row).toBeVisible()
  const cell = row.getByRole('cell').first()
  expect(await cell.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  expect((await cell.boundingBox())!.width).toBeLessThan(400)
  await row.getByRole('button', { name: 'Chi tiết', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(reference, { exact: true })).toBeVisible()
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('long-reconciliation-reference.png') })
})

test('a refund requester cannot verify their own evidence', async ({ page }) => {
  await auth(page, [
    '/payment-reconciliation_read',
    '/payment-reconciliation_manage',
    '/payment-refunds_read',
  ])
  await page.route('**/api/v1/payment-reconciliation/incidents?*', (route) =>
    route.fulfill({
      json: envelope(
        paged([
          { ...incident, paymentRefund: { ...incident.paymentRefund, requestedById: employee.id } },
        ])
      ),
    })
  )
  await page.goto('/staff/reconciliation')
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('không được tự xác nhận')
  await expect(
    page.getByRole('button', { name: 'Xác nhận kết quả đối chiếu', exact: true })
  ).toHaveCount(0)
})

test('reconciliation invalidates related financial views without touching another employee invoice cache', async ({
  page,
}) => {
  await auth(page, ['/payment-reconciliation_read'])
  await page.route('**/api/v1/payment-reconciliation/incidents?*', (route) =>
    route.fulfill({ json: envelope(paged([])) })
  )
  await page.goto('/staff/reconciliation')
  const states = await page.evaluate(async (actor) => {
    const queryPath = '/src/shared/api/query-client.ts'
    const invalidationPath = '/src/features/reconciliation/reconciliation-query.ts'
    const { queryClient } = (await import(queryPath)) as { queryClient: QueryClient }
    const { invalidateReconciliation } = (await import(invalidationPath)) as {
      invalidateReconciliation: (client: QueryClient, actor: string) => Promise<unknown>
    }
    const keys = [
      ['private', actor, 'invoice-detail', 'invoice'],
      ['private', actor, 'cash-handovers'],
      ['private', 'funds'],
      ['private', 'other-employee', 'invoice-detail', 'invoice'],
    ]
    keys.forEach((key) => queryClient.setQueryData(key, { fixture: true }))
    await invalidateReconciliation(queryClient, actor)
    return keys.map((key) => queryClient.getQueryState(key)?.isInvalidated)
  }, employee.id)
  expect(states).toEqual([true, true, true, false])
})

test('bank summary covers the whole import and status filters reach the backend', async ({
  page,
}, info) => {
  await auth(page, ['/bank-reconciliation_read'])
  const imported = {
    id,
    fundId: id,
    sourceFileName: 'mb-statement.xlsx',
    statementFrom: date,
    statementTo: date,
    createdAt: date,
    fund: { id, name: 'Bank' },
  }
  await page.route('**/api/v1/bank-reconciliation/imports?*', (route) =>
    route.fulfill({ json: envelope(paged([imported])) })
  )
  await page.route(`**/api/v1/bank-reconciliation/imports/${id}/summary`, (route) =>
    route.fulfill({ json: envelope(summary) })
  )
  const filters: string[] = []
  await page.route('**/api/v1/bank-reconciliation/entries?*', (route) => {
    filters.push(new URL(route.request().url()).searchParams.get('matchStatus') ?? '')
    return route.fulfill({ json: envelope(paged(filters.at(-1) ? [] : [{ id, externalId: 'MB-001', direction: 'CREDIT', amount: '100000', transactionDate: date,
      bankReference: 'DEPOSIT-001', description: null, matchStatus: 'MATCHED', mismatchReason: null,
      matchedHandover: { id, transferAmount: '100000', settlementStatus: 'SETTLED', settledAt: date },
    }])) })
  })
  await page.goto('/staff/reconciliation?tab=bank')
  await page.getByRole('button', { name: /mb-statement.xlsx/ }).click()
  await expect(page.getByRole('definition').filter({ hasText: '3.000.000' })).toHaveCount(1)
  await expect(page.getByText('Phiếu bàn giao đã khớp:', { exact: false })).toBeVisible()
  await page.getByLabel('Trạng thái đối chiếu', { exact: true }).selectOption('MISMATCH')
  await expect.poll(() => filters).toContain('MISMATCH')
  await expect(page.getByText('đây chưa phải đối soát toàn bộ', { exact: false })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('bank-summary.png'), fullPage: true })
})

test('Excel mapping previews data before the existing import confirmation', async ({
  page,
}, info) => {
  await auth(page, ['/bank-reconciliation_read', '/bank-reconciliation_import'])
  await page.route('**/api/v1/bank-reconciliation/imports?*', (route) =>
    route.fulfill({ json: envelope(paged([])) })
  )
  let imports = 0
  await page.route('**/api/v1/bank-reconciliation/imports', (route) => {
    imports++
    return route.abort()
  })
  await page.route('**/api/v1/bank-reconciliation/imports/preview-excel?*', (route) => {
    const options = new URL(route.request().url()).searchParams
    const data = {
      sheets: ['Transactions'],
      rowCount: 2,
      columns: ['ID', 'Date', 'Credit', 'Debit'].map((label, index) => ({
        index: index + 1,
        label,
        sample: '',
      })),
    }
    return route.fulfill({
      json: envelope(
        options.get('mode') === 'COLUMNS'
          ? data
          : {
              ...data,
              statement: {
                fundId: id,
                sourceFileName: 'mb-statement.xlsx',
                statementFrom: '2026-11-01T00:00:00+07:00',
                statementTo: '2026-11-02T00:00:00+07:00',
                entries: [
                  {
                    externalId: 'MB-001',
                    direction: 'CREDIT',
                    amount: '125000.50',
                    transactionDate: date,
                  },
                ],
              },
            }
      ),
    })
  })
  await page.goto('/staff/reconciliation?tab=bank')
  await page.getByLabel('Quỹ ngân hàng').fill(id)
  await page
    .getByLabel('Sao kê (.xlsx / JSON)')
    .setInputFiles({
      name: 'mb-statement.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('fixture: API parsing is tested on the backend'),
    })
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Đọc danh sách cột' }).click()
  await dialog.getByLabel('Mã giao dịch ngân hàng (bắt buộc)', { exact: true }).selectOption('1')
  await dialog.getByLabel('Ngày giao dịch (bắt buộc)', { exact: true }).selectOption('2')
  await dialog.getByLabel('Tiền vào', { exact: true }).selectOption('3')
  await dialog.getByLabel('Tiền ra', { exact: true }).selectOption('4')
  await dialog.getByLabel('Từ ngày (giờ Việt Nam)', { exact: true }).fill('2026-11-01')
  await dialog.getByLabel('Đến hết ngày (giờ Việt Nam)', { exact: true }).fill('2026-11-01')
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('excel-mapping.png'), fullPage: true })
  await dialog.getByRole('button', { name: 'Xem trước giao dịch', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Xác nhận nhập sao kê' })).toBeVisible()
  expect(imports).toBe(0)
})
