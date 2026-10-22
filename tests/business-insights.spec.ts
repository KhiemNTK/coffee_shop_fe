import { expect, test, type Page, type Route } from '@playwright/test'
import type { BusinessInsight, BusinessInsightRequest } from '../src/features/reports/business-insights.api.js'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const now = '2026-10-10T05:00:00.000Z'
const id = 'a'.repeat(64)
const permissions = ['/reports_read', '/reports_insights_generate']
const tab = (page: Page) => page.getByRole('tab', { name: 'Phân tích kinh doanh', exact: true })
const panel = (page: Page) => page.getByRole('region', { name: 'Phân tích kinh doanh', exact: true })
const create = (page: Page) => panel(page).getByRole('button', { name: 'Tạo phân tích', exact: true })

function queued(body: BusinessInsightRequest): BusinessInsight {
  return {
    id, status: 'QUEUED', requestedAt: now, model: 'gemini-3.5-flash-lite', promptVersion: 'business-finance-v2',
    period: { from: body.from, to: body.to, timeZone: body.timeZone }, snapshot: null, analysis: null, errorCode: null,
  }
}
function completed(body: BusinessInsightRequest): BusinessInsight {
  const duration = Date.parse(body.to) - Date.parse(body.from)
  const offset = duration < 86_400_000 ? 86_400_000 : duration
  return {
    ...queued(body), status: 'COMPLETED',
    snapshot: {
      schemaVersion: 2,
      asOf: now,
      currentPeriod: { from: body.from, to: body.to },
      timeZone: 'Asia/Ho_Chi_Minh',
      comparisonBasis: duration < 86_400_000 ? 'PREVIOUS_DAY_SAME_WINDOW' : 'PREVIOUS_EQUAL_DURATION',
      comparisonPeriod: { from: new Date(Date.parse(body.from) - offset).toISOString(), to: new Date(Date.parse(body.to) - offset).toISOString() },
      basis: { sales: 'INVOICE_CREATED_AT', refunds: 'COHORT_REFUNDS_AS_OF_SNAPSHOT', waste: 'WASTE_CREATED_AT' },
      metrics: [
        { key: 'netReceipts', label: 'Thuc thu sau hoan tien', value: '150000.25', previousValue: '120000.10', unit: 'VND' },
        { key: 'paidInvoiceCount', label: 'Hoa don da thanh toan', value: '12', previousValue: '10', unit: 'COUNT' },
        { key: 'zeroCostSnapshotCount', label: 'Snapshot co chi phi bang khong', value: '1', previousValue: '0', unit: 'COUNT' },
        { key: 'soldItemCount', label: 'So dong mon da ban', value: '12', previousValue: '10', unit: 'COUNT' },
        { key: 'itemsWithCostSnapshot', label: 'Dong mon co snapshot chi phi', value: '11', previousValue: '10', unit: 'COUNT' },
      ],
    },
    analysis: {
      summary: '<img src=x onerror=alert(1)> **Thu ròng** chưa phải lợi nhuận.',
      findings: [
        { title: 'Thực thu cao hơn kỳ trước', kind: 'OBSERVATION', detail: 'Mô tả số liệu hệ thống.',
          metricKeys: ['netReceipts', 'paidInvoiceCount'], action: 'Đối chiếu dòng tiền.' },
        { title: 'Có thể do thay đổi nhu cầu', kind: 'HYPOTHESIS', detail: 'Chưa xác nhận nguyên nhân.',
          metricKeys: ['paidInvoiceCount'], action: 'Kiểm tra thêm dữ liệu.' },
      ],
      limitations: ['Chi phí có thể chưa đầy đủ. Không suy ra tác động nhân quả.'],
    },
  }
}

async function setup(page: Page, permissionKeys = permissions, enabled = true) {
  await page.clock.install({ time: new Date(now) })
  await page.clock.setFixedTime(new Date(now))
  await page.context().addCookies([{ name: 'csrfToken', value: 'csrf-fixture', url: 'http://localhost:4173' }])
  await page.route('**/api/v1/**', route => route.fulfill({ status: 503, json: { message: 'Unrelated fixture unavailable' } }))
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: envelope(defaultMockAdminEmployee) }))
  await page.route('**/api/v1/auth/me/permissions', route => route.fulfill({ json: envelope(defaultMockAdminAuth(permissionKeys)) }))
  await page.route('**/api/v1/reports/insights?*', route => route.fulfill({ json: envelope({ items: [], nextCursor: null }) }))
  const configCalls: string[] = []
  await page.route('**/api/v1/reports/insights/config', route => {
    configCalls.push(route.request().url())
    return route.fulfill({ json: envelope({ enabled, retentionDays: 7, maxRangeDays: 31 }) })
  })
  return configCalls
}
async function open(page: Page) {
  await page.goto('/staff/reports')
  await tab(page).click()
}

