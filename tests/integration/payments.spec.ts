import { test, expect } from '../fixtures/live-backend'
import { backendTestEnvironment } from '../backend-environment.ts'
import { createHmac, randomUUID } from 'node:crypto'

test('signed VNPay IPN settles once and return cannot confirm payment', async ({ backend, page, context }, info) => {
  const { ids, prisma } = backend
  await backend.openShift()
  await page.goto('/staff')
  const invoice = await page.evaluate(async fixture => {
    const pos = await import('/src/features/pos/pos.api.ts')
    const { createUnpaidInvoice } = await import('/src/features/invoices/invoices.api.ts')
    const session = await pos.openOrderSession(null)
    await pos.addOrderItems(session.id, [{ menuItemId: fixture.menu, quantity: 1 }])
    return createUnpaidInvoice(session.id)
  }, { menu: ids.menu })
  await page.goto('/staff/invoices')
  await page.getByRole('row').filter({ hasText: invoice.invoiceNumber }).getByTitle('Xem chi tiết & Thanh toán').click()
  await page.getByRole('button', { name: 'Cổng thanh toán (VNPay / MoMo / payOS)', exact: true }).click()
  const creation = page.waitForResponse(res => res.request().method() === 'POST' && new URL(res.url()).pathname === `/api/v1/invoices/${invoice.id}/payment-attempts`)
  await page.getByRole('button', { name: 'Tạo phiên VNPAY', exact: true }).click()
  const created = await creation
  expect(created.status()).toBe(201)
  const { data: attempt } = await created.json() as { data: { id: string; merchantReference: string } }
  await expect(page.getByRole('link', { name: 'Mở thanh toán VNPay' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('real-payment-gateway.png') })
  const env = backendTestEnvironment()
  const sign = (params: Record<string, string>) => {
    const query = new URLSearchParams(params)
    query.sort()
    query.set('vnp_SecureHash', createHmac('sha512', env.VNPAY_HASH_SECRET).update(query.toString()).digest('hex'))
    return query.toString()
  }
  const fields = {
    vnp_TmnCode: env.VNPAY_TMN_CODE, vnp_TxnRef: attempt.merchantReference,
    vnp_Amount: '3500000', vnp_ResponseCode: '00', vnp_TransactionStatus: '00',
    vnp_TransactionNo: attempt.id.replaceAll('-', ''), vnp_PayDate: '20261004150000'
  }
  const signed = sign(fields)
  await page.goto('/payment/vnpay/return?' + signed)
  await expect(page.getByRole('status')).toHaveText('Đang chờ ngân hàng xác nhận. Chưa cần thanh toán lại.')
  expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).paymentStatus).toBe('UNPAID')
  expect(await prisma.paymentWebhookEvent.count({ where: { paymentAttemptId: attempt.id } })).toBe(0)
  const invalid = await context.request.get('/api/v1/payments/vnpay/ipn?' + signed.replace(/vnp_SecureHash=[^&]+/, 'vnp_SecureHash=invalid'))
  expect(await invalid.json()).toMatchObject({ RspCode: '97' })
  const replies = await Promise.all(Array.from({ length: 3 }, () => context.request.get('/api/v1/payments/vnpay/ipn?' + signed)))
  const codes = await Promise.all(replies.map(async reply => {
    expect(reply.status()).toBe(200)
    return (await reply.json() as { RspCode: string }).RspCode
  }))
  expect(codes.sort()).toEqual(['00', '02', '02'])
  const delayed = await context.request.get('/api/v1/payments/vnpay/ipn?' + sign({ ...fields, vnp_ResponseCode: '24', vnp_TransactionStatus: '02' }))
  expect(await delayed.json()).toMatchObject({ RspCode: '02' })
  await expect(page.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Server đã ghi nhận thanh toán thành công.')
  expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status).toBe('SUCCEEDED')
  expect(await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).toMatchObject({ paymentStatus: 'PAID', paymentMethod: 'TRANSFER' })
  expect(await prisma.outboxEvent.count({ where: { eventName: 'order.invoice.paid', aggregateId: invoice.id } })).toBe(1)
  expect(await prisma.cashTransaction.count({ where: { invoiceId: invoice.id } })).toBe(0)
  expect(await prisma.paymentWebhookEvent.count({ where: { paymentAttemptId: attempt.id } })).toBe(2)
})

