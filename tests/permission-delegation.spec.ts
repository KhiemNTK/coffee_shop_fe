import { expect, test, type Page } from '@playwright/test'
import {
  defaultMockAdminEmployee,
  defaultMockAdminAuth,
  envelope,
} from './helpers.js'

const targetId = '10000000-0000-4000-8000-000000000002'
const roleId = '30000000-0000-4000-8000-000000000003'
const permissions = [
  { id: 'menu', name: 'Xem thực đơn', key: '/menu_read' },
  { id: 'inventory', name: 'Xem tồn kho', key: '/inventory_read' },
  { id: 'refund', name: 'Hoàn tiền', key: '/payment-refunds_create' },
  { id: 'close', name: 'Chốt báo cáo', key: '/reports_close' },
]
const roles = [
  { id: 'owner-role', name: 'OWNER', isSystemRole: true },
  { id: roleId, name: 'Trưởng ca', isSystemRole: false },
] as const
const detail = {
  id: roleId,
  name: 'Trưởng ca',
  canManagePermissions: true,
  isSystemRole: false,
  rolePermissions: [{ permission: permissions[0] }],
}
const assignment = {
  id: targetId,
  email: 'cashier@example.test',
  fullName: 'Thu ngân',
  isActive: true,
  canManageRoles: true,
  assignableRoleIds: [roleId],
  employeeRoles: [{ role: roles[1] }],
}
const paged = (list: readonly unknown[]) => ({
  list,
  currentPage: 1,
  totalPages: 1,
  totalItems: list.length,
})

async function staff(page: Page) {
  const keys = [
    '/employees_read',
    '/employees_roles_read',
    '/employees_roles_update',
    '/roles_read',
    '/roles_permissions_read',
    '/roles_permissions_update',
    '/permissions_read',
    '/menu_read',
    '/inventory_read',
    '/payment-refunds_create',
  ]
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminEmployee) }),
  )
  await page.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminAuth(keys)) }),
  )
  await page.route('**/api/v1/employees?*', (route) =>
    route.fulfill({
      json: envelope(
        paged([
          { ...defaultMockAdminEmployee, id: targetId, fullName: 'Thu ngân' },
        ]),
      ),
    }),
  )
  await page.route('**/api/v1/roles?*', (route) =>
    route.fulfill({ json: envelope(paged(roles)) }),
  )
  await page.route('**/api/v1/permissions?*', (route) =>
    route.fulfill({ json: envelope(paged(permissions)) }),
  )
}

test('role assignment respects server-grantable IDs, not the actor role name', async ({
  page,
}) => {
  await staff(page)
  let writes = 0
  await page.route('**/api/v1/employees/*/roles', (route) => {
    if (route.request().method() !== 'GET') writes++
    return route.fulfill({ json: envelope(assignment) })
  })
  await page.goto('/staff/employees')
  await page.getByTitle('Phân quyền vai trò').click()
  await expect(page.getByRole('checkbox', { name: /OWNER/ })).toBeDisabled()
  await expect(page.getByRole('checkbox', { name: /Trưởng ca/ })).toBeEnabled()
  expect(writes).toBe(0)
})

test('protected accounts are read-only and missing delegation metadata fails closed', async ({
  page,
}) => {
  await staff(page)
  let missing = false
  let writes = 0
  await page.route('**/api/v1/employees/*/roles', (route) => {
    if (route.request().method() !== 'GET') writes++
    const body = missing
      ? {
          id: targetId,
          email: assignment.email,
          fullName: 'Thu ngân',
          isActive: true,
          employeeRoles: [],
        }
      : { ...assignment, canManageRoles: false, assignableRoleIds: [] }
    return route.fulfill({ json: envelope(body) })
  })
  await page.goto('/staff/employees')
  await page.getByTitle('Phân quyền vai trò').click()
  await expect(
    page.getByText('Không được thay đổi vai trò của tài khoản này.'),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Lưu vai trò', exact: true }),
  ).toBeDisabled()
  await page.keyboard.press('Escape')
  missing = true
  await page.getByTitle('Phân quyền vai trò').click()
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Lưu vai trò', exact: true }),
  ).toBeDisabled()
  expect(writes).toBe(0)
})