test('config is lazy; success polls to completion and preserves plain-text evidence across tabs', async ({ page }, info) => {
  const configs = await setup(page)
  let request: BusinessInsightRequest | undefined
  let polls = 0
  await page.route('**/api/v1/reports/insights', route => {
    request = route.request().postDataJSON() as BusinessInsightRequest
    expect(route.request().headers()['x-csrf-token']).toBe('csrf-fixture')
    return route.fulfill({ status: 202, json: envelope(queued(request)) })
  })
  await page.route('**/api/v1/reports/insights/' + id, route => {
    polls++
    return route.fulfill({ json: envelope(polls === 1 ? { ...queued(request!), status: 'PROCESSING' } : completed(request!)) })
  })
  await page.goto('/staff/reports')
  await expect(page.getByRole('tab', { name: 'Tổng quan tài chính' })).toHaveAttribute('aria-selected', 'true')
  expect(configs).toHaveLength(0)
  await tab(page).click()
  await create(page).click()
  await expect(panel(page).getByRole('status').filter({ hasText: 'Đang xử lý phân tích.' })).toBeVisible()
  await expect(panel(page).getByRole('button', { name: 'Đang phân tích...' })).toBeDisabled()
  await page.clock.runFor(2_100)
  await expect(panel(page).getByRole('heading', { name: 'Quan sát và giả thuyết', exact: true })).toBeVisible()
  const row = panel(page).getByRole('row').filter({ hasText: 'Thực thu sau hoàn tiền' })
  await expect(row).toContainText('150.000,25')
  await expect(row).toContainText('120.000,10')
  await expect(panel(page).getByText('Kỳ so sánh:', { exact: false })).toBeVisible()
  await expect(panel(page).getByText('Snapshot lúc:', { exact: false })).toBeVisible()
  await expect(panel(page).getByText('Giả thuyết (chưa kiểm chứng)', { exact: true })).toBeVisible()
  await expect(panel(page).getByText('Quan sát hệ thống', { exact: true })).toBeVisible()
  await expect(panel(page).getByText(/Có snapshot chi phí bằng 0/)).toBeVisible()
  await expect(panel(page).getByText(/Một số dòng món chưa có snapshot chi phí/)).toBeVisible()
  await expect(panel(page).getByText('<img src=x onerror=alert(1)> **Thu ròng** chưa phải lợi nhuận.', { exact: true })).toBeVisible()
  await expect(panel(page).locator('img, script')).toHaveCount(0)
  await expect(panel(page).getByText('Thực thu sau hoàn tiền: 150.000,25 ₫; kỳ trước: 120.000,10 ₫', { exact: true })).toBeVisible()
  await page.clock.runFor(5_000)
  expect(polls).toBe(2)
  await page.getByRole('tab', { name: 'Tổng quan tài chính' }).click()
  await tab(page).click()
  await expect(panel(page).getByRole('heading', { name: 'Quan sát và giả thuyết', exact: true })).toBeVisible()
  await page.clock.runFor(2_100)
  expect(polls).toBe(2)
  expect(request!.timeZone).toBe('Asia/Ho_Chi_Minh')
  expect(request!.clientRequestId).toMatch(/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const storage = await page.evaluate(() => JSON.stringify({ local: Object.entries(localStorage), session: Object.entries(sessionStorage) }))
  expect(storage).toContain(id)
  expect(storage).not.toContain('150000.25')
  expect(storage).not.toContain('Thực thu cao hơn kỳ trước')
  await page.screenshot({ path: info.outputPath('business-insights.png'), fullPage: true })
})

test('disabled configuration prevents generation', async ({ page }) => {
  await setup(page, permissions, false)
  let posts = 0
  await page.route('**/api/v1/reports/insights', route => { posts++; return route.abort() })
  await open(page)
  await expect(panel(page).getByText('Phân tích kinh doanh chưa được bật.', { exact: true })).toBeVisible()
  await expect(create(page)).toBeDisabled()
  expect(posts).toBe(0)
})

test('read permission exposes the tab but cannot generate', async ({ page }) => {
  await setup(page, ['/reports_read'])
  await open(page)
  await expect(panel(page).getByText('Bạn có quyền xem báo cáo nhưng không có quyền tạo phân tích.', { exact: true })).toBeVisible()
  await expect(create(page)).toBeDisabled()
})

test('removing generation permission does not block viewing or polling an owned job', async ({ page }) => {
  const currentPermissions = [...permissions]
  await setup(page, currentPermissions)
  let request: BusinessInsightRequest | undefined
  let finish = false
  await page.route('**/api/v1/reports/insights', route => {
    request = route.request().postDataJSON() as BusinessInsightRequest
    return route.fulfill({ status: 202, json: envelope(queued(request)) })
  })
  await page.route('**/api/v1/reports/insights/' + id, route => route.fulfill({ json: envelope(finish ? completed(request!) : { ...queued(request!), status: 'PROCESSING' }) }))
  await open(page)
  await create(page).click()
  await expect(panel(page).getByText('Đang xử lý phân tích.', { exact: true })).toBeVisible()
  currentPermissions.splice(1, 1)
  await page.evaluate(async () => {
    const path = '/src/app/query-client.ts'
    const { queryClient } = await import(path)
    await queryClient.invalidateQueries({ queryKey: ['private', 'session'] })
  })
  await expect(panel(page).getByText('Bạn có quyền xem báo cáo nhưng không có quyền tạo phân tích.', { exact: true })).toBeVisible()
  finish = true
  await page.clock.runFor(2_100)
  await expect(panel(page).getByRole('heading', { name: 'Quan sát và giả thuyết', exact: true })).toBeVisible()
  await expect(create(page)).toBeDisabled()
})

test('uncertain POST retries only by explicit action with the same UUID and identical payload after tab navigation', async ({ page }) => {
  await setup(page)
  const bodies: BusinessInsightRequest[] = []
  await page.route('**/api/v1/reports/insights', route => {
    const body = route.request().postDataJSON() as BusinessInsightRequest
    bodies.push(body)
    return bodies.length === 1 ? route.abort() : route.fulfill({ status: 202, json: envelope(completed(body)) })
  })
  await open(page)
  await create(page).click()
  const retry = panel(page).getByRole('button', { name: 'Gửi lại yêu cầu', exact: true })
  await expect(retry).toBeEnabled()
  await page.clock.runFor(5_000)
  expect(bodies).toHaveLength(1)
  await page.getByRole('tab', { name: 'Tổng quan tài chính' }).click()
  await tab(page).click()
  await retry.click()
  await expect(panel(page).getByRole('heading', { name: 'Quan sát và giả thuyết', exact: true })).toBeVisible()
  expect(bodies).toHaveLength(2)
  expect(bodies[1]).toEqual(bodies[0])
})

test('changing period keeps the old result labelled and a new explicit request allocates a new UUID', async ({ page }) => {
  await setup(page)
  const bodies: BusinessInsightRequest[] = []
  await page.route('**/api/v1/reports/insights', route => {
    const body = route.request().postDataJSON() as BusinessInsightRequest
    bodies.push(body)
    return route.fulfill({ status: 202, json: envelope(completed(body)) })
  })
  await open(page)
  await create(page).click()
  await expect(panel(page).getByRole('heading', { name: 'Quan sát và giả thuyết', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '7 ngày qua', exact: true }).click()
  await expect(panel(page).getByRole('heading', { name: 'Quan sát và giả thuyết', exact: true })).toBeVisible()
  await expect(panel(page).getByText('Kỳ của yêu cầu:', { exact: false })).toBeVisible()
  await create(page).click()
  await expect.poll(() => bodies.length).toBe(2)
  expect(bodies[1]!.clientRequestId).not.toBe(bodies[0]!.clientRequestId)
  expect(Date.parse(bodies[1]!.to) - Date.parse(bodies[1]!.from)).toBe(7 * 86_400_000)
})

test('a period change preserves a pending POST; immediate duplicate clicks send once', async ({ page }) => {
  await setup(page)
  const bodies: BusinessInsightRequest[] = []
  let pending: Route | undefined
  await page.route('**/api/v1/reports/insights', route => {
    const body = route.request().postDataJSON() as BusinessInsightRequest
    bodies.push(body)
    if (bodies.length === 1) { pending = route; return }
    return route.fulfill({ status: 202, json: envelope(completed(body)) })
  })
  await open(page)
  await expect(create(page)).toBeEnabled()
  await create(page).evaluate(button => {
    if (button instanceof HTMLButtonElement) { button.click(); button.click() }
  })
  await expect.poll(() => bodies.length).toBe(1)
  await expect(panel(page).getByRole('button', { name: 'Đang gửi yêu cầu...', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: '7 ngày qua', exact: true }).click()
  await pending!.fulfill({ status: 202, json: envelope(completed(bodies[0]!)) })
  await page.clock.runFor(2_100)
  await expect(panel(page).getByRole('heading', { name: 'Quan sát và giả thuyết', exact: true })).toBeVisible()
  await expect(panel(page).getByText('Kỳ của yêu cầu:', { exact: false })).toBeVisible()
  await create(page).click()
  await expect(panel(page).getByRole('heading', { name: 'Quan sát và giả thuyết', exact: true })).toBeVisible()
  expect(bodies).toHaveLength(2)
  expect(bodies[1]!.clientRequestId).not.toBe(bodies[0]!.clientRequestId)
})

test('identity changes cannot display another employee result', async ({ page }) => {
  await setup(page)
  await page.route('**/api/v1/reports/insights', route => route.fulfill({
    status: 202, json: envelope(completed(route.request().postDataJSON() as BusinessInsightRequest)),
  }))
  await open(page)
  await create(page).click()
  await expect(panel(page).getByRole('heading', { name: 'Quan sát và giả thuyết', exact: true })).toBeVisible()
  const otherId = '10000000-0000-4000-8000-000000000002'
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: envelope({ ...defaultMockAdminEmployee, id: otherId }) }))
  await page.route('**/api/v1/auth/me/permissions', route => route.fulfill({ json: envelope({ ...defaultMockAdminAuth(permissions), employeeId: otherId }) }))
  await page.evaluate(async () => {
    const path = '/src/app/query-client.ts'
    const { queryClient } = await import(path)
    await queryClient.invalidateQueries({ queryKey: ['private', 'session'] })
  })
  await expect(panel(page).getByRole('heading', { name: 'Quan sát và giả thuyết', exact: true })).toHaveCount(0)
  await expect(panel(page).getByRole('table')).toHaveCount(0)
  await expect(create(page)).toBeEnabled()
})