test('signed MoMo IPN is idempotent and cannot be substituted by VNPay', async ({ backend, page, context }) => {
  const { ids, prisma } = backend
  await backend.openShift()
  await page.goto('/staff')
  const invoice = await page.evaluate(async fixture => {
    const pos = await import('/src/features/pos/pos.api.ts')
    const { createUnpaidInvoice } = await import('/src/features/invoices/invoices.api.ts')
    const session = await pos.openOrderSession(null)
    await pos.addOrderItems(session.id, [{ menuItemId: fixture.menu, quantity: 1 }])
    return createUnpaidInvoice(session.id)
  }, { menu: ids.menu })
  const shift = await prisma.cashierShift.findFirstOrThrow({ where: { employeeId: ids.employee, status: 'OPEN' } })
  // Only seed the pending attempt: merchant creation requires external credentials.
  const reference = 'MOMO-' + randomUUID()
  const attempt = await prisma.paymentAttempt.create({
    data: {
      provider: 'MOMO', invoiceId: invoice.id, createdById: ids.employee, shiftId: shift.id,
      amount: '35000', merchantReference: reference, idempotencyKey: randomUUID(), requestHash: 'fixture',
      expiresAt: new Date(Date.now() + 15 * 60_000),
    }
  })
  const env = backendTestEnvironment()
  const substituted = new URLSearchParams({
    vnp_TmnCode: env.VNPAY_TMN_CODE, vnp_TxnRef: reference,
    vnp_Amount: '3500000', vnp_ResponseCode: '00', vnp_TransactionStatus: '00', vnp_TransactionNo: '123456'
  })
  substituted.sort()
  substituted.set('vnp_SecureHash', createHmac('sha512', env.VNPAY_HASH_SECRET).update(substituted.toString()).digest('hex'))
  const rejected = await context.request.get('/api/v1/payments/vnpay/ipn?' + substituted.toString())
  expect(await rejected.json()).toMatchObject({ RspCode: '01' })
  const wrongReturn = await context.request.get('/api/v1/payments/vnpay/return?' + substituted.toString())
  expect(await wrongReturn.json()).toMatchObject({ data: { signatureValid: true, attempt: null } })
  expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status).toBe('PENDING')
  const fields = {
    amount: 35000, extraData: '', message: 'Successful', orderId: reference,
    orderInfo: `Thanh toan hoa don ${invoice.invoiceNumber}`.slice(0, 255), orderType: 'momo_wallet',
    partnerCode: env.MOMO_PARTNER_CODE, payType: 'qr', requestId: reference,
    responseTime: Date.now(), resultCode: 0,
    transId: Number.parseInt(randomUUID().replaceAll('-', '').slice(0, 12), 16)
  }
  const sign = (body: typeof fields) => ({
    ...body, signature: createHmac('sha256', env.MOMO_SECRET_KEY)
      .update(Object.entries({ accessKey: env.MOMO_ACCESS_KEY, ...body }).sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}=${value}`).join('&')).digest('hex')
  })
  const callback = sign(fields)
  await page.goto('/payment/momo/return?' + new URLSearchParams(Object.entries(callback).map(([key, value]) => [key, String(value)])).toString())
  await expect(page.getByRole('status')).toHaveText('Đang chờ ngân hàng xác nhận. Chưa cần thanh toán lại.')
  expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).paymentStatus).toBe('UNPAID')
  const invalid = await context.request.post('/api/v1/payments/momo/ipn', { data: { ...callback, signature: '0'.repeat(64) } })
  expect(invalid.status()).toBe(400)
  const replies = await Promise.all(Array.from({ length: 2 }, () => context.request.post('/api/v1/payments/momo/ipn', { data: callback })))
  expect(replies.map(reply => reply.status())).toEqual([204, 204])
  const delayed = await context.request.post('/api/v1/payments/momo/ipn', { data: sign({ ...fields, resultCode: 1006 }) })
  expect(delayed.status()).toBe(204)
  await expect(page.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Server đã ghi nhận thanh toán thành công.')
  expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status).toBe('SUCCEEDED')
  expect(await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).toMatchObject({ paymentStatus: 'PAID', paymentMethod: 'TRANSFER' })
  expect(await prisma.outboxEvent.count({ where: { eventName: 'order.invoice.paid', aggregateId: invoice.id } })).toBe(1)
  expect(await prisma.cashTransaction.count({ where: { invoiceId: invoice.id } })).toBe(0)
  expect(await prisma.paymentWebhookEvent.count({ where: { paymentAttemptId: attempt.id, provider: 'MOMO' } })).toBe(2)
})

test('provider amount mismatch blocks manual collection and void without a second ledger', async ({ backend, page, context }) => {
  const { ids, prisma } = backend
  await backend.openShift()
  await page.goto('/staff')
  const { invoice, attempt } = await page.evaluate(async fixture => {
    const pos = await import('/src/features/pos/pos.api.ts')
    const invoices = await import('/src/features/invoices/invoices.api.ts')
    const session = await pos.openOrderSession(null)
    await pos.addOrderItems(session.id, [{ menuItemId: fixture.menu, quantity: 1 }])
    const invoice = await invoices.createUnpaidInvoice(session.id)
    const attempt = await invoices.createPaymentAttempt(invoice.id, { provider: 'VNPAY', locale: 'vn', closeSessionAfterPayment: true })
    return { invoice, attempt }
  }, { menu: ids.menu })
  const env = backendTestEnvironment()
  const query = new URLSearchParams({
    vnp_TmnCode: env.VNPAY_TMN_CODE, vnp_TxnRef: attempt.merchantReference,
    vnp_Amount: '3500100', vnp_ResponseCode: '00', vnp_TransactionStatus: '00', vnp_TransactionNo: attempt.id.replaceAll('-', '')
  })
  query.sort()
  query.set('vnp_SecureHash', createHmac('sha512', env.VNPAY_HASH_SECRET).update(query.toString()).digest('hex'))
  const callback = await context.request.get('/api/v1/payments/vnpay/ipn?' + query.toString())
  expect(await callback.json()).toMatchObject({ RspCode: '04' })
  expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status).toBe('REQUIRES_REVIEW')
  const rejected = await page.evaluate(async id => {
    const { updateInvoicePayment, voidInvoice, createPaymentAttempt } = await import('/src/features/invoices/invoices.api.ts')
    const { ApiError } = await import('/src/shared/api/client.ts')
    const codes: number[] = []
    for (const command of [
      () => updateInvoicePayment(id, { paymentStatus: 'PAID', paymentMethod: 'CASH', amountTendered: '50000' }),
      () => voidInvoice(id, 'Reconciliation review blocks invoice voiding'),
      () => createPaymentAttempt(id, { provider: 'VNPAY', locale: 'vn', closeSessionAfterPayment: true }),
    ]) {
      try { await command(); codes.push(200) } catch (error) { codes.push(error instanceof ApiError ? error.status : 0) }
    }
    return codes
  }, invoice.id)
  expect(rejected).toEqual([409, 409, 409])
  expect(await prisma.paymentAttempt.count({ where: { invoiceId: invoice.id } })).toBe(1)
  expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).paymentStatus).toBe('UNPAID')
  expect(await prisma.cashTransaction.count({ where: { invoiceId: invoice.id } })).toBe(0)
  expect(await prisma.outboxEvent.count({ where: { eventName: 'order.invoice.paid', aggregateId: invoice.id } })).toBe(0)
})
