import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'
import { isValidPhone, normalizePhone } from '../src/shared/lib/phone.js'
import { tableAvailabilityKey } from '../src/features/reservations/reservation-availability.js'
import en from '../src/shared/i18n/locales/en.js'

const role = {
  id: '31000000-0000-4000-8000-000000000001',
  name: 'Evening team',
  description: 'Original',
  isSystemRole: false,
  updatedAt: '2026-10-01T00:00:00.000Z',
}
const table = { id: '32000000-0000-4000-8000-000000000001', name: 'Window 01', status: 'EMPTY' }
const reservation = {
  id: 101,
  customerName: 'Nguyễn An',
  phoneNumber: '0900000000',
  startsAt: '2099-01-01T10:00:00.000Z',
  endsAt: '2099-01-01T11:00:00.000Z',
  guestCount: 2,
  status: 'PENDING',
  tableId: table.id,
  table,
  updatedAt: role.updatedAt,
}
const permissions = [
  '/roles_read',
  '/roles_update',
  '/roles_permissions_read',
  '/roles_permissions_update',
  '/permissions_read',
  '/reservations_read',
  '/reservations_update',
  '/dining-tables_read',
]
const permission = {
  id: '33000000-0000-4000-8000-000000000001',
  name: 'Read reservations',
  key: '/reservations_read',
}
const paged = (list: unknown[]) => ({
  list,
  totalItems: list.length,
  totalPages: list.length ? 1 : 0,
  currentPage: 1,
})

async function staff(page: Page) {
  await page.addInitScript(() => localStorage.setItem('coffee_shop_language', 'en'))
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({ status: 503, json: { message: 'Unmocked API' } }),
  )
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminEmployee) }),
  )
  await page.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminAuth(permissions)) }),
  )
  await page.route('**/api/v1/roles?*', (route) => route.fulfill({ json: envelope(paged([role])) }))
  await page.route('**/api/v1/permissions?*', (route) =>
    route.fulfill({ json: envelope(paged([permission])) }),
  )
  await page.route('**/api/v1/roles/*/permissions', (route) =>
    route.fulfill({ json: envelope({ ...role, canManagePermissions: true, rolePermissions: [] }) }),
  )
  await page.route('**/api/v1/dining-tables', (route) => route.fulfill({ json: envelope([table]) }))
  await page.route('**/api/v1/reservations?*', (route) =>
    route.fulfill({ json: envelope(paged([reservation])) }),
  )
  await page.route('**/api/v1/reservations/101', (route) =>
    route.fulfill({ json: envelope(reservation) }),
  )
  await page.route('**/api/v1/reservations/requests?*', (route) =>
    route.fulfill({ json: envelope(paged([])) }),
  )
}

test('phone and availability identity reject malformed or stale inputs', () => {
  expect(normalizePhone('+84 (912) 345-678')).toBe('+84912345678')
  expect(isValidPhone('+84 (912) 345-678')).toBe(true)
  for (const invalid of ['++++++++', '12+3456789', '+1234567890123456', '1234567', '09000x0000'])
    expect(isValidPhone(invalid)).toBe(false)
  const window = { startsAt: reservation.startsAt, endsAt: reservation.endsAt }
  const key = tableAvailabilityKey(window, table.id, 101)
  expect(tableAvailabilityKey(null, table.id)).toBeNull()
  expect(tableAvailabilityKey(window, '')).toBeNull()
  expect(
    tableAvailabilityKey({ ...window, endsAt: '2099-01-01T12:00:00.000Z' }, table.id, 101),
  ).not.toBe(key)
  expect(tableAvailabilityKey(window, table.id, 102)).not.toBe(key)
})

