import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

async function setup(page: Page, manage = true, fail: 'conflict' | 'timeout' | null = null) {
  const state = {
    version: 0,
    acceptingOrders: true,
    pausedUntil: null as string | null,
    reason: null as string | null,
  }
  const writes: Record<string, unknown>[] = []
  let reads = 0
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminEmployee) }),
  )
  await page.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill({
      json: envelope(
        defaultMockAdminAuth([
          '/online-orders_read',
          ...(manage ? ['/online-orders_manage-intake'] : []),
        ]),
      ),
    }),
  )
  await page.route('**/api/v1/online-orders/requests?*', (route) =>
    route.fulfill({ json: envelope({ list: [], totalItems: 0, totalPages: 0, currentPage: 1 }) }),
  )
  await page.route('**/api/v1/online-orders/intake', (route) => {
    if (route.request().method() === 'GET') {
      reads++
      return route.fulfill({ json: envelope(state) })
    }
    const body = route.request().postDataJSON()
    writes.push(body)
    Object.assign(state, {
      version: state.version + 1,
      acceptingOrders: body.pausedUntil === null,
      pausedUntil: body.pausedUntil,
      reason: body.reason,
    })
    if (fail && writes.length === 1) {
      if (fail === 'timeout') return route.abort()
      return route.fulfill({ status: 409, json: { code: 'ONLINE_INTAKE_CHANGED' } })
    }
    return route.fulfill({ json: envelope(state) })
  })
  await page.goto('/staff/online-orders')
  return { state, writes, reads: () => reads }
}

test('managers pause and resume intake using the current server version', async ({
  page,
}, info) => {
  const { writes } = await setup(page)
  const panel = page.getByRole('region', { name: 'Nhận đơn online', exact: true })
  await panel.getByLabel('Lý do hiển thị cho khách').fill('Bếp đang quá tải')
  await panel.getByLabel('Số phút dừng').fill('15')
  await panel.getByRole('button', { name: 'Tạm dừng', exact: true }).click()
  await expect(panel.getByRole('status')).toHaveText('Đã cập nhật trạng thái nhận đơn.')
  expect(writes[0]).toMatchObject({ expectedVersion: 0, reason: 'Bếp đang quá tải' })
  expect(Date.parse(String(writes[0]?.pausedUntil)) - Date.now()).toBeGreaterThan(14 * 60000)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('intake-paused.png'), fullPage: true })
  await panel.getByRole('button', { name: 'Nhận đơn trở lại', exact: true }).click()
  await expect(panel.getByText('Đang nhận đơn mới', { exact: true })).toBeVisible()
  expect(writes[1]).toEqual({ expectedVersion: 1, pausedUntil: null, reason: null })
})

for (const failure of ['conflict', 'timeout'] as const) {
  test(`an intake ${failure} requires a fresh read and never retries automatically`, async ({
    page,
  }) => {
    const { writes } = await setup(page, true, failure)
    const panel = page.getByRole('region', { name: 'Nhận đơn online', exact: true })
    await panel.getByLabel('Lý do hiển thị cho khách').fill('Tạm nghỉ nhận đơn')
    await panel.getByRole('button', { name: 'Tạm dừng', exact: true }).click()
    await expect(panel.getByRole('alert')).toContainText('Làm mới trạng thái')
    await expect(panel.getByRole('button', { name: 'Tạm dừng', exact: true })).toBeDisabled()
    expect(writes).toHaveLength(1)
    await panel.getByRole('button', { name: 'Làm mới', exact: true }).click()
    await panel.getByRole('button', { name: 'Nhận đơn trở lại', exact: true }).click()
    await expect(panel.getByText('Đang nhận đơn mới', { exact: true })).toBeVisible()
    expect(writes).toHaveLength(2)
    expect(writes[1]?.expectedVersion).toBe(1)
  })
}

test('staff without intake permission neither sees the controls nor requests their data', async ({
  page,
}) => {
  const { reads } = await setup(page, false)
  await expect(
    page.getByRole('heading', { name: 'Đơn mang đi (Online)', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('region', { name: 'Nhận đơn online', exact: true })).toHaveCount(0)
  expect(reads()).toBe(0)
})
