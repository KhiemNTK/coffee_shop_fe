import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope } from './helpers.js'

const bar = '94000000-0000-4000-8000-000000000001'
const tea = '94000000-0000-4000-8000-000000000002'

type FixtureSource = EventTarget & {
  closed: boolean
  onopen: (() => void) | null
  onerror: (() => void) | null
}
type FixtureConstructor = { instances: FixtureSource[]; autoOpen: boolean }

async function setup(page: Page) {
  await page.clock.install()
  await page.addInitScript(() => {
    class Source extends EventTarget {
      static instances: Source[] = []
      static autoOpen = true
      onopen: (() => void) | null = null
      onerror: (() => void) | null = null
      closed = false
      constructor() {
        super()
        Source.instances.push(this)
        if (Source.autoOpen) setTimeout(() => this.onopen?.(), 0)
      }
      close() {
        this.closed = true
      }
    }
    let chimes = 0
    class Audio {
      state = 'running'
      currentTime = 0
      destination = {}
      resume() {
        return Promise.resolve()
      }
      createOscillator() {
        chimes++
        return {
          frequency: { setValueAtTime() {} },
          connect() {},
          disconnect() {},
          start() {},
          stop() {},
        }
      }
      createGain() {
        return {
          gain: {
            setValueAtTime() {},
            linearRampToValueAtTime() {},
            exponentialRampToValueAtTime() {},
          },
          connect() {},
          disconnect() {},
        }
      }
    }
    Object.assign(window, { EventSource: Source, AudioContext: Audio, fixtureChimes: () => chimes })
  })
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminEmployee) })
  )
  await page.route('**/api/v1/auth/me/permissions', (route) =>
    route.fulfill({ json: envelope(defaultMockAdminAuth(['/kitchen-tickets_read'])) })
  )
  const reads = { tickets: 0, workload: 0 }
  await page.route('**/api/v1/kitchen/tickets?*', (route) => {
    reads.tickets++
    return route.fulfill({
      json: envelope({ list: [], totalItems: 0, totalPages: 0, currentPage: 1 }),
    })
  })
  await page.route('**/api/v1/kitchen/workload', (route) => {
    reads.workload++
    return route.fulfill({
      json: envelope({
        asOf: new Date().toISOString(),
        dueSoonWindowSeconds: 60,
        stations: [bar, tea].map((stationId, index) => ({
          stationId,
          stationName: index ? 'Tea' : 'Bar',
          stationCode: index ? 'TEA' : 'BAR',
          isActive: true,
          openTicketCount: 0,
          openUnitCount: 0,
          overdueTicketCount: 0,
          dueSoonTicketCount: 0,
        })),
      }),
    })
  })
  await page.goto(`/staff/kitchen?stationId=${bar}`)
  await expect(page.getByText('Realtime Live', { exact: true })).toBeVisible()
  await expect(page.getByText('Không có vé bếp trong bộ lọc hiện tại.')).toBeVisible()
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  await page.evaluate(() => {
    const sources = (window.EventSource as unknown as FixtureConstructor).instances
    sources.at(-1)!.dispatchEvent(new MessageEvent('heartbeat'))
  })
  return reads
}

async function emit(page: Page, data: unknown) {
  await page.evaluate((data) => {
    const sources = (window.EventSource as unknown as FixtureConstructor).instances
    sources
      .at(-1)!
      .dispatchEvent(new MessageEvent('kitchen.refresh', { data: JSON.stringify(data) }))
  }, data)
}

const newTicket = (stationId = bar, availableAt = '2020-01-01T00:00:00.000Z') => ({
  eventId: randomUUID(),
  eventName: 'order.items.added',
  occurredAt: new Date().toISOString(),
  newTickets: [{ stationId, availableAt }],
})

const chimes = (page: Page) =>
  page.evaluate(() => (window as unknown as { fixtureChimes: () => number }).fixtureChimes())