test('money stays exact for signed and large decimals and unknown metric labels fall back safely', async ({ page }) => {
  await setup(page)
  await page.route('**/api/v1/reports/insights', route => {
    const result = completed(route.request().postDataJSON() as BusinessInsightRequest)
    result.snapshot!.metrics[0]!.value = '-12345678901234567890.12'
    result.snapshot!.metrics[0]!.previousValue = '100000.00'
    result.snapshot!.metrics.push({ key: 'constructor', label: 'Chỉ số mới', unit: 'COUNT', value: '12345678901234567890', previousValue: '0' })
    return route.fulfill({ status: 202, json: envelope(result) })
  })
  await open(page)
  await create(page).click()
  const row = panel(page).getByRole('row').filter({ hasText: 'Thực thu sau hoàn tiền' })
  await expect(row).toContainText('-12.345.678.901.234.567.890,12')
  await expect(row).toContainText('100.000')
  await expect(panel(page).getByRole('row').filter({ hasText: 'Chỉ số mới' })).toContainText('12.345.678.901.234.567.890')
})

test('a malformed accepted POST keeps its UUID for explicit retry', async ({ page }) => {
  await setup(page)
  const bodies: BusinessInsightRequest[] = []
  await page.route('**/api/v1/reports/insights', route => {
    const body = route.request().postDataJSON() as BusinessInsightRequest
    bodies.push(body)
    const result = completed(body)
    if (bodies.length === 1) result.analysis!.findings[0]!.metricKeys = ['unknown']
    return route.fulfill({ status: 202, json: envelope(result) })
  })
  await open(page)
  await create(page).click()
  await expect(panel(page).getByRole('alert')).toContainText('Phản hồi phân tích không hợp lệ.')
  await panel(page).getByRole('button', { name: 'Gửi lại yêu cầu', exact: true }).click()
  await expect(panel(page).getByRole('heading', { name: 'Quan sát và giả thuyết', exact: true })).toBeVisible()
  expect(bodies).toHaveLength(2)
  expect(bodies[1]).toEqual(bodies[0])
})

