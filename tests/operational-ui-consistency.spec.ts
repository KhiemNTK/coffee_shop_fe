import { expect, test, type Page } from '@playwright/test'
import type { QueryClient } from '@tanstack/react-query'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

test.use({ timezoneId: 'America/Los_Angeles' })

const timestamp = '2026-10-22T02:00:45Z'
const sessionId = '91000000-0000-4000-8000-000000000001'
const category = { id: '91000000-0000-4000-8000-000000000002', name: 'Coffee' }
const device = { id: 'printer1', name: 'Quầy thu ngân', type: 'RECEIPT', paperSize: '80mm',
  isActive: true, isDefault: true, status: 'READY', isOnline: true,
  lastSeenAt: timestamp, createdAt: timestamp, updatedAt: timestamp }
const job = { id: 'job001', type: 'RECEIPT', status: 'PRINTED', copies: 1, attempts: 1,
  maxAttempts: 3, createdAt: timestamp, updatedAt: timestamp, deviceId: device.id }
const paged = (list: unknown[], page = 1, totalPages = 1) => ({ list, currentPage: page, totalPages, totalItems: totalPages > 1 ? 21 : list.length })

async function staff(page: Page, permissions: string[]) {
  await page.route('**/api/v1/**', route => route.fulfill({ status: 503 }))
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: envelope(defaultMockAdminEmployee) }))
  await page.route('**/api/v1/auth/me/permissions', route => route.fulfill({ json: envelope(defaultMockAdminAuth(permissions)) }))
}

test('date formatting keeps store time, seconds, language and invalid-date fallbacks', async ({ page }) => {
  await staff(page, [])
  await page.goto('/')
  const result = await page.evaluate(async (iso) => {
    const formatPath = '/src/shared/lib/format.ts'
    const languagePath = '/src/shared/i18n/index.ts'
    const { formatDate, formatDateTime } = await import(formatPath) as typeof import('../src/shared/lib/format.js')
    const { changeLanguage } = await import(languagePath) as typeof import('../src/shared/i18n/index.js')
    await changeLanguage('vi')
    const vi = formatDateTime(iso, { seconds: true })
    const minute = formatDateTime(iso)
    await changeLanguage('en')
    return { vi, minute, en: formatDateTime(iso, { seconds: true }), date: formatDate(iso),
      missing: formatDateTime(null), invalid: formatDateTime(new Date('invalid')), invalidText: formatDateTime('invalid') }
  }, timestamp)
  expect(result.vi).toContain('09:00:45')
  expect(result.vi).toContain('22/10/2026')
  expect(result.minute).toContain('09:00')
  expect(result.minute).not.toContain('09:00:45')
  expect(result.en).toBe('22/10/2026, 09:00:45')
  expect(result.date).toBe('22/10/2026')
  expect(result.missing).toBe('—')
  expect(result.invalid).toBe('—')
  expect(result.invalidText).toBe('invalid')
})

test('POS debounces a typing burst without fetching the old term after a page reset', async ({ page }) => {
  await page.clock.install()
  await staff(page, ['/orders_sessions_read', '/orders_items_create'])
  await page.route(`**/api/v1/orders/sessions/${sessionId}`, route => route.fulfill({ json: envelope({
    id: sessionId, sessionStatus: 'ACTIVE', createdAt: timestamp, table: null,
    employee: defaultMockAdminEmployee, orderItems: [],
  }) }))
  await page.route('**/api/v1/menu/public/categories', route => route.fulfill({ json: envelope([category]) }))
  const queries: Array<{ keyword: string; page: number }> = []
  await page.route('**/api/v1/menu/public/items?*', route => {
    const params = new URL(route.request().url()).searchParams
    const query = { keyword: params.get('keyword') ?? '', page: Number(params.get('page')) }
    queries.push(query)
    return route.fulfill({ json: envelope(paged([{ id: category.id, name: `Coffee ${query.keyword || 'default'}`,
      price: '35000', category, optionGroups: [] }], query.page, 2)) })
  })
  await page.goto(`/staff/pos/sessions/${sessionId}`)
  await expect(page.getByRole('button', { name: /Coffee default/ })).toBeVisible()
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect.poll(() => queries.at(-1)?.page).toBe(2)
  await page.clock.runFor(31_000)
  const originalPageReads = queries.filter(query => query.keyword === '' && query.page === 1).length
  const search = page.getByRole('searchbox', { name: 'Tìm món nhanh…' })
  await search.fill('cà')
  await expect(page.getByRole('button', { name: /Coffee default/ })).toHaveCount(0)
  await page.clock.runFor(120)
  await search.fill('cà ph')
  await page.clock.runFor(120)
  await search.fill('  cà phê  ')
  expect(queries.filter(query => query.keyword)).toEqual([])
  await page.clock.runFor(350)
  await expect(page.getByRole('button', { name: /Coffee cà phê/ })).toBeVisible()
  expect(queries.filter(query => query.keyword)).toEqual([{ keyword: 'cà phê', page: 1 }])
  expect(queries.filter(query => query.keyword === '' && query.page === 1)).toHaveLength(originalPageReads)
})