async function enableSound(page: Page) {
  const before = await chimes(page)
  await page.getByRole('button', { name: 'Bật âm báo vé mới', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Tắt âm báo vé mới', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')
  const after = await chimes(page)
  expect(after).toBe(before + 1)
  return after
}

test('a silent stream falls back to polling and reconciles when reconnected', async ({
  page,
}, info) => {
  const reads = await setup(page)
  await page.evaluate(() => {
    ;(window.EventSource as unknown as FixtureConstructor).autoOpen = false
  })
  await page.clock.runFor(44_900)
  await expect(page.getByText('Realtime Live', { exact: true })).toBeVisible()
  const before = reads.tickets
  await page.clock.runFor(200)
  await expect(page.getByText('Đang cập nhật định kỳ', { exact: true })).toBeVisible()
  await expect.poll(() => reads.tickets).toBeGreaterThan(before)
  await page.screenshot({ path: info.outputPath('kds-polling.png'), fullPage: true })
  const fallbackReads = reads.tickets
  await page.clock.runFor(6_200)
  await expect.poll(() => reads.tickets).toBeGreaterThan(fallbackReads)
  await page.evaluate(() =>
    (window.EventSource as unknown as FixtureConstructor).instances.at(-1)!.onopen?.()
  )
  await expect(page.getByText('Realtime Live', { exact: true })).toBeVisible()
  const recoveryReads = reads.tickets
  await expect.poll(() => reads.tickets).toBeGreaterThan(fallbackReads)
  expect(recoveryReads).toBeGreaterThan(0)
  expect(await chimes(page)).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('heartbeats keep an idle kitchen live without reconnecting', async ({ page }) => {
  await setup(page)
  const connections = await page.evaluate(
    () => (window.EventSource as unknown as FixtureConstructor).instances.length
  )
  for (let i = 0; i < 4; i++) {
    await page.clock.runFor(15_000)
    await page.evaluate(() =>
      (window.EventSource as unknown as FixtureConstructor).instances
        .at(-1)!
        .dispatchEvent(new MessageEvent('heartbeat'))
    )
  }
  await expect(page.getByText('Realtime Live', { exact: true })).toBeVisible()
  expect(
    await page.evaluate(
      () => (window.EventSource as unknown as FixtureConstructor).instances.length
    )
  ).toBe(connections)
  expect(await chimes(page)).toBe(0)
})

test('only a due new ticket for the selected station chimes, once across reconnects', async ({
  page,
}) => {
  await setup(page)
  const baseline = await enableSound(page)
  for (const data of [
    {},
    { ...newTicket(), eventName: 'order.item.status.updated' },
    newTicket(tea),
    newTicket(bar, '2099-01-01T00:00:00.000Z'),
    { ...newTicket(), newTickets: [{ stationId: 'invalid', availableAt: 'invalid' }] },
  ]) {
    await emit(page, data)
    await page.clock.runFor(300)
  }
  expect(await chimes(page)).toBe(baseline)
  const event = newTicket()
  await emit(page, event)
  await emit(page, event)
  await page.clock.runFor(300)
  expect(await chimes(page)).toBe(baseline + 1)
  await page.evaluate(() => {
    const source = (window.EventSource as unknown as FixtureConstructor).instances.at(-1)!
    source.onerror?.()
    source.onerror?.()
    source.dispatchEvent(new MessageEvent('heartbeat'))
  })
  await expect(page.getByText('Đang cập nhật định kỳ', { exact: true })).toBeVisible()
  await page.clock.runFor(5_100)
  await expect(page.getByText('Realtime Live', { exact: true })).toBeVisible()
  await emit(page, event)
  await page.clock.runFor(300)
  expect(await chimes(page)).toBe(baseline + 1)
  await emit(page, newTicket())
  await emit(page, newTicket())
  await page.clock.runFor(300)
  expect(await chimes(page)).toBe(baseline + 2)
})

test('filter changes and muted tickets do not produce delayed or replayed chimes', async ({
  page,
}) => {
  await setup(page)
  const baseline = await enableSound(page)
  // Keep the event and filter change in one task, before the 250 ms notification batch.
  await page.getByRole('button', { name: 'Tea (TEA)', exact: true }).evaluate((button, data) => {
    if (!(button instanceof HTMLButtonElement)) throw new Error('Expected a station button')
    const sources = (window.EventSource as unknown as FixtureConstructor).instances
    sources
      .at(-1)!
      .dispatchEvent(new MessageEvent('kitchen.refresh', { data: JSON.stringify(data) }))
    button.click()
  }, newTicket())
  await expect(page.getByRole('button', { name: 'Tea (TEA)', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await page.clock.runFor(300)
  expect(await chimes(page)).toBe(baseline)
  await page.getByRole('button', { name: 'Tắt âm báo vé mới', exact: true }).click()
  const event = newTicket(tea)
  await emit(page, event)
  await page.clock.runFor(300)
  expect(await chimes(page)).toBe(baseline)
  const resumed = await enableSound(page)
  await emit(page, event)
  await page.clock.runFor(300)
  expect(await chimes(page)).toBe(resumed)
  await emit(page, newTicket(tea))
  await page.clock.runFor(300)
  expect(await chimes(page)).toBe(resumed + 1)
})

test('a healthy SSE connection switches to fast polling when its Redis relay is degraded', async ({
  page,
}) => {
  const reads = await setup(page)
  const connectionCount = await page.evaluate(
    () => (window.EventSource as unknown as FixtureConstructor).instances.length
  )
  await page.evaluate(() => {
    ;(window.EventSource as unknown as FixtureConstructor).instances
      .at(-1)!
      .dispatchEvent(
        new MessageEvent('kitchen.connection', { data: JSON.stringify({ realtime: false }) })
      )
  })
  await expect(page.getByText('Đang cập nhật định kỳ', { exact: true })).toBeVisible()
  const before = reads.tickets
  await page.clock.runFor(6_100)
  await expect.poll(() => reads.tickets).toBeGreaterThan(before)
  await page.evaluate(() => {
    ;(window.EventSource as unknown as FixtureConstructor).instances
      .at(-1)!
      .dispatchEvent(new MessageEvent('heartbeat', { data: JSON.stringify({ realtime: false }) }))
  })
  await expect(page.getByText('Đang cập nhật định kỳ', { exact: true })).toBeVisible()
  expect(
    await page.evaluate(
      () => (window.EventSource as unknown as FixtureConstructor).instances.length
    )
  ).toBe(connectionCount)
  await page.evaluate(() => {
    ;(window.EventSource as unknown as FixtureConstructor).instances
      .at(-1)!
      .dispatchEvent(
        new MessageEvent('kitchen.connection', { data: JSON.stringify({ realtime: true }) })
      )
  })
  await expect(page.getByText('Realtime Live', { exact: true })).toBeVisible()
})

test('leaving KDS closes the stream and cancels watchdog and pending notifications', async ({
  page,
}) => {
  const reads = await setup(page)
  await emit(page, newTicket())
  await page.getByRole('link', { name: 'Tài khoản', exact: true }).click()
  await expect(page).toHaveURL(/\/staff\/account$/)
  await expect(
    page.getByRole('heading', { name: defaultMockAdminEmployee.fullName, exact: true })
  ).toBeVisible()
  const before = { ...reads }
  const beforeChimes = await chimes(page)
  const count = await page.evaluate(
    () => (window.EventSource as unknown as FixtureConstructor).instances.length
  )
  await emit(page, newTicket())
  await page.clock.runFor(60_000)
  expect(reads).toEqual(before)
  expect(await chimes(page)).toBe(beforeChimes)
  expect(
    await page.evaluate(() => {
      const sources = (window.EventSource as unknown as FixtureConstructor).instances
      return { count: sources.length, allClosed: sources.every((source) => source.closed) }
    })
  ).toEqual({ count, allClosed: true })
})