test('permission groups preserve selections during search and confirm sensitive changes', async ({
  page,
}, info) => {
  await staff(page)
  const writes: string[][] = []
  await page.route('**/api/v1/roles/*/permissions', (route) => {
    if (route.request().method() === 'PUT') {
      writes.push(route.request().postDataJSON().permissionIds)
      return route.fulfill({ json: envelope({ success: true }) })
    }
    return route.fulfill({ json: envelope(detail) })
  })
  await page.goto('/staff/employees')
  await page.getByRole('button', { name: /Vai trò & Quyền hạn/ }).click()
  await page.getByRole('button', { name: 'Phân quyền', exact: true }).click()
  await expect(
    page.getByRole('group', { name: 'Thực đơn & khuyến mãi' }),
  ).toBeVisible()
  await expect(
    page.getByRole('group', { name: 'Thanh toán', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('checkbox', { name: /Chốt báo cáo/ }),
  ).toBeDisabled()
  await page.getByRole('checkbox', { name: /Xem tồn kho/ }).check()
  await page.getByLabel('Tìm quyền').fill('Hoàn tiền')
  await page.getByRole('checkbox', { name: /Hoàn tiền/ }).check()
  await page.getByLabel('Tìm quyền').clear()
  await expect(
    page.getByRole('checkbox', { name: /Xem tồn kho/ }),
  ).toBeChecked()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: info.outputPath('permission-groups.png'),
    fullPage: true,
  })
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Lưu danh sách quyền' }).click()
  expect(writes).toHaveLength(0)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Lưu danh sách quyền' }).click()
  await expect(
    page.getByText('Đã cập nhật danh sách quyền cho vai trò'),
  ).toBeVisible()
  expect(writes).toEqual([['menu', 'inventory', 'refund']])
})

test('an uncertain permission write requires a fresh read before another command', async ({
  page,
}) => {
  await staff(page)
  let writes = 0
  await page.route('**/api/v1/roles/*/permissions', (route) => {
    if (route.request().method() === 'PUT') {
      writes++
      return route.fulfill({
        status: 503,
        json: { message: 'Uncertain permission write' },
      })
    }
    return route.fulfill({
      json: envelope({ ...detail, canManagePermissions: writes === 0 }),
    })
  })
  await page.goto('/staff/employees')
  await page.getByRole('button', { name: /Vai trò & Quyền hạn/ }).click()
  await page.getByRole('button', { name: 'Phân quyền', exact: true }).click()
  await page.getByRole('checkbox', { name: /Xem tồn kho/ }).check()
  await page.getByRole('button', { name: 'Lưu danh sách quyền' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Dịch vụ tạm thời không khả dụng',
  )
  await expect(
    page.getByRole('button', { name: 'Lưu danh sách quyền' }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Đối chiếu quyền' }).click()
  await expect(
    page.getByText('Không được thay đổi quyền của vai trò này.'),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Lưu danh sách quyền' }),
  ).toBeDisabled()
  expect(writes).toBe(1)
})

test('read-only staff can inspect system role templates without permission-catalog access', async ({
  page,
}) => {
  await staff(page)
  await page.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill({
      json: envelope(
        defaultMockAdminAuth(['/roles_read', '/roles_permissions_read']),
      ),
    }),
  )
  let catalogReads = 0
  await page.route('**/api/v1/permissions?*', (route) => {
    catalogReads++
    return route.fulfill({ status: 403, json: { message: 'Forbidden' } })
  })
  await page.route('**/api/v1/roles/*/permissions', (route) =>
    route.fulfill({
      json: envelope({
        ...detail,
        id: roles[0].id,
        name: 'OWNER',
        isSystemRole: true,
        canManagePermissions: false,
      }),
    }),
  )
  await page.goto('/staff/employees')
  await page
    .getByRole('button', { name: 'Xem quyền', exact: true })
    .first()
    .click()
  await expect(
    page.getByRole('heading', { name: 'Quyền của vai trò: OWNER' }),
  ).toBeVisible()
  await expect(
    page.getByRole('checkbox', { name: /Xem thực đơn/ }),
  ).toBeChecked()
  await expect(
    page.getByRole('checkbox', { name: /Xem thực đơn/ }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Lưu danh sách quyền' }),
  ).toBeDisabled()
  expect(catalogReads).toBe(0)
})

test('OWNER assignment requires confirmation and a failed write requires role reconciliation', async ({
  page,
}) => {
  await staff(page)
  let writes = 0
  await page.route('**/api/v1/employees/*/roles', (route) => {
    if (route.request().method() === 'PUT') {
      writes++
      return route.fulfill({
        status: 503,
        json: { message: 'Unknown commit result' },
      })
    }
    return route.fulfill({
      json: envelope({
        ...assignment,
        canManageRoles: writes === 0,
        assignableRoleIds: roles.map((role) => role.id),
      }),
    })
  })
  await page.goto('/staff/employees')
  await page.getByTitle('Phân quyền vai trò').click()
  await page.getByRole('checkbox', { name: /OWNER/ }).check()
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Lưu vai trò', exact: true }).click()
  expect(writes).toBe(0)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Lưu vai trò', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Đối chiếu vai trò' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Lưu vai trò', exact: true }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Đối chiếu vai trò' }).click()
  await expect(
    page.getByText('Không được thay đổi vai trò của tài khoản này.'),
  ).toBeVisible()
  expect(writes).toBe(1)
})