test('polling pauses for hidden tab, background document and unmount', async ({ page }) => {
  await setup(page)
  let request: BusinessInsightRequest | undefined
  let polls = 0
  await page.route('**/api/v1/reports/insights', route => {
    request = route.request().postDataJSON() as BusinessInsightRequest
    return route.fulfill({ status: 202, json: envelope(queued(request)) })
  })
  await page.route('**/api/v1/reports/insights/' + id, route => {
    polls++
    return route.fulfill({ json: envelope({ ...queued(request!), status: 'PROCESSING' }) })
  })
  await open(page)
  await create(page).click()
  await expect(panel(page).getByText('Đang xử lý phân tích.', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Tổng quan tài chính' }).click()
  const hiddenCount = polls
  await page.clock.runFor(6_000)
  expect(polls).toBe(hiddenCount)
  await tab(page).click()
  await expect.poll(() => polls).toBeGreaterThan(hiddenCount)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  const backgroundCount = polls
  await page.clock.runFor(6_000)
  expect(polls).toBe(backgroundCount)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(() => polls).toBeGreaterThan(backgroundCount)
  await page.goto('/staff')
  const unmountedCount = polls
  await page.clock.runFor(6_000)
  expect(polls).toBe(unmountedCount)
})

test('failed job stops polling, keeps authoritative snapshot and hides safe error codes', async ({ page }) => {
  await setup(page)
  let request: BusinessInsightRequest | undefined
  let polls = 0
  await page.route('**/api/v1/reports/insights', route => {
    request = route.request().postDataJSON() as BusinessInsightRequest
    return route.fulfill({ status: 202, json: envelope(queued(request)) })
  })
  await page.route('**/api/v1/reports/insights/' + id, route => {
    polls++
    return route.fulfill({ json: envelope({ ...completed(request!), status: 'FAILED', analysis: null, errorCode: 'PROVIDER_FAILURE_FIXTURE' }) })
  })
  await open(page)
  await create(page).click()
  await expect(panel(page).getByRole('alert')).toContainText('Không thể hoàn tất phân tích.')
  await expect(panel(page).getByRole('table')).toBeVisible()
  await expect(panel(page).getByRole('heading', { name: 'Quan sát và giả thuyết', exact: true })).toHaveCount(0)
  await expect(panel(page).getByText('PROVIDER_FAILURE_FIXTURE', { exact: false })).toHaveCount(0)
  await page.clock.runFor(5_000)
  expect(polls).toBe(1)
})

for (const status of [403, 429, 503]) {
  test(`POST ${status} is generic and never automatically retried`, async ({ page }) => {
    await setup(page)
    let posts = 0
    await page.route('**/api/v1/reports/insights', route => {
      posts++
      return route.fulfill({ status, json: { code: 'PRIVATE_DETAIL', message: 'Secret provider debug fixture' } })
    })
    await open(page)
    await create(page).click()
    await expect(panel(page).getByRole('alert')).toBeVisible()
    await expect(panel(page)).not.toContainText('Secret provider debug fixture')
    await page.clock.runFor(5_000)
    expect(posts).toBe(1)
  })
}

const invalidViews: { name: string; change: (view: BusinessInsight) => unknown }[] = [
  { name: 'obsolete snapshot version', change: view => ({ ...view, snapshot: { ...view.snapshot!, schemaVersion: 1 } }) },
  { name: 'wrong comparison window', change: view => ({ ...view, snapshot: { ...view.snapshot!, comparisonPeriod: { from: view.period.from, to: view.period.to } } }) },
  { name: 'wrong current snapshot window', change: view => ({ ...view, snapshot: { ...view.snapshot!, currentPeriod: { from: '2000-01-01T00:00:00Z', to: view.period.to } } }) },
  { name: 'unknown evidence', change: view => ({ ...view, analysis: { ...view.analysis!, findings: [{ ...view.analysis!.findings[0]!, metricKeys: ['not-a-metric'] }] } }) },
  { name: 'duplicate metrics', change: view => ({ ...view, snapshot: { ...view.snapshot!, metrics: [...view.snapshot!.metrics, view.snapshot!.metrics[0]!] } }) },
  { name: 'missing previousValue', change: view => ({ ...view, snapshot: { ...view.snapshot!, metrics: view.snapshot!.metrics.map(metric => ({ key: metric.key, label: metric.label, value: metric.value, unit: metric.unit })) } }) },
  { name: 'missing comparisonPeriod', change: view => ({ ...view, snapshot: { asOf: view.snapshot!.asOf, metrics: view.snapshot!.metrics } }) },
  { name: 'missing completed analysis', change: view => ({ ...view, analysis: null }) },
  { name: 'wrong job id', change: view => ({ ...view, id: 'b'.repeat(64) }) },
  { name: 'wrong period', change: view => ({ ...view, period: { ...view.period, from: '2026-10-01T00:00:00Z' } }) },
  { name: 'empty evidence', change: view => ({ ...view, analysis: { ...view.analysis!, findings: [{ ...view.analysis!.findings[0]!, metricKeys: [] }] } }) },
  { name: 'duplicate evidence', change: view => ({ ...view, analysis: { ...view.analysis!, findings: [{ ...view.analysis!.findings[0]!, metricKeys: ['netReceipts', 'netReceipts'] }] } }) },
  { name: 'invalid money value', change: view => ({ ...view, snapshot: { ...view.snapshot!, metrics: view.snapshot!.metrics.map((metric, index) => index === 0 ? { ...metric, value: '1e6' } : metric) } }) },
  { name: 'invalid prior count', change: view => ({ ...view, snapshot: { ...view.snapshot!, metrics: [view.snapshot!.metrics[0]!, { ...view.snapshot!.metrics[1]!, previousValue: '-1' }] } }) },
  { name: 'oversized analysis', change: view => ({ ...view, analysis: { ...view.analysis!, summary: 'x'.repeat(601) } }) },
  { name: 'too many findings', change: view => ({ ...view, analysis: { ...view.analysis!, findings: Array.from({ length: 6 }, () => view.analysis!.findings[0]!) } }) },
]

test('contract accepts additional bounded metrics without changing the thirteen-metric baseline', async ({ page }) => {
  await setup(page)
  await page.route('**/api/v1/reports/insights', route => {
    const view = completed(route.request().postDataJSON() as BusinessInsightRequest)
    view.snapshot!.metrics.push(...Array.from({ length: 10 }, (_, index) => ({ key: 'newMetric' + index, label: 'Chỉ số mở rộng ' + index, unit: 'COUNT' as const, value: '1', previousValue: '0' })))
    return route.fulfill({ status: 202, json: envelope(view) })
  })
  await open(page)
  await create(page).click()
  await expect(panel(page).getByRole('row').filter({ hasText: 'Chỉ số mở rộng 9' })).toBeVisible()
})

test('reload recovers an accepted job using GET only and never persists business results', async ({ page }) => {
  await setup(page)
  let body: BusinessInsightRequest | undefined
  let posts = 0
  await page.route('**/api/v1/reports/insights', route => {
    posts++
    body = route.request().postDataJSON() as BusinessInsightRequest
    return route.fulfill({ status: 202, json: envelope(queued(body)) })
  })
  await page.route('**/api/v1/reports/insights/' + id, route => route.fulfill({ json: envelope(completed(body!)) }))
  await open(page)
  await create(page).click()
  await expect(panel(page).getByRole('table')).toBeVisible()
  await page.reload()
  await tab(page).click()
  await expect(panel(page).getByRole('table')).toBeVisible()
  expect(posts).toBe(1)
  const stored = await page.evaluate(() => JSON.stringify(Object.entries(sessionStorage)))
  expect(stored).toContain(id)
  expect(stored).not.toContain('150000.25')
})

test('reload after an uncertain POST preserves its UUID and needs explicit retry', async ({ page }) => {
  await setup(page)
  const bodies: BusinessInsightRequest[] = []
  await page.route('**/api/v1/reports/insights', route => {
    const body = route.request().postDataJSON() as BusinessInsightRequest
    bodies.push(body)
    return bodies.length === 1 ? route.abort() : route.fulfill({ status: 202, json: envelope(completed(body)) })
  })
  await open(page)
  await create(page).click()
  await expect(panel(page).getByRole('alert')).toBeVisible()
  await page.clock.runFor(1_000)
  await page.reload()
  await tab(page).click()
  const retry = panel(page).getByRole('button', { name: 'Gửi lại yêu cầu', exact: true })
  await expect(retry).toBeEnabled()
  await page.clock.runFor(5_000)
  expect(bodies).toHaveLength(1)
  await retry.click()
  await expect(panel(page).getByRole('table')).toBeVisible()
  expect(bodies).toHaveLength(2)
  expect(bodies[1]).toEqual(bodies[0])
})

test('corrupt recovery data fails closed until the operator explicitly discards the reference', async ({ page }) => {
  await setup(page)
  let posts = 0
  await page.route('**/api/v1/reports/insights', route => { posts++; return route.abort() })
  await page.goto('/staff/reports')
  await page.evaluate(employeeId => sessionStorage.setItem(`coffee-shop:pending:private:intent:${employeeId}:business-insight`, '{broken'), defaultMockAdminEmployee.id)
  await page.reload()
  await tab(page).click()
  await expect(panel(page).getByRole('alert')).toContainText('Tham chiếu phân tích không đọc được')
  await expect(create(page)).toBeDisabled()
  expect(posts).toBe(0)
  await panel(page).getByRole('button', { name: 'Bỏ tham chiếu cũ', exact: true }).click()
  const confirmation = page.getByRole('dialog', { name: 'Bỏ tham chiếu phân tích?' })
  await expect(confirmation).toContainText('không hủy job')
  await confirmation.getByRole('button', { name: 'Giữ tham chiếu', exact: true }).click()
  await expect(create(page)).toBeDisabled()
  await panel(page).getByRole('button', { name: 'Bỏ tham chiếu cũ', exact: true }).click()
  await confirmation.getByRole('button', { name: 'Bỏ tham chiếu', exact: true }).click()
  await expect(create(page)).toBeEnabled()
  expect(posts).toBe(0)
})
for (const scenario of invalidViews) {
  test(`invalid contract: ${scenario.name} hides analysis and stops polling`, async ({ page }) => {
    await setup(page)
    let request: BusinessInsightRequest | undefined
    let polls = 0
    await page.route('**/api/v1/reports/insights', route => {
      request = route.request().postDataJSON() as BusinessInsightRequest
      return route.fulfill({ status: 202, json: envelope(queued(request)) })
    })
    await page.route('**/api/v1/reports/insights/' + id, route => {
      polls++
      return route.fulfill({ json: envelope(scenario.change(completed(request!))) })
    })
    await open(page)
    await create(page).click()
    await expect(panel(page).getByRole('alert')).toContainText('Phản hồi phân tích không hợp lệ.')
    await expect(panel(page).getByRole('heading', { name: 'Quan sát và giả thuyết', exact: true })).toHaveCount(0)
    await expect(panel(page).getByRole('button', { name: 'Đang phân tích...' })).toBeDisabled()
    await page.clock.runFor(5_000)
    expect(polls).toBe(1)
  })
}

test('range validation accepts exactly 31 days and rejects longer, future, empty and offsetless ranges', async ({ page }) => {
  await setup(page)
  await page.goto('/staff/reports')
  await expect(page.getByRole('tab', { name: 'Tổng quan tài chính', exact: true })).toHaveAttribute('aria-selected', 'true')
  const errors = await page.evaluate(async () => {
    const path = '/src/features/reports/business-insights.api.ts'
    const { insightRangeError } = await import(path)
    const end = '2026-10-10T05:00:00Z'
    const instant = Date.parse(end)
    return [
      insightRangeError('2026-09-09T05:00:00Z', end, instant),
      insightRangeError('2026-09-08T05:00:00Z', end, instant),
      insightRangeError(end, '2026-10-11T05:00:00Z', instant),
      insightRangeError(end, end, instant),
      insightRangeError('invalid', end, instant),
      insightRangeError('2026-10-09T05:00:00', end, instant),
    ]
  })
  expect(errors[0]).toBeNull()
  for (const error of errors.slice(1)) expect(error).toBeTruthy()
  await page.clock.setFixedTime(new Date('2026-10-09T04:00:00Z'))
  await tab(page).click()
  await expect(panel(page).getByRole('alert')).toContainText('tương lai')
  await expect(create(page)).toBeDisabled()
})

test('server history opens across sessions with GET only, paginates and labels item/category evidence', async ({ page }, info) => {
  await setup(page)
  const body: BusinessInsightRequest = { clientRequestId: '10000000-0000-4000-8000-000000000001', from: '2026-10-08T17:00:00.000Z', to: '2026-10-09T17:00:00.000Z', timeZone: 'Asia/Ho_Chi_Minh' }
  const report = completed(body)
  report.snapshot!.metrics.push(
    { key: 'item.10000000-0000-4000-8000-000000000001.sales', label: 'Món: Cà phê sữa - Doanh số trước giảm giá', value: '99000.00', previousValue: '88000.00', unit: 'VND' },
    { key: 'category.10000000-0000-4000-8000-000000000002.quantity', label: 'Danh mục: Cà phê - Số lượng bán', value: '3', previousValue: '2', unit: 'COUNT' },
  )
  const item = { id, period: report.period, status: 'COMPLETED', requestedAt: now, expiresAt: '2026-10-17T05:00:00.000Z' }
  let posts = 0
  await page.route('**/api/v1/reports/insights', route => { posts++; return route.abort() })
  await page.route('**/api/v1/reports/insights?*', route => {
    const cursor = new URL(route.request().url()).searchParams.get('cursor')
    return route.fulfill({ json: envelope({ items: cursor ? [{ ...item, id: 'b'.repeat(64) }] : [item], nextCursor: cursor ? null : id }) })
  })
  await page.route('**/api/v1/reports/insights/' + id, route => route.fulfill({ json: envelope(report) }))
  await open(page)
  const history = panel(page).getByRole('region', { name: 'Lịch sử phân tích', exact: true })
  await history.getByRole('button').filter({ hasText: 'Hoàn tất' }).click()
  await expect(panel(page).getByRole('heading', { name: 'Quan sát và giả thuyết', exact: true })).toBeVisible()
  await expect(panel(page).getByText('Kỳ của phân tích đã lưu', { exact: true })).toBeVisible()
  await panel(page).getByRole('combobox', { name: 'Nhóm chỉ số' }).selectOption('item')
  await expect(panel(page).getByRole('row').filter({ hasText: 'Món: Cà phê sữa' })).toContainText('99.000')
  await expect(panel(page).getByRole('row').filter({ hasText: 'Thực thu sau hoàn tiền' })).toHaveCount(0)
  await panel(page).getByRole('combobox', { name: 'Nhóm chỉ số' }).selectOption('category')
  await expect(panel(page).getByRole('row').filter({ hasText: 'Danh mục: Cà phê' })).toContainText('3')
  await history.getByRole('button', { name: 'Xem thêm lịch sử' }).click()
  await expect(history.getByRole('button').filter({ hasText: 'Hoàn tất' })).toHaveCount(2)
  await expect(history.getByRole('button', { name: 'Xem thêm lịch sử' })).toHaveCount(0)
  expect(posts).toBe(0)
  expect(await page.evaluate(employeeId => sessionStorage.getItem(`coffee-shop:pending:private:intent:${employeeId}:business-insight`), defaultMockAdminEmployee.id)).toBeNull()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('insight-history.png'), fullPage: true })
})