test('printing uses store time and translated pagination without losing seconds after a language switch', async ({ page }, info) => {
  await staff(page, ['/print-devices_read', '/print-jobs_read'])
  await page.route('**/api/v1/printing/devices?*', route => route.fulfill({ json: envelope(paged([device])) }))
  const pages: number[] = []
  await page.route('**/api/v1/printing/jobs?*', route => {
    const currentPage = Number(new URL(route.request().url()).searchParams.get('page'))
    pages.push(currentPage)
    return route.fulfill({ json: envelope(paged([job], currentPage, 2)) })
  })
  await page.goto('/staff/printing')
  await expect(page.getByText(/^09:00:45.*22\/10\/2026$/)).toBeVisible()
  await page.getByRole('combobox', { name: 'Ngôn ngữ', exact: true }).selectOption('en')
  await expect(page.getByText('22/10/2026, 09:00:45', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Hàng đợi Lệnh in', exact: true }).click()
  const pagination = page.getByRole('navigation', { name: 'Pagination', exact: true })
  await expect(page.getByText('Page 1 / 2 · 21 records', { exact: true })).toBeVisible()
  await expect(pagination.getByRole('button', { name: 'Previous page' })).toBeDisabled()
  const next = pagination.getByRole('button', { name: 'Next page' })
  await expect(next).toBeEnabled()
  const previousReads = pages.length
  await next.click()
  await expect(pagination.getByText('2 / 2', { exact: true })).toBeVisible()
  await expect(pagination.getByRole('button', { name: 'Next page' })).toBeDisabled()
  expect(pages.slice(previousReads)).toEqual([2])
  await expect(page.getByText('Page 2 / 2 · 21 records')).toBeVisible()
  const keys = await page.evaluate(async () => {
    const path = '/src/shared/api/query-client.ts'
    const { queryClient } = await import(path) as { queryClient: QueryClient }
    return queryClient.getQueryCache().getAll().map(query => query.queryKey).filter(key => key.includes('printing'))
  })
  expect(keys.length).toBeGreaterThan(1)
  expect(keys.every(key => key[0] === 'private' && key[1] === defaultMockAdminEmployee.id)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('printing-pagination.png') })
})

test('reprinting invalidates the scoped queue even when its cached page is still fresh', async ({ page }) => {
  await staff(page, ['/print-jobs_read', '/receipts_reprint'])
  let created = false
  let reads = 0
  await page.route('**/api/v1/printing/jobs?*', route => {
    reads++
    return route.fulfill({ json: envelope(paged(created ? [{ ...job, id: 'job002' }, job] : [job])) })
  })
  await page.route('**/api/v1/printing/invoices/*/reprint', route => {
    created = true
    return route.fulfill({ json: envelope({ ...job, id: 'job002', status: 'PENDING' }) })
  })
  await page.goto('/staff/printing')
  await expect(page.getByText('job001', { exact: true })).toBeVisible()
  const previousReads = reads
  await page.getByRole('button', { name: 'In lại Hóa đơn', exact: true }).click()
  await page.getByLabel(/Mã Hóa đơn/i).fill('invoice1')
  await page.getByLabel(/Lý do in lại/i).fill('Khách cần thêm một bản')
  await page.getByLabel(/Lý do in lại/i).press('Enter')
  await expect(page.getByRole('status')).toContainText('Đã tạo lệnh in lại')
  await page.getByRole('button', { name: 'Hàng đợi Lệnh in', exact: true }).click()
  await expect(page.getByText('job002', { exact: true })).toBeVisible()
  expect(reads).toBeGreaterThan(previousReads)
})

test('audit Today uses the store day and keeps pagination and dates reactive to language', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-22T03:00:00Z'))
  await staff(page, ['/audit-logs_read'])
  const queries: URLSearchParams[] = []
  await page.route('**/api/v1/audit-logs?*', route => {
    const params = new URL(route.request().url()).searchParams
    queries.push(params)
    return route.fulfill({ json: envelope(paged([{ id: 'log1', actionType: 'EMPLOYEE_UPDATED',
      createdAt: timestamp, employee: null }], Number(params.get('page')), 2)) })
  })
  await page.goto('/staff/audit-logs')
  await page.getByRole('button', { name: 'Hôm nay', exact: true }).click()
  await expect.poll(() => queries.at(-1)?.get('from')).toBe('2026-10-21T17:00:00.000Z')
  expect(queries.at(-1)?.get('to')).toBe('2026-10-22T03:00:00.000Z')
  await page.getByRole('combobox', { name: 'Ngôn ngữ', exact: true }).selectOption('en')
  await expect(page.getByText('22/10/2026, 09:00', { exact: true })).toBeVisible()
  const pagination = page.getByRole('navigation', { name: 'Pagination', exact: true })
  await pagination.getByRole('button', { name: 'Next page' }).click()
  await expect(pagination.getByText('2 / 2', { exact: true })).toBeVisible()
  expect(queries.at(-1)?.get('from')).toBe('2026-10-21T17:00:00.000Z')
  expect(queries.at(-1)?.get('page')).toBe('2')
  const scoped = await page.evaluate(async () => {
    const path = '/src/shared/api/query-client.ts'
    const { queryClient } = await import(path) as { queryClient: QueryClient }
    return queryClient.getQueryCache().getAll().filter(query => query.queryKey.includes('audit-logs')).map(query => query.queryKey.slice(0, 2))
  })
  expect(scoped.every(key => key[0] === 'private' && key[1] === defaultMockAdminEmployee.id)).toBe(true)
})
