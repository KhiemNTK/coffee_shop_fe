import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { envelope } from './helpers.js'

// Provider fixture exercises widget lifecycle without sending credentials to a third party.
test.beforeEach(async ({ context }) => {
  await context.route(
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `window.turnstile = {
      render(element, options) {
        if (options.action !== 'login') throw new Error('Wrong action');
        const id = crypto.randomUUID(); element.dataset.widget = id;
        const verify = document.createElement('button'); verify.type = 'button'; verify.textContent = 'Verify fixture';
        verify.onclick = () => options.callback('captcha-fixture');
        const expire = document.createElement('button'); expire.type = 'button'; expire.textContent = 'Expire fixture';
        expire.onclick = () => options['expired-callback']();
        element.append(verify, expire); return id;
      },
      remove(id) { document.querySelector('[data-widget="' + id + '"]')?.replaceChildren(); }
    };`,
      }),
  )
})

const employee = {
  id: '10000000-0000-4000-8000-000000000001',
  email: 'staff@example.test',
  username: 'staff',
  fullName: 'Nguyễn Minh An',
  isActive: true,
  position: null,
}
const authorization = {
  employeeId: employee.id,
  employeeEmail: employee.email,
  roleNames: ['WAITER'],
  permissionKeys: ['/menu_read'],
}

test('Turnstile token expires and is discarded after a failed sign in', async ({
  page,
}) => {
  await page.route('**/api/v1/auth/sign-in', (route) =>
    route.fulfill({ status: 401, json: {} }),
  )
  await page.goto('/sign-in')
  const submit = page.getByRole('button', { name: 'Đăng nhập', exact: true })
  await expect(submit).toBeDisabled()
  await fillLogin(page)
  await expect(submit).toBeEnabled()
  await page.getByRole('button', { name: 'Expire fixture' }).click()
  await expect(submit).toBeDisabled()
  await page.getByRole('button', { name: 'Verify fixture' }).click()
  await submit.click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(submit).toBeDisabled()
})

test('blocked Turnstile script fails closed and can be retried', async ({
  page,
}) => {
  await page.route(
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    (route) => route.abort(),
  )
  await page.goto('/sign-in')
  await expect(page.getByRole('alert')).toContainText(
    'Chưa xác minh được bảo mật',
  )
  await expect(
    page.getByRole('button', { name: 'Đăng nhập', exact: true }),
  ).toBeDisabled()
  await page.unroute(
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
  )
  await page.getByRole('button', { name: 'Thử lại xác minh' }).click()
  await page.getByRole('button', { name: 'Verify fixture' }).click()
  await expect(
    page.getByRole('button', { name: 'Đăng nhập', exact: true }),
  ).toBeEnabled()
})

test('late private response cannot repopulate the cache after logout', async ({
  page,
  context,
}) => {
  await identity(context)
  await cookie(context)
  let reads = 0
  let released = false
  let release: () => void = () => {}
  const delayed = new Promise<void>((resolve) => {
    release = resolve
  })
  await context.route('**/api/v1/menu/items?*', async (route) => {
    reads++
    const old = !released
    if (old) await delayed
    await route.fulfill({
      json: envelope({
        list: [
          {
            id: employee.id,
            name: old ? 'Old private item' : 'New private item',
            price: 10,
            isAvailable: true,
          },
        ],
        currentPage: 1,
        totalItems: 1,
        totalPages: 1,
      }),
    })
  })
  await context.route('**/api/v1/auth/logout', (route) =>
    route.fulfill({ json: envelope({}) }),
  )
  await context.route('**/api/v1/auth/sign-in', (route) =>
    route.fulfill({ json: envelope({}) }),
  )
  await page.goto('/staff/menu')
  await expect.poll(() => reads).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  released = true
  release()
  await fillLogin(page)
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await page
    .getByRole('navigation', { name: 'Nhân viên' })
    .getByRole('link', { name: 'Thực đơn' })
    .click()
  await expect(
    page.getByRole('cell', { name: 'New private item' }),
  ).toBeVisible()
  await expect(page.getByText('Old private item')).toHaveCount(0)
})

async function cookie(context: BrowserContext, value = 'csrf-initial') {
  await context.addCookies([
    {
      name: 'csrfToken',
      value,
      url: 'http://localhost:4173',
      sameSite: 'Strict',
    },
  ])
}
async function identity(
  context: BrowserContext,
  permissionKeys = ['/menu_read'],
) {
  await context.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: envelope(employee) }),
  )
  await context.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill({ json: envelope({ ...authorization, permissionKeys }) }),
  )
}
async function fillLogin(page: Page) {
  await page.getByLabel('Email', { exact: true }).fill(employee.email)
  await page
    .getByLabel('Mật khẩu', { exact: true })
    .fill('Only-a-test-password!')
  await page.getByRole('button', { name: 'Verify fixture' }).click()
}

