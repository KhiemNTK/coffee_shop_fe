import { test, expect } from '../fixtures/live-backend'
import { createHash, randomUUID } from 'node:crypto'

test('online cohorts reach cash collection with one exposure and server-authoritative conversion', async ({ backend, page, context }, info) => {
  const { prisma, ids, prefix, cookies } = backend
  await backend.openShift()
  await prisma.menuItemRecommendationPair.create({ data: { anchorId: ids.menu, candidateId: ids.candidate, support: 3, refreshedAt: new Date() } })
  await page.goto('/staff')
  const posCandidates = await page.evaluate(async sessionId => {
    const { getPosRecommendations } = await import('/src/features/recommendations/recommendations.api.ts')
    return getPosRecommendations(sessionId)
  }, ids.session)
  expect(posCandidates).toMatchObject([{ id: ids.candidate, optionGroups: [{ options: [{ id: ids.option }] }] }])
  // Only cohort randomness is controlled; API, authentication and transactions stay real.
  await page.addInitScript(() => {
    const original = crypto.randomUUID.bind(crypto)
    const cohort = new URLSearchParams(location.search).get('fixtureCohort')
    let calls = 0
    crypto.randomUUID = () => (++calls === 2 && cohort ? cohort : original()) as ReturnType<typeof crypto.randomUUID>
  })
  const from = new Date().toISOString()
  for (const treatment of [true, false]) {
    let clientRequestId = randomUUID()
    while ((createHash('sha256').update(clientRequestId).digest()[0]! % 2 === 1) !== treatment) clientRequestId = randomUUID()
    await context.clearCookies()
    await page.goto('/sign-in')
    await page.evaluate(() => sessionStorage.removeItem('coffee_shop_takeaway_order'))
    await page.goto('/order?fixtureCohort=' + clientRequestId)
    await page.getByRole('button', { name: prefix, exact: true }).click()
    await page.getByRole('heading', { name: prefix + '-coffee', exact: true }).locator('../..').getByRole('button', { name: 'Chọn món', exact: true }).click()
    await page.getByRole('button', { name: 'Thêm vào giỏ', exact: true }).click()
    await page.getByRole('textbox', { name: 'Tên người nhận' }).fill(prefix)
    await page.getByRole('textbox', { name: 'Số điện thoại' }).fill('0901234567')
    await page.getByRole('button', { name: 'Xem lại đơn', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Xem lại đơn', exact: true })).toBeVisible()
    if (treatment) {
      await page.getByRole('button', { name: 'Thêm ' + prefix + '-cake', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Large', exact: false })).toHaveAttribute('aria-pressed', 'true')
      await page.getByRole('button', { name: 'Thêm vào giỏ', exact: true }).click()
      await page.screenshot({ path: info.outputPath('real-online-offer.png') })
    } else await expect(page.getByRole('region', { name: 'Gọi kèm', exact: true })).toHaveCount(0)
    const requestPromise = page.waitForRequest(req => req.method() === 'POST' && new URL(req.url()).pathname === '/api/v1/online-orders/requests')
    const responsePromise = page.waitForResponse(res => res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/v1/online-orders/requests')
    await page.getByRole('button', { name: 'Gửi đơn mang đi', exact: true }).click()
    const payload = (await requestPromise).postDataJSON() as Record<string, unknown>
    const response = await responsePromise
    expect(response.status()).toBe(201)
    const { data: createdOrder } = await response.json() as { data: { requestId: string; accessToken: string; quotedSubtotal: string | number } }
    expect(payload.clientRequestId).toBe(clientRequestId)
    const total = treatment ? '50000.00' : '35000.00'
    expect(payload.maxSubtotal).toBe(total)
    expect(String(createdOrder.quotedSubtotal)).toBe(treatment ? '50000' : '35000')
    expect(await prisma.recommendationExposure.count({ where: { clientRequestId } })).toBe(1)
    const exposure = await prisma.recommendationExposure.findUniqueOrThrow({ where: { clientRequestId } })
    expect(exposure.variant).toBe(treatment ? 'TREATMENT' : 'CONTROL')
    if (treatment) {
      const replayIds = await page.evaluate(async body => {
        const { createOnlineOrder } = await import('/src/features/online-orders/online-orders.api.ts')
        const result = await Promise.all([createOnlineOrder(body), createOnlineOrder(body)])
        return result.map(order => order.requestId)
      }, payload as unknown as import('../../src/features/online-orders/online-orders.api').CreateOnlineOrderPayload)
      expect(replayIds).toEqual([createdOrder.requestId, createdOrder.requestId])
    }
    await context.addCookies(cookies)
    const collection = await page.evaluate(async order => {
      const online = await import('/src/features/online-orders/online-orders.api.ts')
      const pos = await import('/src/features/pos/pos.api.ts')
      const { updateOrderItemStatus } = await import('/src/features/kitchen/kitchen.api.ts')
      const accepted = await online.acceptOnlineOrder(order.requestId)
      const session = await pos.getSessionDetail(accepted.orderSessionId, new AbortController().signal)
      for (const item of session.orderItems) {
        await updateOrderItemStatus(item.id, 'COOKING')
        await updateOrderItemStatus(item.id, 'READY')
      }
      const body = { accessToken: order.accessToken, amountTendered: order.total, idempotencyKey: crypto.randomUUID() }
      const results = await Promise.all([online.collectOnlineOrder(order.requestId, body), online.collectOnlineOrder(order.requestId, body)])
      return { results, sessionId: accepted.orderSessionId }
    }, { ...createdOrder, total })
    expect(collection.results[1]!.invoiceId).toBe(collection.results[0]!.invoiceId)
    expect(await prisma.onlineOrderRequest.count({ where: { clientRequestId } })).toBe(1)
    expect(await prisma.invoice.count({ where: { orderSessionId: collection.sessionId } })).toBe(1)
    expect(await prisma.cashTransaction.count({ where: { invoiceId: collection.results[0]!.invoiceId } })).toBe(1)
  }
  const report = await page.evaluate(async period => {
    const { getRecommendationExperiment } = await import('/src/features/reports/online-business.api.ts')
    return getRecommendationExperiment(period.from, period.to)
  }, { from, to: new Date(Date.now() + 1000).toISOString() })
  expect(report.variants.find(row => row.variant === 'TREATMENT')).toMatchObject({
    assignments: 1, requests: 1, paidOrders: 1, attachedOrders: 1, revenue: '50000.00', paidConversionRate: 1,
  })
  expect(report.variants.find(row => row.variant === 'CONTROL')).toMatchObject({
    assignments: 1, requests: 1, paidOrders: 1, attachedOrders: 0, revenue: '35000.00', paidConversionRate: 1,
  })
})

test('unconfigured Telegram is hidden by actual tracking metadata and issues no link', async ({ backend, page }) => {
  const { ids, prisma } = backend
  await page.goto('/order')
  const result = await page.evaluate(async menuItemId => {
    const online = await import('/src/features/online-orders/online-orders.api.ts')
    const { ApiError } = await import('/src/shared/api/client.ts')
    const order = await online.createOnlineOrder({
      pickupName: 'Telegram fixture', phoneNumber: '0901234567',
      items: [{ menuItemId, quantity: 1 }]
    })
    const tracking = await online.trackOnlineOrder(order.requestId, order.accessToken)
    let status = 0
    try { await online.getTelegramLink(order.requestId, order.accessToken) }
    catch (error) { status = error instanceof ApiError ? error.status : 0 }
    return { requestId: order.requestId, telegram: tracking.telegram, status }
  }, ids.menu)
  expect(result.telegram).toEqual({ enabled: false, subscribed: false })
  expect(result.status).toBe(503)
  const stored = await prisma.onlineOrderRequest.findUniqueOrThrow({ where: { id: result.requestId } })
  expect(stored.telegramLinkTokenHash).toBeNull()
  expect(stored.telegramChatId).toBeNull()
})
