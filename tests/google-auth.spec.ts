import { expect, test, type BrowserContext } from '@playwright/test'
import {
  defaultMockAdminAuth,
  defaultMockAdminEmployee,
  envelope,
} from './helpers.js'

const credential = 'google-fixture-' + 'a'.repeat(100)
const googleScript = 'https://accounts.google.com/gsi/client'

test.beforeEach(async ({ context }) => {
  await context.route(
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `window.turnstile = {
      render(element, options) {
        const id = crypto.randomUUID(); element.dataset.widget = id;
        element.style.width = '150px'; element.style.height = '140px';
        const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Verify fixture';
        button.onclick = () => options.callback('captcha-fixture'); element.append(button);
        window.expireFixture = options['expired-callback']; return id;
      }, remove(id) { document.querySelector('[data-widget="' + id + '"]')?.replaceChildren(); }
    };`,
      }),
  )
  await mockGoogle(context)
})

async function mockGoogle(context: BrowserContext) {
  await context.route(googleScript, (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.google = { accounts: { id: {
      initialize(options) {
        if (options.client_id !== 'browser-fixture.apps.googleusercontent.com' || options.auto_select !== false) throw new Error('Invalid GIS config');
        window.googleFixtureCallback = options.callback;
      },
      renderButton(element, options) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Google fixture';
        button.style.width = options.width + 'px'; button.style.height = '44px';
        button.onclick = () => window.googleFixtureCallback({ credential: '${credential}' }); element.append(button);
      }
    } } };`,
    }),
  )
}

async function staff(context: BrowserContext, linked = false) {
  await context.addCookies([
    {
      name: 'csrfToken',
      value: 'csrf-fixture',
      url: 'http://localhost:4173',
      sameSite: 'Strict',
    },
  ])
  await context.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      json: envelope({ ...defaultMockAdminEmployee, googleLinked: linked }),
    }),
  )
  await context.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminAuth()) }),
  )
}

test('Google login waits for CAPTCHA, submits once and never persists credentials', async ({
  page,
  context,
}, info) => {
  await staff(context)
  let calls = 0
  await context.route('**/api/v1/auth/google', async (route) => {
    calls++
    expect(route.request().postDataJSON()).toEqual({
      idToken: credential,
      turnstileToken: 'captcha-fixture',
    })
    await route.fulfill({
      json: envelope({
        accessToken: 'must-not-store',
        refreshToken: 'must-not-store',
      }),
    })
  })
  await page.goto('/sign-in')
  await expect(
    page.getByRole('button', { name: 'Google fixture' }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Verify fixture' }).click()
  const button = page.getByRole('button', { name: 'Google fixture' })
  await expect(button).toBeVisible()
  await page.screenshot({
    path: info.outputPath('google-login.png'),
    fullPage: true,
  })
  await button.evaluate((node) => {
    if (!(node instanceof HTMLButtonElement)) throw new Error('Expected button')
    node.click()
    node.click()
  })
  await expect(
    page.getByRole('heading', { name: defaultMockAdminEmployee.fullName }),
  ).toBeVisible()
  expect(calls).toBe(1)
  expect(
    await page.evaluate(() => ({
      local: { ...localStorage },
      session: { ...sessionStorage },
    })),
  ).toEqual({ local: {}, session: {} })
})

test('blocked Google script can be retried without bypassing CAPTCHA', async ({
  page,
  context,
}) => {
  await context.route(googleScript, (route) => route.abort())
  await page.goto('/sign-in')
  await page.getByRole('button', { name: 'Verify fixture' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Chưa kết nối được Google',
  )
  await context.unroute(googleScript)
  await mockGoogle(context)
  await page.getByRole('button', { name: 'Thử lại Google' }).click()
  await expect(
    page.getByRole('button', { name: 'Google fixture' }),
  ).toBeVisible()
})

test('Google failure discards consumed CAPTCHA and requires a new challenge', async ({
  page,
}) => {
  let calls = 0
  await page.route('**/api/v1/auth/google', (route) => {
    calls++
    return route.fulfill({ status: 401, json: {} })
  })
  await page.goto('/sign-in')
  await page.getByRole('button', { name: 'Verify fixture' }).click()
  await page.getByRole('button', { name: 'Google fixture' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Thông tin đăng nhập không đúng',
  )
  await expect(
    page.getByRole('button', { name: 'Google fixture' }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Đăng nhập', exact: true }),
  ).toBeDisabled()
  expect(calls).toBe(1)
  await page.getByRole('button', { name: 'Verify fixture' }).click()
  await expect(
    page.getByRole('button', { name: 'Google fixture' }),
  ).toBeVisible()
})

test('late Google callback after CAPTCHA expires cannot sign in', async ({
  page,
}) => {
  let calls = 0
  await page.route('**/api/v1/auth/google', (route) => {
    calls++
    return route.fulfill({ json: envelope({}) })
  })
  await page.goto('/sign-in')
  await page.getByRole('button', { name: 'Verify fixture' }).click()
  await expect(
    page.getByRole('button', { name: 'Google fixture' }),
  ).toBeVisible()
  await page.evaluate(() =>
    (Reflect.get(window, 'expireFixture') as () => void)(),
  )
  await expect(
    page.getByRole('button', { name: 'Google fixture' }),
  ).toHaveCount(0)
  await page.evaluate(
    (value) =>
      (
        Reflect.get(window, 'googleFixtureCallback') as (result: {
          credential: string
        }) => void
      )({ credential: value }),
    credential,
  )
  expect(calls).toBe(0)
})

test('link Google rechecks password and discards credentials after a rejected link', async ({
  page,
  context,
}) => {
  await staff(context)
  let linked = false
  let calls = 0
  await context.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      json: envelope({ ...defaultMockAdminEmployee, googleLinked: linked }),
    }),
  )
  await page.route('**/api/v1/auth/google/link', (route) => {
    calls++
    expect(route.request().headers()['x-csrf-token']).toBe('csrf-fixture')
    expect(route.request().postDataJSON()).toEqual({
      password: 'Fixture-password-123!',
      idToken: credential,
    })
    if (calls === 1) return route.fulfill({ status: 400, json: {} })
    linked = true
    return route.fulfill({ json: envelope({ linked: true }) })
  })
  await page.goto('/staff')
  const submit = page.getByRole('button', {
    name: 'Liên kết Google',
    exact: true,
  })
  await expect(submit).toBeDisabled()
  await page.getByRole('button', { name: 'Google fixture' }).click()
  await page.getByLabel('Mật khẩu hiện tại').fill('Fixture-password-123!')
  await submit.click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(submit).toBeDisabled()
  await expect(page.getByLabel('Mật khẩu hiện tại')).toHaveValue('')
  await page.getByRole('button', { name: 'Google fixture' }).click()
  await page.getByLabel('Mật khẩu hiện tại').fill('Fixture-password-123!')
  await submit.click()
  await expect(
    page.getByText('Đã liên kết tài khoản Google.', { exact: true }),
  ).toBeVisible()
  expect(calls).toBe(2)
})

for (const status of [503, 200]) {
  test(
    'uncertain unlink masks private data without retrying: HTTP ' + status,
    async ({ page, context }) => {
      await staff(context, true)
      let calls = 0
      await page.route('**/api/v1/auth/google/unlink', (route) => {
        calls++
        return route.fulfill({
          status,
          json: status === 200 ? envelope({ unlinked: false }) : {},
        })
      })
      await page.goto('/staff')
      await page.getByLabel('Mật khẩu hiện tại').fill('Fixture-password-123!')
      await page
        .getByRole('button', { name: 'Hủy liên kết và đăng xuất' })
        .click()
      await expect(page).toHaveURL(/\/sign-in$/)
      await expect(page.getByRole('alert')).toContainText(
        'Chưa xác nhận được hủy liên kết Google',
      )
      await expect(
        page.getByText(defaultMockAdminEmployee.fullName),
      ).toHaveCount(0)
      expect(calls).toBe(1)
    },
  )
}

test('successful unlink clears both tabs without retaining Google credentials', async ({
  page,
  context,
}) => {
  await staff(context, true)
  let revoked = false
  await context.route('**/api/v1/auth/me', (route) =>
    route.fulfill(
      revoked
        ? { status: 401, json: {} }
        : {
            json: envelope({ ...defaultMockAdminEmployee, googleLinked: true }),
          },
    ),
  )
  await context.route('**/api/v1/auth/refresh', (route) =>
    route.fulfill({ status: 401, json: {} }),
  )
  await page.route('**/api/v1/auth/google/unlink', (route) => {
    revoked = true
    return route.fulfill({ json: envelope({ unlinked: true }) })
  })
  await page.goto('/staff')
  const other = await context.newPage()
  await other.goto('/staff')
  await expect(
    other.getByRole('heading', { name: defaultMockAdminEmployee.fullName }),
  ).toBeVisible()
  await page.getByLabel('Mật khẩu hiện tại').fill('Fixture-password-123!')
  await page.getByRole('button', { name: 'Hủy liên kết và đăng xuất' }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(other).toHaveURL(/\/sign-in$/)
  expect(
    await page.evaluate(() => ({
      local: { ...localStorage },
      session: { ...sessionStorage },
    })),
  ).toEqual({ local: {}, session: {} })
})

for (const linked of [false, true]) {
  test(
    'wrong password does not refresh, replay or deadlock Google ' +
      (linked ? 'unlink' : 'link'),
    async ({ page, context }) => {
      await staff(context, linked)
      let calls = 0
      let refreshes = 0
      await context.route('**/api/v1/auth/refresh', (route) => {
        refreshes++
        return route.fulfill({ status: 401, json: {} })
      })
      await page.route(
        '**/api/v1/auth/google/' + (linked ? 'unlink' : 'link'),
        (route) => {
          calls++
          return route.fulfill({ status: 401, json: {} })
        },
      )
      await page.goto('/staff')
      if (!linked)
        await page.getByRole('button', { name: 'Google fixture' }).click()
      await page.getByLabel('Mật khẩu hiện tại').fill('Incorrect-password-123!')
      await page
        .getByRole('button', {
          name: linked ? 'Hủy liên kết và đăng xuất' : 'Liên kết Google',
          exact: true,
        })
        .click()
      await expect(page.getByRole('alert')).toContainText(
        'Thông tin đăng nhập không đúng',
      )
      await expect(page.getByLabel('Mật khẩu hiện tại')).toBeEnabled()
      expect(calls).toBe(1)
      expect(refreshes).toBe(0)
      await expect(page).toHaveURL(/\/staff$/)
    },
  )
}

test('queued Google unlink cannot use a session changed while waiting for the cross-tab lock', async ({
  page,
  context,
}) => {
  await staff(context, true)
  let calls = 0
  await page.route('**/api/v1/auth/google/unlink', (route) => {
    calls++
    return route.fulfill({ json: envelope({ unlinked: true }) })
  })
  let release: () => void = () => {}
  const delayed = new Promise<void>((resolve) => {
    release = resolve
  })
  await context.route('**/fixture-lock', async (route) => {
    await delayed
    await route.fulfill({ body: 'released' })
  })
  await page.goto('/staff')
  const other = await context.newPage()
  await other.goto('/staff')
  const holding = other.evaluate(async () =>
    navigator.locks.request('coffee-shop-auth', async () => {
      document.title = 'Fixture lock held'
      await fetch('/fixture-lock')
    }),
  )
  await expect(other).toHaveTitle('Fixture lock held')
  try {
    await page.getByLabel('Mật khẩu hiện tại').fill('Fixture-password-123!')
    await page
      .getByRole('button', { name: 'Hủy liên kết và đăng xuất' })
      .click()
    await expect(page.getByLabel('Mật khẩu hiện tại')).toBeDisabled()
    await context.addCookies([
      {
        name: 'csrfToken',
        value: 'csrf-new-session',
        url: 'http://localhost:4173',
        sameSite: 'Strict',
      },
    ])
  } finally {
    release()
    await holding
  }
  await expect(page.getByRole('alert')).toContainText(
    'Thông tin đăng nhập không đúng',
  )
  expect(calls).toBe(0)
  await expect(page.getByLabel('Mật khẩu hiện tại')).toBeEnabled()
})

test('provider widgets fit a 320px viewport without overlapping', async ({
  page,
}, info) => {
  await page.goto('/sign-in')
  await page.getByRole('button', { name: 'Verify fixture' }).click()
  await expect(
    page.getByRole('button', { name: 'Google fixture' }),
  ).toBeVisible()
  await page.setViewportSize({ width: 320, height: 740 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  const captcha = await page
    .getByRole('button', { name: 'Verify fixture' })
    .boundingBox()
  const google = await page
    .getByRole('button', { name: 'Google fixture' })
    .boundingBox()
  expect(captcha!.y + captcha!.height).toBeLessThan(google!.y)
  await page.screenshot({
    path: info.outputPath('provider-small-viewport.png'),
    fullPage: true,
  })
})