test('sign in, view protected menu, logout with CSRF, no tokens in storage', async ({
  page,
  context,
}, info) => {
  await identity(context)
  let signIns = 0
  await page.route('**/api/v1/auth/sign-in', async (route) => {
    signIns++
    expect(route.request().postDataJSON()).toEqual({
      email: employee.email,
      password: 'Only-a-test-password!',
      turnstileToken: 'captcha-fixture',
    })
    await cookie(context)
    await route.fulfill({
      json: envelope({
        accessToken: 'must-not-store',
        refreshToken: 'must-not-store',
      }),
    })
  })
  await page.route('**/api/v1/menu/items?*', (route) =>
    route.fulfill({
      json: envelope({
        list: [
          {
            id: employee.id,
            name: 'Cà phê sữa',
            price: 35000,
            isAvailable: false,
          },
        ],
        totalPages: 1,
        totalItems: 1,
        currentPage: 1,
      }),
    }),
  )
  await page.route('**/api/v1/auth/logout', (route) => {
    expect(route.request().method()).toBe('POST')
    expect(route.request().headers()['x-csrf-token']).toBe('csrf-initial')
    return route.fulfill({ json: envelope({ message: 'Logout success!' }) })
  })
  await page.goto('/sign-in')
  await fillLogin(page)
  await page.screenshot({
    path: info.outputPath('sign-in.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: employee.fullName }),
  ).toBeVisible()
  expect(signIns).toBe(1)
  await page.screenshot({ path: info.outputPath('staff.png'), fullPage: true })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page
    .getByRole('navigation', { name: 'Nhân viên' })
    .getByRole('link', { name: 'Thực đơn' })
    .click()
  await expect(page.getByRole('cell', { name: 'Ngừng bán' })).toBeVisible()
  expect(
    await page.evaluate(() => ({
      local: { ...localStorage },
      session: { ...sessionStorage },
    })),
  ).toEqual({ local: {}, session: {} })
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.getByText(employee.fullName)).toHaveCount(0)
})

test('concurrent 401s share one refresh and retry GET once with rotated cookie', async ({
  page,
  context,
}) => {
  await cookie(context)
  let refreshed = false
  let refreshes = 0
  await context.route('**/api/v1/auth/me', (route) =>
    route.fulfill(
      refreshed ? { json: envelope(employee) } : { status: 401, json: {} },
    ),
  )
  await context.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill(
      refreshed ? { json: envelope(authorization) } : { status: 401, json: {} },
    ),
  )
  await context.route('**/api/v1/auth/refresh', async (route) => {
    refreshes++
    expect(route.request().headers()['x-csrf-token']).toBe('csrf-initial')
    await new Promise((resolve) => setTimeout(resolve, 150))
    refreshed = true
    await cookie(context, 'csrf-rotated')
    await route.fulfill({
      json: envelope({ accessToken: 'unused', refreshToken: 'unused' }),
    })
  })
  await page.goto('/staff')
  await expect(
    page.getByRole('heading', { name: employee.fullName }),
  ).toBeVisible()
  expect(refreshes).toBe(1)
})

test('two tabs coordinate refresh using shared cookies and Web Locks', async ({
  page,
  context,
}) => {
  await cookie(context)
  let refreshed = false
  let refreshes = 0
  await context.route('**/api/v1/auth/me', (route) =>
    route.fulfill(
      refreshed ? { json: envelope(employee) } : { status: 401, json: {} },
    ),
  )
  await context.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill(
      refreshed ? { json: envelope(authorization) } : { status: 401, json: {} },
    ),
  )
  await context.route('**/api/v1/auth/refresh', async (route) => {
    refreshes++
    await new Promise((resolve) => setTimeout(resolve, 400))
    refreshed = true
    await cookie(context, 'csrf-rotated')
    await route.fulfill({ json: envelope({}) })
  })
  const other = await context.newPage()
  await Promise.all([page.goto('/staff'), other.goto('/staff')])
  await expect(
    page.getByRole('heading', { name: employee.fullName }),
  ).toBeVisible()
  await expect(
    other.getByRole('heading', { name: employee.fullName }),
  ).toBeVisible()
  expect(refreshes).toBe(1)
})

