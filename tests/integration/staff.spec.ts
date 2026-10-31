import { test, expect } from '../fixtures/live-backend'
import { createHash, randomUUID } from 'node:crypto'
import { request } from '@playwright/test'

test('staff paging filters all employees and printers through the actual UI and API', async ({ backend, page }, info) => {
  const { prefix, prisma, ids } = backend
  const marker = prefix + '-paged'
  const actor = await prisma.employee.findUniqueOrThrow({ where: { id: ids.employee }, select: { password: true } })
  await prisma.employee.createMany({
    data: Array.from({ length: 25 }, (_, index) => ({
      fullName: marker + '-' + index, email: marker.toLowerCase() + '-' + index + '@example.test',
      username: marker + '-' + index, password: actor.password, positionId: ids.position, isActive: false,
    }))
  })
  await prisma.printDevice.createMany({
    data: Array.from({ length: 3 }, (_, index) => ({
      name: marker + '-printer-' + index, type: 'RECEIPT' as const, paperSize: '80mm',
      apiKeyHash: createHash('sha256').update(randomUUID()).digest('hex'), isActive: false,
    }))
  })
  await page.goto('/staff/employees')
  await page.getByPlaceholder('Tìm theo tên nhân viên, username hoặc email...').fill(marker)
  await page.getByLabel('Lọc theo trạng thái').selectOption('INACTIVE')
  await page.getByLabel('Lọc theo vị trí').selectOption(ids.position)
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(20)
  const first = await page.getByRole('table').locator('tbody tr td:first-child').allTextContents()
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(5)
  const second = await page.getByRole('table').locator('tbody tr td:first-child').allTextContents()
  expect(second.every(name => !first.includes(name))).toBe(true)
  await page.screenshot({ path: info.outputPath('real-staff-paging.png') })
  const result = await page.evaluate(async ({ marker, positionId }) => {
    const employeesPath = '/src/features/employees/employees.api.ts'
    const printersPath = '/src/features/printing/printing.api.ts'
    const { getEmployees } = await import(employeesPath)
    const { printingApi } = await import(printersPath)
    const active = await getEmployees({ search: marker, isActive: true, positionId })
    const printers = await printingApi.getDevices({ keyword: marker, isActive: false, page: 2, itemPerPage: 2 })
    return { activeCount: active.totalItems, printers }
  }, { marker, positionId: ids.position })
  expect(result.activeCount).toBe(0)
  expect(result.printers).toMatchObject({ totalItems: 3, totalPages: 2, currentPage: 2 })
  expect(result.printers.list).toHaveLength(1)
  expect(result.printers.list[0]?.name).toContain(marker)
  expect(result.printers.list[0]).not.toHaveProperty('apiKeyHash')
})

test('cookie mutations require CSRF and employees without roles cannot access staff data', async ({ backend, page }) => {
  const { prefix, password, prisma, ids } = backend
  await page.goto('/staff')
  const noCsrf = await page.request.post('/api/v1/orders/sessions', { data: { tableId: null } })
  expect(noCsrf.status()).toBe(403)
  const restricted = await request.newContext({ baseURL: 'http://localhost:4174' })
  try {
    expect((await restricted.post('/api/v1/auth/sign-in', {
      data: {
        email: prefix.toLowerCase() + '-restricted@example.test', password,
      }
    })).status()).toBe(201)
    expect((await restricted.get('/api/v1/invoices')).status()).toBe(403)
    await prisma.employee.update({ where: { id: ids.restrictedEmployee }, data: { isActive: false } })
    expect((await restricted.get('/api/v1/auth/me')).status()).toBe(401)
  } finally { await restricted.dispose() }
})

test('real Google unlink requires password/CSRF and concurrent calls revoke every session once @api-only', async ({ backend }) => {
  const { prefix, password, prisma, ids } = backend
  const first = await request.newContext({ baseURL: 'http://localhost:4174' })
  const second = await request.newContext({ baseURL: 'http://localhost:4174' })
  const email = prefix.toLowerCase() + '-google@example.test'
  try {
    for (const api of [first, second]) {
      expect((await api.post('/api/v1/auth/sign-in', { data: { email, password } })).status()).toBe(201)
    }
    const profile = await first.get('/api/v1/auth/me')
    expect(await profile.json()).toMatchObject({ data: { googleLinked: true } })
    expect((await profile.json()).data).not.toHaveProperty('googleSubject')
    expect((await first.post('/api/v1/auth/google/unlink', { data: { password } })).status()).toBe(403)
    const csrf = async (api: typeof first) => {
      const cookie = (await api.storageState()).cookies.find(value => value.name === 'csrfToken')
      if (!cookie) throw new Error('Missing real CSRF cookie')
      return { 'X-CSRF-Token': cookie.value }
    }
    expect((await first.post('/api/v1/auth/google/unlink', { headers: await csrf(first), data: { password: 'incorrect' } })).status()).toBe(401)
    expect(await prisma.authSession.count({ where: { employeeId: ids.googleEmployee, revokedAt: null } })).toBe(2)
    const headers = await Promise.all([csrf(first), csrf(second)])
    const results = await Promise.all([first, second].map((api, index) => api.post('/api/v1/auth/google/unlink', {
      headers: headers[index]!, data: { password },
    })))
    const statuses = results.map(result => result.status())
    expect(statuses).toContain(201)
    expect(statuses.every(status => [201, 400, 401].includes(status))).toBe(true)
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: ids.googleEmployee } })).googleSubject).toBeNull()
    expect(await prisma.authSession.count({ where: { employeeId: ids.googleEmployee, revokedAt: null } })).toBe(0)
    expect(await prisma.actionLog.count({ where: { employeeId: ids.googleEmployee, actionType: 'GOOGLE_ACCOUNT_UNLINKED' } })).toBe(1)
    for (const api of [first, second]) expect((await api.get('/api/v1/auth/me')).status()).toBe(401)
    expect((await first.post('/api/v1/auth/sign-in', { data: { email, password } })).status()).toBe(201)
    expect(await (await first.get('/api/v1/auth/me')).json()).toMatchObject({ data: { googleLinked: false } })
    const sessions = await prisma.authSession.count({ where: { employeeId: ids.googleEmployee } })
    expect((await first.post('/api/v1/auth/google', { data: { idToken: 'g'.repeat(100) } })).status()).toBe(503)
    expect(await prisma.authSession.count({ where: { employeeId: ids.googleEmployee } })).toBe(sessions)
  } finally { await first.dispose(); await second.dispose() }
})
