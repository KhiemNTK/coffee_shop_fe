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
        const frame = document.createElement('div'); frame.dataset.testid = 'turnstile-widget';
        frame.style.width = (options.size === 'compact' ? 150 : 300) + 'px';
        frame.style.height = (options.size === 'compact' ? 140 : 65) + 'px'; frame.style.flexShrink = '0';
        const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Verify fixture';
        button.onclick = () => options.callback('captcha-fixture'); frame.append(button); element.append(frame);
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
}) => {
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
  await expect(page.getByText('Google chỉ dùng sau khi liên kết.', { exact: false })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Đăng ký tài khoản mới', exact: true })).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Google fixture' }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Verify fixture' }).click()
  const button = page.getByRole('button', { name: 'Google fixture' })
  await expect(button).toBeVisible()
  // Provider layout tests take screenshots; viewport changes can reset CAPTCHA.
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
  ).toEqual({ local: { coffee_shop_language: 'vi' }, session: {} })
})

test('Google loading is announced without shifting the button area', async ({ page, context }, info) => {
  let releaseScript!: () => void
  const scriptGate = new Promise<void>((resolve) => { releaseScript = resolve })
  await context.route(googleScript, async (route) => {
    await scriptGate
    await route.fallback()
  })
  await page.goto('/sign-in')
  try {
    await page.getByRole('button', { name: 'Verify fixture' }).click()
    const loading = page.getByRole('status').filter({ hasText: 'Đang tải đăng nhập Google' })
    await expect(loading).toBeVisible()
    const area = page.getByRole('group', { name: 'Đăng nhập Google', exact: true }).locator('[aria-busy]')
    await expect(area).toHaveAttribute('aria-busy', 'true')
    const before = await area.boundingBox()
    releaseScript()
    await expect(page.getByRole('button', { name: 'Google fixture' })).toBeVisible()
    await expect(area).toHaveAttribute('aria-busy', 'false')
    await expect(loading).toHaveCount(0)
    const after = await area.boundingBox()
    expect(before?.height).toBe(after?.height)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath('staff-google-ready.png'), fullPage: true, animations: 'disabled' })
  } finally {
    releaseScript()
  }
})

for (const { path, endpoint, language, message } of [
  { path: '/sign-in', endpoint: '/auth/google', language: 'en', message: 'Google sign-in is temporarily unavailable. Please try again later.' },
  { path: '/customer/sign-in', endpoint: '/customers/auth/google', language: 'vi', message: 'Đăng nhập Google tạm thời không khả dụng. Vui lòng thử lại sau.' },
]) {
  test(`Google outage on ${path} is actionable and never retries consumed credentials`, async ({ page, context }) => {
    await page.addInitScript((value) => localStorage.setItem('coffee_shop_language', value), language)
    await context.route('**/api/v1/customers/me', route => route.fulfill({ status: 401, json: {} }))
    await context.route('**/api/v1/menu/public/store', route => route.fulfill({ json: envelope({ name: 'Coffee Homes', address: null, phone: null }) }))
    let calls = 0
    await page.route(`**/api/v1${endpoint}`, route => {
      calls++
      return route.fulfill({ status: 503, headers: { 'x-request-id': 'google-outage-fixture' }, json: { code: 'GOOGLE_UNAVAILABLE', message: 'untranslated server reason' } })
    })
    await page.goto(path)
    await page.getByRole('button', { name: 'Verify fixture' }).click()
    await page.getByRole('button', { name: 'Google fixture' }).click()
    await expect(page.getByRole('alert')).toContainText(message)
    await expect(page.getByRole('alert')).toContainText('google-outage-fixture')
    await expect(page.getByRole('button', { name: 'Google fixture' })).toHaveCount(0)
    await page.clock.install()
    await page.clock.runFor(15_000)
    expect(calls).toBe(1)
  })
}

test('Google staff login restores the remembered location and still enforces route permissions', async ({ page, context }) => {
  await staff(context)
  await page.addInitScript(() => sessionStorage.setItem('coffee_shop_staff_return_to', '/staff/menu?category=coffee#items'))
  await page.route('**/api/v1/auth/google', route => route.fulfill({ json: envelope({}) }))
  await page.goto('/sign-in')
  await page.getByRole('button', { name: 'Verify fixture' }).click()
  await page.getByRole('button', { name: 'Google fixture' }).click()
  await expect(page).toHaveURL('http://localhost:4173/staff/menu?category=coffee#items')
  await expect(page.getByRole('heading', { name: 'Không có quyền truy cập', exact: true })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('coffee_shop_staff_return_to'))).toBeNull()
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
    const failures = ['GOOGLE_EMAIL_MISMATCH', 'GOOGLE_ALREADY_LINKED', 'GOOGLE_LINK_CHANGED']
    if (calls <= failures.length) return route.fulfill({
      status: 400,
      json: { code: failures[calls - 1], message: 'untranslated server reason' },
    })
    linked = true
    return route.fulfill({ json: envelope({ linked: true }) })
  })
  await page.goto('/staff/account')
  const submit = page.getByRole('button', {
    name: 'Liên kết Google',
    exact: true,
  })
  await expect(submit).toBeDisabled()
  for (const message of [
    'Vui lòng chọn tài khoản Google trùng với email nhân viên.',
    'Tài khoản Google đã được liên kết. Tải lại thông tin tài khoản hoặc liên hệ quản lý.',
    'Liên kết Google đã thay đổi. Tải lại thông tin tài khoản trước khi thử lại.',
  ]) {
    await page.getByRole('button', { name: 'Google fixture' }).click()
    await page.getByLabel('Mật khẩu hiện tại').fill('Fixture-password-123!')
    await submit.click()
    await expect(page.getByRole('alert')).toHaveText(message)
    await expect(submit).toBeDisabled()
    await expect(page.getByLabel('Mật khẩu hiện tại')).toHaveValue('')
  }
  await page.getByRole('button', { name: 'Google fixture' }).click()
  await page.getByLabel('Mật khẩu hiện tại').fill('Fixture-password-123!')
  await submit.click()
  await expect(
    page.getByText('Đã liên kết tài khoản Google.', { exact: true }),
  ).toBeVisible()
  expect(calls).toBe(4)
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
      await page.goto('/staff/account')
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
  await page.goto('/staff/account')
  const other = await context.newPage()
  await other.goto('/staff/account')
  await expect(
    other.getByRole('heading', { name: defaultMockAdminEmployee.fullName }),
  ).toBeVisible()
  await page.getByLabel('Mật khẩu hiện tại').fill('Fixture-password-123!')
  await page.getByRole('button', { name: 'Hủy liên kết và đăng xuất' }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(other).toHaveURL(/\/sign-in$/)
  for (const tab of [page, other]) {
    expect(
      await tab.evaluate(() => ({
        local: { ...localStorage },
        session: { ...sessionStorage },
      })),
    ).toEqual({ local: { coffee_shop_language: 'vi' }, session: {} })
  }
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
      await page.goto('/staff/account')
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
      await expect(page).toHaveURL(/\/staff\/account$/)
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
  await page.goto('/staff/account')
  const other = await context.newPage()
  await other.goto('/staff/account')
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
  await expect(page.getByTestId('turnstile-widget')).toHaveCSS('width', '150px')
  // Resizing replaces the widget and deliberately invalidates its previous token.
  await page.getByRole('button', { name: 'Verify fixture' }).click()
  await expect(page.getByRole('button', { name: 'Google fixture' })).toBeVisible()
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