test('refresh failure goes to sign in without a refresh loop', async ({
  page,
  context,
}) => {
  await cookie(context)
  let refreshes = 0
  await context.route('**/api/v1/auth/me**', (route) =>
    route.fulfill({ status: 401, json: {} }),
  )
  await context.route('**/api/v1/auth/refresh', (route) => {
    refreshes++
    return route.fulfill({ status: 401, json: {} })
  })
  await page.goto('/staff')
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(
    page.getByRole('heading', { name: 'Đăng nhập', exact: true }),
  ).toBeVisible()
  expect(refreshes).toBe(1)
})

test('route policy denies even OWNER without permission and does not fetch protected data', async ({
  page,
  context,
}) => {
  await identity(context, [])
  await context.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill({
      json: envelope({
        ...authorization,
        roleNames: ['OWNER'],
        permissionKeys: [],
      }),
    }),
  )
  let protectedReads = 0
  await context.route('**/api/v1/menu/items?*', (route) => {
    protectedReads++
    return route.fulfill({ status: 403, json: {} })
  })
  await page.goto('/staff/menu')
  await expect(
    page.getByRole('heading', { name: 'Không có quyền truy cập' }),
  ).toBeVisible()
  expect(protectedReads).toBe(0)
})

test('server 403 does not refresh and rechecks permissions', async ({
  page,
  context,
}) => {
  await identity(context)
  let revoked = false
  let refreshes = 0
  await context.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill({
      json: envelope({
        ...authorization,
        permissionKeys: revoked ? [] : ['/menu_read'],
      }),
    }),
  )
  await context.route('**/api/v1/menu/items?*', (route) => {
    revoked = true
    return route.fulfill({ status: 403, json: {} })
  })
  await context.route('**/api/v1/auth/refresh', (route) => {
    refreshes++
    return route.fulfill({ status: 500 })
  })
  await page.goto('/staff/menu')
  await expect(
    page.getByRole('heading', { name: 'Không có quyền truy cập' }),
  ).toBeVisible()
  expect(refreshes).toBe(0)
})

test('failed logout masks private content, is not retried, and allows explicit retry', async ({
  page,
  context,
}) => {
  await identity(context)
  await cookie(context)
  let calls = 0
  await context.route('**/api/v1/auth/logout', (route) => {
    calls++
    return route.fulfill(calls === 1 ? { status: 503 } : { json: envelope({}) })
  })
  await page.goto('/staff')
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Chưa xác nhận được đăng xuất',
  )
  await expect(page.getByText(employee.fullName)).toHaveCount(0)
  expect(calls).toBe(1)
  await page.getByRole('button', { name: 'Thử lại đăng xuất' }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  expect(calls).toBe(2)
})

test('logout clears other tabs and the next employee cannot see previous cached data', async ({
  page,
  context,
}) => {
  await identity(context)
  await cookie(context)
  await context.route('**/api/v1/auth/logout', (route) =>
    route.fulfill({ json: envelope({}) }),
  )
  await page.goto('/staff')
  const other = await context.newPage()
  await other.goto('/staff')
  await expect(
    other.getByRole('heading', { name: employee.fullName }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  await expect(other).toHaveURL(/\/sign-in$/)
  await context.route('**/api/v1/auth/sign-in', (route) =>
    route.fulfill({ json: envelope({}) }),
  )
  await context.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: envelope({ ...employee, fullName: 'Trần Thu Hà' }) }),
  )
  await fillLogin(page)
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Trần Thu Hà' })).toBeVisible()
  await expect(page.getByText(employee.fullName)).toHaveCount(0)
})

test('invalid password is not retried and server internals are not shown', async ({
  page,
}) => {
  let calls = 0
  await page.route('**/api/v1/auth/sign-in', (route) => {
    calls++
    return route.fulfill({
      status: 401,
      json: { message: 'secret-stack-trace' },
      headers: { 'x-request-id': 'test-request-id' },
    })
  })
  await page.goto('/sign-in')
  await fillLogin(page)
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Thông tin đăng nhập không đúng',
  )
  await expect(page.getByText('secret-stack-trace')).toHaveCount(0)
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveValue('')
  expect(calls).toBe(1)
})

test('inactive or mismatched identity is rejected before private routes render', async ({
  page,
  context,
}) => {
  await identity(context)
  await context.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: envelope({ ...employee, isActive: false }) }),
  )
  await page.goto('/staff')
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.getByText(employee.fullName)).toHaveCount(0)
})