for (const allowed of [true, false]) {
  test(`copy insight ${allowed ? 'includes snapshot, evidence and hypotheses' : 'offers selectable text when clipboard is denied'}`, async ({ page }) => {
    await setup(page)
    await page.addInitScript(canCopy => {
      let content = ''
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: (text: string) => { if (!canCopy) return Promise.reject(new Error('denied')); content = text; return Promise.resolve() },
        readText: () => Promise.resolve(content),
      } })
    }, allowed)
    await page.route('**/api/v1/reports/insights', route => route.fulfill({ status: 202, json: envelope(completed(route.request().postDataJSON() as BusinessInsightRequest)) }))
    await open(page)
    await create(page).click()
    await panel(page).getByRole('button', { name: 'Sao chép nhận định', exact: true }).click()
    if (allowed) {
      await expect(panel(page).getByRole('button', { name: 'Đã sao chép nhận định' })).toBeVisible()
      const text = await page.evaluate(() => navigator.clipboard.readText())
      expect(text).toContain('Snapshot lúc:')
      expect(text).toContain('Giả thuyết (chưa kiểm chứng)')
      expect(text).toContain('150.000,25')
      expect(text).toContain('Giới hạn dữ liệu và phân tích:')
    } else {
      await expect(panel(page).getByRole('alert')).toContainText('Trình duyệt không cho phép sao chép')
      await expect(panel(page).getByRole('textbox', { name: 'Nội dung nhận định để sao chép' })).toHaveValue(/Giả thuyết \(chưa kiểm chứng\)/)
    }
    await expect(panel(page).locator('img, script')).toHaveCount(0)
  })
}

test('pending analysis has accessible reduced-motion loading without a fake percentage', async ({ page }, info) => {
  await setup(page)
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
  let body: BusinessInsightRequest
  await page.route('**/api/v1/reports/insights', route => {
    body = route.request().postDataJSON() as BusinessInsightRequest
    return route.fulfill({ status: 202, json: envelope(queued(body)) })
  })
  await page.route('**/api/v1/reports/insights/' + id, route => route.fulfill({ json: envelope(queued(body)) }))
  await open(page)
  await create(page).click()
  const skeleton = panel(page).getByLabel('Đang chuẩn bị phân tích', { exact: true })
  await expect(skeleton).toHaveAttribute('aria-busy', 'true')
  expect(await skeleton.locator('[aria-hidden="true"]').evaluate(element => getComputedStyle(element).animationName)).toBe('none')
  await expect(panel(page).getByRole('progressbar')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('insight-loading.png'), fullPage: true })
})
