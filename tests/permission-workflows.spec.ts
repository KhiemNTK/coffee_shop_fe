import { expect, test } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

test('permission workflow helper requires complete grants without role or prefix bypass', async ({ page }) => {
  await page.route('**/api/v1/**', (route) => route.fulfill({ status: 503 }))
  await page.goto('/')
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite serves the browser source directly.
    const { createPermissionAccess } = await import('/src/shared/auth/permissions.ts')
    // @ts-expect-error Vite serves the browser source directly.
    const { WorkflowPermissions } = await import('/src/shared/auth/workflow-permissions.ts')
    const access = createPermissionAccess(['/orders_tables_split', '/invoices_pay', '/invoices_update', '/invoices_*'])
    const complete = createPermissionAccess(['/orders_tables_split', '/dining-tables_read'])
    return {
      missingRead: access.hasAll(...WorkflowPermissions.splitTable),
      complete: complete.hasAll(...WorkflowPermissions.splitTable),
      canPay: access.has('/invoices_pay'),
      canVoid: access.has('/invoices_void'),
      any: access.hasAny('/invoices_void', '/invoices_pay'),
      emptyAny: access.hasAny(),
      createOnlyCheckout: createPermissionAccess(['/invoices_create']).hasAll(...WorkflowPermissions.manualCheckout),
      legacyPay: createPermissionAccess(['/invoices_update']).has('/invoices_pay'),
    }
  })
  expect(result).toEqual({ missingRead: false, complete: true, canPay: true, canVoid: false, any: true, emptyAny: false, createOnlyCheckout: false, legacyPay: false })
})

test('permission workflow does not offer table actions or fetch choices without table read', async ({ page }) => {
  const id = '80000000-0000-4000-8000-000000000001'
  let tableReads = 0
  await page.route('**/api/v1/**', (route) => route.fulfill({ status: 503 }))
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: envelope(defaultMockAdminEmployee) }))
  await page.route('**/api/v1/auth/me/permissions', (route) => route.fulfill({ json: envelope(defaultMockAdminAuth([
    '/orders_sessions_read', '/orders_tables_split', '/orders_tables_merge', '/orders_tables_transfer',
  ])) }))
  await page.route('**/api/v1/orders/sessions/' + id, (route) => route.fulfill({ json: envelope({
    id, sessionStatus: 'ACTIVE', createdAt: '2026-10-21T08:00:00Z', employee: defaultMockAdminEmployee,
    table: { id, name: 'Table 1', status: 'OCCUPIED' }, orderItems: [],
  }) }))
  await page.route('**/api/v1/dining-tables', (route) => {
    tableReads++
    return route.fulfill({ status: 403 })
  })
  await page.goto('/staff/pos/sessions/' + id)
  await expect(page.getByRole('heading', { name: /Table 1/ })).toBeVisible()
  for (const name of ['Gộp bàn', 'Tách món', 'Chuyển bàn']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
  }
  expect(tableReads).toBe(0)
})
