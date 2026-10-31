import { test, expect } from '../fixtures/live-backend'

test('cash checkout, repeated handoff and feedback keep one ledger entry per operation', async ({ backend, page }, info) => {
  const { prefix, ids, prisma } = backend
  await page.goto('/staff')
  await expect(page.getByRole('heading', { name: prefix, exact: true })).toBeVisible()
  const result = await page.evaluate(async fixture => {
    const { openCashierShift } = await import('/src/features/cashier-shifts/cashier-shifts.api.ts')
    const { updateOrderItemStatus } = await import('/src/features/kitchen/kitchen.api.ts')
    const pos = await import('/src/features/pos/pos.api.ts')
    const pickup = await import('/src/features/online-orders/pickup.api.ts')
    await openCashierShift(fixture.cashFund, '0', crypto.randomUUID())
    const session = await pos.openOrderSession(null)
    await pos.addOrderItems(session.id, [{ menuItemId: fixture.menu, quantity: 1 }])
    const detail = await pos.getSessionDetail(session.id, new AbortController().signal)
    const item = detail.orderItems[0]!
    for (const serveStatus of ['COOKING', 'READY'] as const)
      await updateOrderItemStatus(item.id, serveStatus)
    const input = {
      orderSessionId: session.id, paymentMethod: 'CASH' as const,
      amountTendered: '50000', idempotencyKey: crypto.randomUUID(), closeSessionAfterPayment: true
    }
    const paid = await Promise.all([pos.checkoutInvoice(input), pos.checkoutInvoice(input)])
    const replay = await pos.checkoutInvoice(input)
    let conflictStatus = 0
    try { await pos.checkoutInvoice({ ...input, amountTendered: '60000' }) }
    catch (error) { conflictStatus = (error as { status: number }).status }
    const credential = await pickup.issuePickupCode(paid[0]!.id)
    const collected = await Promise.all([
      pickup.collectPickupItem(credential, item.id), pickup.collectPickupItem(credential, item.id),
    ])
    const feedback = await Promise.all([
      pickup.submitPickupFeedback(credential, 5, 'Fixture feedback'),
      pickup.submitPickupFeedback(credential, 5, 'Fixture feedback'),
    ])
    return { sessionId: session.id, itemId: item.id, paid, replay, conflictStatus, credential, collected, feedback }
  }, ids)
  expect(result.paid.map(invoice => invoice.id)).toEqual([result.replay.id, result.replay.id])
  expect(result.paid[0]).toMatchObject({ paymentStatus: 'PAID', totalAmount: '35000', changeAmount: '15000' })
  expect(result.conflictStatus).toBe(409)
  expect(result.collected.every(item => item.serveStatus === 'SERVED')).toBe(true)
  expect(result.feedback[0]!.id).toBe(result.feedback[1]!.id)
  expect(await prisma.invoice.count({ where: { orderSessionId: result.sessionId } })).toBe(1)
  expect(await prisma.cashTransaction.count({ where: { invoiceId: result.replay.id } })).toBe(1)
  expect((await prisma.fund.findUniqueOrThrow({ where: { id: ids.cashFund } })).balance.toString()).toBe('35000')
  expect(await prisma.outboxEvent.count({ where: { aggregateId: result.replay.id, eventName: 'order.invoice.paid' } })).toBe(1)
  expect(await prisma.actionLog.count({
    where: {
      employeeId: ids.employee, actionType: 'ORDER_ITEM_STATUS_UPDATED',
      details: { path: ['orderItemId'], equals: result.itemId }
    }
  })).toBe(3)
  expect(await prisma.takeawayFeedback.count({ where: { invoiceId: result.replay.id } })).toBe(1)
  const audit = await prisma.actionLog.findFirstOrThrow({ where: { employeeId: ids.employee } })
  await expect(prisma.actionLog.update({ where: { id: audit.id }, data: { details: { changed: true } } })).rejects.toThrow()
  expect((await prisma.actionLog.findUniqueOrThrow({ where: { id: audit.id } })).details).toEqual(audit.details)
  await page.goto('/pickup#' + new URLSearchParams({ invoiceId: result.credential.invoiceId, code: result.credential.code }))
  await expect(page.getByRole('heading', { name: 'Đã nhận món', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('real-collected-pickup.png') })
})

test('real quoted partial promotion checkout leaves remaining lines unbilled', async ({ backend, page }, info) => {
  const { prisma, prefix, ids } = backend
  await backend.openShift()
  const promotion = await prisma.promotion.create({
    data: {
      name: prefix + '-partial', discountType: 'PERCENTAGE', discountValue: '10',
      startDate: new Date(Date.now() - 60000), endDate: new Date(Date.now() + 3600000),
    }
  })
  await page.goto('/staff')
  await expect(page.getByRole('heading', { name: prefix, exact: true })).toBeVisible()
  const session = await page.evaluate(async fixture => {
    const pos = await import('/src/features/pos/pos.api.ts')
    const session = await pos.openOrderSession(null)
    await pos.addOrderItems(session.id, [{ menuItemId: fixture.menu, quantity: 1 },
    { menuItemId: fixture.candidate, quantity: 1, optionIds: [fixture.option] }])
    return pos.getSessionDetail(session.id, new AbortController().signal)
  }, ids)
  const coffee = session.orderItems.find(item => item.menuItem.id === ids.menu)!
  const cake = session.orderItems.find(item => item.menuItem.id === ids.candidate)!
  const beforeInvoices = await prisma.invoice.count({ where: { orderSessionId: session.id } })
  const quote = await page.evaluate(async input => {
    const { quoteInvoice } = await import('/src/features/pos/pos.api.ts')
    return quoteInvoice(input)
  }, { orderSessionId: session.id, orderItemIds: [coffee.id], promotionId: promotion.id })
  expect(quote).toMatchObject({ subTotal: '35000', discountAmount: '3500', totalAmount: '31500' })
  expect(await prisma.invoice.count({ where: { orderSessionId: session.id } })).toBe(beforeInvoices)
  await page.goto('/staff/pos/sessions/' + session.id)
  await page.getByRole('button', { name: /^Thanh toán \(/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('checkbox', { name: new RegExp(prefix + '-cake') }).uncheck()
  await dialog.getByLabel('Khuyến mãi').selectOption(promotion.id)
  await expect(dialog.getByText('31.500', { exact: false }).first()).toBeVisible()
  await page.screenshot({ path: info.outputPath('real-partial-promotion.png') })
  await dialog.getByRole('button', { name: 'Xác nhận thanh toán tiền mặt' }).click()
  await expect(dialog.getByRole('heading', { name: 'Thanh toán thành công!' })).toBeVisible()
  const paid = await prisma.invoice.findFirstOrThrow({ where: { orderSessionId: session.id } })
  expect(paid.totalAmount.toString()).toBe('31500')
  expect(paid.promotionId).toBe(promotion.id)
  expect(await prisma.cashTransaction.count({ where: { invoiceId: paid.id } })).toBe(1)
  expect((await prisma.orderItem.findUniqueOrThrow({ where: { id: cake.id } })).invoiceId).toBeNull()
  expect((await prisma.orderSession.findUniqueOrThrow({ where: { id: session.id } })).sessionStatus).toBe('ACTIVE')
  const recovered = await page.evaluate(async input => {
    const pos = await import('/src/features/pos/pos.api.ts')
    try { await pos.quoteInvoice(input); return 0 } catch (error) { return (error as { status: number }).status }
  }, { orderSessionId: session.id, orderItemIds: [coffee.id] })
  expect(recovered).toBe(400)
})

test('two POS requests with different keys cannot pay the same session twice', async ({ backend, page }) => {
  const { prisma, ids, prefix } = backend
  await backend.openShift()
  const before = await prisma.fund.findUniqueOrThrow({ where: { id: ids.cashFund } })
  await page.goto('/staff')
  await expect(page.getByRole('heading', { name: prefix, exact: true })).toBeVisible()
  const result = await page.evaluate(async fixture => {
    const pos = await import('/src/features/pos/pos.api.ts')
    const session = await pos.openOrderSession(null)
    await pos.addOrderItems(session.id, [{ menuItemId: fixture.menu, quantity: 1 }])
    const attempts = await Promise.allSettled([crypto.randomUUID(), crypto.randomUUID()].map(idempotencyKey =>
      pos.checkoutInvoice({ orderSessionId: session.id, amountTendered: '50000', idempotencyKey })))
    return {
      sessionId: session.id, attempts: attempts.map(attempt => attempt.status === 'fulfilled'
        ? { status: 'fulfilled', invoiceId: attempt.value.id }
        : { status: 'rejected', httpStatus: (attempt.reason as { status: number }).status })
    }
  }, ids)
  expect(result.attempts.filter(attempt => attempt.status === 'fulfilled')).toHaveLength(1)
  const rejected = result.attempts.filter(attempt => attempt.status === 'rejected')
  expect(rejected).toHaveLength(1)
  expect([400, 409]).toContain(rejected[0]!.httpStatus)
  const invoice = await prisma.invoice.findFirstOrThrow({ where: { orderSessionId: result.sessionId } })
  expect(await prisma.invoice.count({ where: { orderSessionId: result.sessionId } })).toBe(1)
  expect(await prisma.cashTransaction.count({ where: { invoiceId: invoice.id } })).toBe(1)
  const after = await prisma.fund.findUniqueOrThrow({ where: { id: ids.cashFund } })
  expect(after.balance.minus(before.balance).toString()).toBe('35000')
})
