import { expect, test, type Page } from '@playwright/test'
import { envelope } from './helpers.js'

const orderAuth = {
  requestId: '50000000-0000-4000-8000-000000000006',
  accessToken: 'a'.repeat(64),
}
const telegramUrl = 'https://t.me/coffee_fixture_bot?start=' + 'b'.repeat(43)
const order = {
  ...orderAuth,
  status: 'PENDING',
  expiresAt: '2030-10-05T12:00:00.000Z',
  quotedSubtotal: '35000',
  items: [],
  isPaid: false,
  orderItems: [],
  telegram: { enabled: true, subscribed: false },
}

async function track(page: Page, overrides: Record<string, unknown> = {}) {
  await page.addInitScript((value) => {
    sessionStorage.setItem('coffee_shop_takeaway_order', JSON.stringify(value))
  }, orderAuth)
  await page.route('**/api/v1/online-orders/requests/status', (route) =>
    route.fulfill({ json: envelope({ ...order, ...overrides }) }),
  )
  await page.goto('/order')
}

test('Telegram link is user-opened, private and issued only once per click', async ({
  page,
}, info) => {
  let calls = 0
  let popups = 0
  page.on('popup', () => popups++)
  await page.route(
    '**/api/v1/online-orders/requests/telegram-link',
    (route) => {
      calls++
      expect(route.request().postDataJSON()).toEqual(orderAuth)
      return route.fulfill({
        json: envelope({
          url: telegramUrl,
          expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
        }),
      })
    },
  )
  await track(page)
  const generate = page.getByRole('button', {
    name: 'Nhận cập nhật qua Telegram',
  })
  await generate.evaluate((node) => {
    if (!(node instanceof HTMLButtonElement)) throw new Error('Expected button')
    node.click()
    node.click()
  })
  const link = page.getByRole('link', { name: 'Mở Telegram' })
  await expect(link).toHaveAttribute('href', telegramUrl)
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(link).toHaveAttribute('referrerpolicy', 'no-referrer')
  expect(calls).toBe(1)
  expect(popups).toBe(0)
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...sessionStorage, ...localStorage }),
    ),
  ).not.toContain('b'.repeat(43))
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: info.outputPath('telegram-link.png'),
    fullPage: true,
  })
  await page.reload()
  await expect(page.getByRole('link', { name: 'Mở Telegram' })).toHaveCount(0)
  await expect(generate).toBeVisible()
  expect(calls).toBe(1)
})

test('expired Telegram link disappears and renewal is explicit', async ({
  page,
}) => {
  await page.clock.install()
  let calls = 0
  await page.route(
    '**/api/v1/online-orders/requests/telegram-link',
    (route) => {
      calls++
      return route.fulfill({
        json: envelope({
          url: telegramUrl,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      })
    },
  )
  await track(page)
  await page.getByRole('button', { name: 'Nhận cập nhật qua Telegram' }).click()
  await expect(page.getByRole('link', { name: 'Mở Telegram' })).toBeVisible()
  await page.clock.fastForward(61_000)
  await expect(page.getByRole('link', { name: 'Mở Telegram' })).toHaveCount(0)
  await expect(page.getByRole('status')).toContainText(
    'Liên kết Telegram đã hết hạn',
  )
  expect(calls).toBe(1)
  await expect(
    page.getByRole('button', { name: 'Nhận cập nhật qua Telegram' }),
  ).toBeVisible()
})

test('Telegram failure is not retried automatically and allows explicit recovery', async ({
  page,
}) => {
  let calls = 0
  await page.route(
    '**/api/v1/online-orders/requests/telegram-link',
    (route) => {
      calls++
      return route.fulfill(
        calls === 1
          ? { status: 503, json: {} }
          : {
              json: envelope({
                url: telegramUrl,
                expiresAt: new Date(Date.now() + 60_000).toISOString(),
              }),
            },
      )
    },
  )
  await track(page)
  await page.getByRole('button', { name: 'Nhận cập nhật qua Telegram' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  expect(calls).toBe(1)
  await page.getByRole('button', { name: 'Nhận cập nhật qua Telegram' }).click()
  await expect(page.getByRole('link', { name: 'Mở Telegram' })).toBeVisible()
  expect(calls).toBe(2)
})

for (const invalidUrl of [
  'javascript:alert(1)',
  'https://t.me.evil.test/coffee_fixture_bot?start=' + 'b'.repeat(43),
]) {
  test(
    'rejects unsafe Telegram URL: ' +
      invalidUrl.split(':')[0] +
      invalidUrl.slice(8, 23),
    async ({ page }) => {
      await page.route(
        '**/api/v1/online-orders/requests/telegram-link',
        (route) =>
          route.fulfill({
            json: envelope({
              url: invalidUrl,
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
            }),
          }),
      )
      await track(page)
      await page
        .getByRole('button', { name: 'Nhận cập nhật qua Telegram' })
        .click()
      await expect(page.getByRole('alert')).toBeVisible()
      await expect(page.getByRole('link', { name: 'Mở Telegram' })).toHaveCount(
        0,
      )
    },
  )
}

for (const [name, overrides] of [
  ['disabled', { telegram: { enabled: false, subscribed: false } }],
  ['expired', { status: 'EXPIRED' }],
  ['collected', { status: 'ACCEPTED', fulfillmentStatus: 'COLLECTED' }],
  ['subscribed', { telegram: { enabled: true, subscribed: true } }],
] as const) {
  test('does not create links when ' + name, async ({ page }) => {
    await track(page, overrides)
    await expect(
      page.getByText('Trạng thái đơn hàng', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Nhận cập nhật qua Telegram' }),
    ).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Mở Telegram' })).toHaveCount(0)
    if (name === 'subscribed')
      await expect(page.getByRole('status')).toHaveText('Đã kết nối Telegram')
  })
}