test('role edits use fresh metadata, protect drafts, and require review after a conflict', async ({
  page,
}) => {
  await staff(page)
  let current = { ...role, description: 'Latest server description' }
  const patches: unknown[] = []
  await page.route('**/api/v1/roles/' + role.id, (route) => {
    if (route.request().method() === 'PATCH') {
      patches.push(route.request().postDataJSON())
      current = {
        ...current,
        description: 'Changed by another manager',
        updatedAt: '2026-10-02T00:00:00.000Z',
      }
      return route.fulfill({ status: 409, json: { code: 'ROLE_CHANGED', message: 'Conflict' } })
    }
    return route.fulfill({ json: envelope(current) })
  })
  await page.goto('/staff/employees')
  await page.getByRole('button', { name: en['roles.edit'] + ' ' + role.name, exact: true }).click()
  await expect(page.getByLabel(en['roles.description'], { exact: true })).toHaveValue(
    'Latest server description',
  )
  await page.getByLabel(en['roles.description'], { exact: true }).fill('My draft')
  await page.keyboard.press('Escape')
  const discard = page.getByRole('dialog', { name: en['common.discardTitle'] })
  await expect(discard).toBeVisible()
  await discard.getByRole('button', { name: en['common.keepEditing'] }).click()
  await expect(page.getByLabel(en['roles.description'], { exact: true })).toHaveValue('My draft')
  await page.getByRole('button', { name: en['roles.save'], exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(en['roles.changed'])
  expect(patches).toEqual([{ description: 'My draft', expectedUpdatedAt: role.updatedAt }])
  await expect(page.getByRole('button', { name: en['roles.save'], exact: true })).toBeDisabled()
  await page.getByRole('button', { name: en['roles.reloadMetadata'] }).click()
  await expect(page.getByLabel(en['roles.description'], { exact: true })).toHaveValue(
    'Changed by another manager',
  )
  await page.getByRole('button', { name: en['common.close'], exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(patches).toHaveLength(1)
})

test('permission drafts survive close and are discarded only with confirmation', async ({
  page,
}) => {
  await staff(page)
  let writes = 0
  await page.route('**/api/v1/roles/*/permissions', (route) => {
    if (route.request().method() !== 'GET') writes++
    return route.fulfill({
      json: envelope({ ...role, canManagePermissions: true, rolePermissions: [] }),
    })
  })
  await page.goto('/staff/employees')
  await page.getByRole('button', { name: en['roles.manage'], exact: true }).click()
  const checkbox = page.getByRole('checkbox', { name: /Read reservations|View reservations/ })
  // Labels come from the permission catalog, not the role name.
  await expect(checkbox).toBeEnabled()
  await checkbox.check()
  await page.getByRole('button', { name: en['common.close'], exact: true }).click()
  await page.getByRole('button', { name: en['common.keepEditing'] }).click()
  await expect(checkbox).toBeChecked()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: en['common.discardChanges'] }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(writes).toBe(0)
})

test('table checks follow the edited window, page and search without accepting an old response', async ({
  page,
}, info) => {
  await staff(page)
  let release: (() => void) | undefined
  const delayed = new Promise<void>((resolve) => {
    release = resolve
  })
  const reads: URLSearchParams[] = []
  await page.route('**/api/v1/reservations/available-tables?*', async (route) => {
    const query = new URL(route.request().url()).searchParams
    reads.push(query)
    if (query.get('endsAt')?.includes('12:00')) await delayed
    const changed = query.get('endsAt')?.includes('13:00')
    const searched = Boolean(query.get('keyword'))
    const rows = changed ? [] : query.get('page') === '2' && !query.get('tableId')
      ? [{ id: '32000000-0000-4000-8000-000000000002', name: 'Window 02' }]
      : [table]
    await route.fulfill({
      json: envelope({
        ...paged(rows),
        totalItems: searched || changed ? rows.length : 21,
        totalPages: searched || changed ? (rows.length ? 1 : 0) : 2,
        currentPage: Number(query.get('page')),
      }),
    })
  })
  await page.goto('/staff/reservations')
  await page.getByRole('button', { name: en['reservation.changeTableTime'] }).click()
  const dialog = page.getByRole('dialog')
  const save = dialog.getByRole('button', { name: en['reservation.saveChanges'] })
  await expect(save).toBeEnabled()
  expect(reads[0]?.get('excludeReservationId')).toBe('101')
  await dialog.getByRole('button', { name: en['common.nextPage'] }).click()
  await expect.poll(() => reads.some((query) => query.get('page') === '2')).toBe(true)
  await expect.poll(() => reads.some((query) => query.get('tableId') === table.id)).toBe(true)
  await expect(dialog.getByRole('combobox', { name: en['reservation.table'], exact: true })).toHaveValue(table.id)
  await dialog.getByRole('searchbox').fill('Window')
  await expect
    .poll(() =>
      reads.some((query) => query.get('keyword') === 'Window' && query.get('page') === '1'),
    )
    .toBe(true)
  await expect(save).toBeEnabled()
  await dialog.getByLabel(en['reservation.endLocal'], { exact: true }).fill('2099-01-01T19:00')
  await expect(save).toBeDisabled()
  await expect.poll(() => reads.some((query) => query.get('endsAt')?.includes('12:00'))).toBe(true)
  await dialog.getByLabel(en['reservation.endLocal'], { exact: true }).fill('2099-01-01T20:00')
  await expect(dialog.getByText(en['reservation.tableUnavailable'])).toBeVisible()
  release!()
  await expect(save).toBeDisabled()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true)
  await page.screenshot({
    path: info.outputPath('availability-' + info.project.name + '.png'),
    fullPage: true,
  })
})

test('unavailable table lookup keeps saving disabled until a successful explicit retry', async ({
  page,
}) => {
  await staff(page)
  let fail = true
  await page.route('**/api/v1/reservations/available-tables?*', (route) =>
    route.fulfill(
      fail ? { status: 503, json: { message: 'Unavailable' } } : { json: envelope(paged([table])) },
    ),
  )
  await page.goto('/staff/reservations')
  await page.getByRole('button', { name: en['reservation.changeTableTime'] }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: en['reservation.saveChanges'] })).toBeDisabled()
  await expect(dialog.getByRole('alert')).toBeVisible()
  fail = false
  await dialog.getByRole('button', { name: en['reservation.reloadTables'] }).click()
  await expect(dialog.getByRole('button', { name: en['reservation.saveChanges'] })).toBeEnabled()
})

test('reservation requests refresh automatically without changing filters or sending writes', async ({
  page,
}, info) => {
  await staff(page)
  await page.clock.install()
  let reads = 0
  let newRequest = false
  let status = ''
  await page.route('**/api/v1/reservations/requests?*', (route) => {
    reads++
    status = new URL(route.request().url()).searchParams.get('status') ?? ''
    return route.fulfill({
      json: envelope(
        paged(
          newRequest
            ? [
                {
                  ...reservation,
                  id: role.id,
                  customerName: 'New request',
                  createdAt: role.updatedAt,
                },
              ]
            : [],
        ),
      ),
    })
  })
  await page.goto('/staff/reservations')
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: en['reservation.requestTab'], exact: true }).click()
  await expect(page.getByText(en['reservation.noRequests'], { exact: true })).toBeVisible()
  const initialReads = reads
  newRequest = true
  await page.clock.runFor(20_100)
  await expect(page.getByText('New request', { exact: true })).toBeVisible()
  expect(reads).toBeGreaterThan(initialReads)
  expect(status).toBe('PENDING')
  await expect(page.getByLabel(en['reservation.requestFilterLabel'])).toHaveValue('PENDING')
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  const hiddenReads = reads
  await page.clock.runFor(40_100)
  expect(reads).toBe(hiddenReads)
})
