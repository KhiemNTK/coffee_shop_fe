import { createHash } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { defaultMockAdminAuth, defaultMockAdminEmployee, envelope, onlineAvailability } from './helpers.js'

const customerId = '98000000-0000-4000-8000-000000000001'
const otherCustomerId = '98000000-0000-4000-8000-000000000002'
const itemId = '98000000-0000-4000-8000-000000000003'
const voucherId = '98000000-0000-4000-8000-000000000004'
const campaignId = '98000000-0000-4000-8000-000000000005'
const orderId = '98000000-0000-4000-8000-000000000006'
const date = '2026-11-01T00:00:00.000Z'
const endDate = '2099-12-31T00:00:00.000Z'
const fingerprint = 'opaque.customer-quote:original'
const token = 'c'.repeat(64)
const item = {
  id: itemId, name: 'Voucher coffee', price: '35000.10', optionGroups: [],
  category: { id: campaignId, name: 'Coffee' },
}
const snapshot = {
  voucherId, campaignId, name: 'Exact discount', discountType: 'FIXED_AMOUNT',
  discountValue: '5000.05', maxDiscount: null, minSubtotal: '10000.00',
  startDate: date, endDate, discountAmount: '5000.05', totalAmount: '30000.05',
}
const quote = {
  canFulfill: true, reason: null, subtotal: '35000.10', discountAmount: '5000.05',
  totalAmount: '30000.05', voucher: snapshot, quoteFingerprint: fingerprint,
  items: [{ menuItemId: itemId, quantity: 1, unitPrice: '35000.10', selectedOptions: [] }],
}
const body = {
  expectedCustomerId: customerId, clientRequestId: orderId,
  pickupName: 'Voucher customer', phoneNumber: '0901234567', maxSubtotal: '35000.10',
  items: [{ menuItemId: itemId, quantity: 1 }],
  voucherId, expectedTotal: '30000.05', quoteFingerprint: fingerprint,
}
const created = {
  requestId: orderId, status: 'PENDING', expiresAt: endDate, accessToken: token,
  quotedSubtotal: '35000.10', discountAmount: '5000.05', quotedTotal: '30000.05', voucher: snapshot,
  items: [{ lineNumber: 1, menuItemId: itemId, quotedName: item.name,
    quotedUnitPrice: '35000.10', quotedOptions: [], quantity: 1 }],
}
const pageOf = (list: unknown[]) => ({ list, currentPage: 1, totalPages: 1, totalItems: list.length })
const staffOrder = {
  id: orderId, pickupName: body.pickupName, phoneNumber: body.phoneNumber,
  quotedSubtotal: created.quotedSubtotal, quotedTotal: created.quotedTotal,
  discountAmount: created.discountAmount, voucher: snapshot, hasCustomerAccount: true,
  createdAt: date, expiresAt: endDate, items: created.items,
  isOverdue: false, isNoShowEligible: false, orderSessionId: orderId, sessionStatus: 'ACTIVE',
  fulfillmentStatus: 'READY', orderItems: [{ id: itemId, quantity: 1, priceAtTime: '35000.10',
    serveStatus: 'READY', isPaid: false, selectedOptions: [], menuItem: { name: item.name } }],
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('coffee_shop_language', 'en'))
  await page.route('**/api/v1/**', route => route.fulfill({ status: 503, json: {} }))
  await page.route('**/api/v1/customers/me', route => route.fulfill({ json: envelope({ id: customerId, email: 'voucher@example.test' }) }))
  await page.route('**/api/v1/online-orders/availability', route => route.fulfill({ json: envelope(onlineAvailability) }))
  await page.route('**/api/v1/recommendations/online', route => route.fulfill({ json: envelope({ variant: 'CONTROL', recommendations: [] }) }))
  await page.route('**/api/v1/menu/public/items?*', route => route.fulfill({ json: envelope(pageOf([item])) }))
  await page.route('**/api/v1/menu/public/categories', route => route.fulfill({ json: envelope([item.category]) }))
  await page.route('**/api/v1/customers/vouchers?*', route => {
    const params = new URL(route.request().url()).searchParams
    expect(params.get('status')).toBe('AVAILABLE')
    expect(params.get('page')).toBe('1')
    expect(params.get('itemPerPage')).toBe('50')
    return route.fulfill({ json: envelope({ customerId, ...pageOf([{
      id: voucherId, source: 'CLAIM', status: 'AVAILABLE', createdAt: date, expiresAt: endDate,
      campaign: { id: campaignId, name: snapshot.name, description: null,
        discountType: snapshot.discountType, discountValue: snapshot.discountValue,
        maxDiscount: null, minSubtotal: snapshot.minSubtotal, startDate: date, endDate }, orderId: null,
    }]) }) })
  })
  await page.route('**/api/v1/online-orders/quote', route => {
    expect(route.request().postDataJSON()).not.toHaveProperty('voucherId')
    return route.fulfill({ json: envelope({ canFulfill: true, reason: null, subtotal: quote.subtotal, items: quote.items }) })
  })
  await page.route('**/api/v1/customers/orders/quote', route => route.fulfill({ json: envelope(quote) }))
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', route => route.fulfill({
    contentType: 'application/javascript', body: "window.turnstile={render(el,o){o.callback('voucher-human');return 'fixture'},remove(){}}",
  }))
})

async function openCheckout(page: Page) {
  await page.addInitScript(menuItem => sessionStorage.setItem('coffee_shop_storefront_cart', JSON.stringify([{
    id: 'voucher-cart-line', menuItem, quantity: 1, note: '', selectedOptionIds: [], calculatedUnitPrice: menuItem.price,
  }])), item)
  await page.goto('/cart')
  await page.getByRole('button', { name: 'Pickup details', exact: true }).click()
  await page.getByLabel('Pickup name', { exact: true }).fill(body.pickupName)
  await page.getByLabel('Phone number', { exact: true }).fill(body.phoneNumber)
  await expect(page.locator('#checkout-voucher')).toBeEnabled()
}

async function switchCustomer(page: Page, id: string) {
  await page.route('**/api/v1/customers/me', route => route.fulfill({ json: envelope({ id, email: 'changed@example.test' }) }))
  await page.evaluate(async id => {
    const path = '/src/shared/api/query-client.ts'
    const { queryClient } = await import(path)
    queryClient.setQueryData(['customer', 'me'], { id, email: 'changed@example.test' })
  }, id)
}

test('checkout can select the fifty-first voucher without loading the whole wallet', async ({ page }) => {
  const requests: number[] = []
  await page.route('**/api/v1/customers/vouchers?*', route => {
    const params = new URL(route.request().url()).searchParams
    const pageNumber = Number(params.get('page'))
    requests.push(pageNumber)
    expect(params.get('itemPerPage')).toBe('50')
    const entry = { id: voucherId, source: 'CLAIM', status: 'AVAILABLE', createdAt: date, expiresAt: endDate,
      campaign: { id: campaignId, name: snapshot.name, discountType: snapshot.discountType,
        discountValue: snapshot.discountValue, maxDiscount: null, minSubtotal: snapshot.minSubtotal, startDate: date, endDate }, orderId: null }
    const list = pageNumber === 2 ? [entry] : Array.from({ length: 50 }, (_, i) => ({ ...entry, id: `98000000-0000-4000-8000-${String(i + 100).padStart(12, '0')}`, campaign: { ...entry.campaign, name: `Earlier voucher ${i}` } }))
    return route.fulfill({ json: envelope({ customerId, list, totalItems: 51, totalPages: 2, currentPage: pageNumber }) })
  })
  await openCheckout(page)
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(page.locator('#checkout-voucher option[value="' + voucherId + '"]')).toHaveCount(1)
  await page.locator('#checkout-voucher').selectOption(voucherId)
  await expect(page.locator('#checkout-voucher')).toHaveValue(voucherId)
  expect(requests).toContain(2)
})

test('legacy hashes stay exact and every voucher proof field binds customer request identity', async ({ page }) => {
  await page.goto('/cart')
  const hashes = await page.evaluate(async payload => {
    const path = '/src/features/online-orders/online-orders.api.ts'
    const api = await import(path)
    const { expectedCustomerId, voucherId: _voucherId, expectedTotal: _expectedTotal, quoteFingerprint: _fingerprint, ...guest } = payload
    const legacy = { ...guest, expectedCustomerId }
    return {
      guest: await api.hashOnlineOrderRequest(guest), legacy: await api.hashOnlineOrderRequest(legacy),
      voucher: await api.hashOnlineOrderRequest(payload),
      changed: await Promise.all([
        { ...payload, voucherId: expectedCustomerId }, { ...payload, expectedTotal: '30000.06' },
        { ...payload, quoteFingerprint: 'other-opaque-proof' },
      ].map(value => api.hashOnlineOrderRequest(value))),
    }
  }, body)
  const canonical = { pickupName: body.pickupName, phoneNumber: body.phoneNumber, maxSubtotal: '35000.10', items: body.items }
  const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
  expect(hashes.guest).toBe(digest(canonical))
  expect(hashes.legacy).toBe(digest({ ...canonical, customerId }))
  expect(hashes.voucher).toBe(digest({ ...canonical, customerId, voucherId, expectedTotal: '30000.05', quoteFingerprint: fingerprint }))
  for (const changed of hashes.changed) expect(changed).not.toBe(hashes.voucher)
})

test('legacy order responses default gross to net and snapshots reject numeric money', async ({ page }) => {
  await page.goto('/cart')
  const parsed = await page.evaluate(async ({ created, staffOrder, snapshot }) => {
    const path = '/src/features/online-orders/online-orders.api.ts'
    const api = await import(path)
    const { quotedTotal: _quotedTotal, discountAmount: _discountAmount, voucher: _savedVoucher, ...legacy } = created
    const { quotedTotal: _total, discountAmount: _discount, voucher: _voucher, hasCustomerAccount: _customer, ...legacyStaff } = staffOrder
    return {
      created: api.CreateOrderResponseSchema.parse(legacy),
      tracked: api.TrackOrderWithTotalsSchema.parse({ ...legacy, isPaid: false, orderItems: [] }),
      pending: api.PendingOrderSchema.parse(legacyStaff),
      fulfillment: api.FulfillmentOrderSchema.parse(legacyStaff),
      snapshot: api.voucherSnapshotSchema.parse(snapshot),
      acceptsNumber: api.voucherSnapshotSchema.safeParse({ ...snapshot, discountAmount: 5000.05 }).success,
      acceptsMissingNet: api.CreateOrderResponseSchema.safeParse({ ...created, quotedTotal: undefined }).success,
    }
  }, { created, staffOrder, snapshot })
  for (const order of [parsed.created, parsed.tracked, parsed.pending, parsed.fulfillment])
    expect(order).toMatchObject({ quotedTotal: '35000.10', discountAmount: '0', voucher: null })
  expect(parsed.snapshot).toEqual(snapshot)
  expect(parsed.acceptsNumber).toBe(false)
  expect(parsed.acceptsMissingNet).toBe(false)
})

test('invoice document snapshots preserve exact voucher terms and leave legacy absence unchanged', async ({ page }) => {
  await page.goto('/cart')
  const parsed = await page.evaluate(async ({ snapshot, orderId, date }) => {
    const path = '/src/features/invoices/invoices.api.ts'
    const { invoiceSchema } = await import(path)
    const invoice = {
      id: orderId, invoiceNumber: 'VOUCHER-001', subTotal: '35000.10', discountAmount: '5000.05',
      taxAmount: '0', taxRate: '0', totalAmount: '30000.05', paymentMethod: 'CASH', paymentStatus: 'PAID',
      createdAt: date, updatedAt: date, orderSessionId: orderId, employeeId: orderId,
      documentSnapshot: { version: 1, source: 'ISSUED', tableId: null, tableName: null,
        issuedByName: 'Cashier', promotionName: null, items: [] },
    }
    const legacy = invoiceSchema.parse(invoice)
    const saved = invoiceSchema.parse({ ...invoice, documentSnapshot: { ...invoice.documentSnapshot, voucher: snapshot } })
    return { legacyHasVoucher: Object.hasOwn(legacy.documentSnapshot, 'voucher'), snapshot: saved.documentSnapshot.voucher }
  }, { snapshot, orderId, date })
  expect(parsed.legacyHasVoucher).toBe(false)
  expect(parsed.snapshot).toEqual(snapshot)
})

test('customer quote uses customer CSRF and a guest never sends voucher fields', async ({ page, context }) => {
  await context.addCookies([{ name: 'customerCsrfToken', value: 'customer-csrf', url: 'http://localhost:4173' }])
  await page.route('**/api/v1/customers/orders/quote', route => {
    expect(route.request().headers()['x-csrf-token']).toBe('customer-csrf')
    expect(route.request().postDataJSON()).toEqual({ expectedCustomerId: customerId, items: body.items, voucherId })
    return route.fulfill({ json: envelope(quote) })
  })
  let writes = 0
  await page.route('**/api/v1/online-orders/requests', route => { writes++; return route.fulfill({ json: envelope(created) }) })
  await page.goto('/cart')
  const result = await page.evaluate(async body => {
    const path = '/src/features/online-orders/online-orders.api.ts'
    const api = await import(path)
    const customer = await api.quoteCustomerOrder({ expectedCustomerId: body.expectedCustomerId, items: body.items, voucherId: body.voucherId })
    await api.quoteOnlineOrder(body.items)
    const { expectedCustomerId: _id, ...guest } = body
    let rejected = false
    try { await api.createOnlineOrder(guest) } catch { rejected = true }
    return { customer, rejected }
  }, body)
  expect(result.customer.quoteFingerprint).toBe(fingerprint)
  expect(result.rejected).toBe(true)
  expect(writes).toBe(0)
})

test('guest checkout has no voucher selector and keeps the public quote and body', async ({ page }) => {
  await page.route('**/api/v1/customers/me', route => route.fulfill({ status: 401, json: {} }))
  const writes: Record<string, unknown>[] = []
  await page.route('**/api/v1/online-orders/requests', route => { writes.push(route.request().postDataJSON()); return route.abort() })
  await page.route('**/api/v1/customers/orders/quote', () => { throw new Error('Guests must not request customer quotes') })
  await page.addInitScript(menuItem => sessionStorage.setItem('coffee_shop_storefront_cart', JSON.stringify([{
    id: 'guest-cart-line', menuItem, quantity: 1, note: '', selectedOptionIds: [], calculatedUnitPrice: menuItem.price,
  }])), item)
  await page.goto('/cart')
  await page.getByRole('button', { name: 'Pickup details', exact: true }).click()
  await page.getByLabel('Pickup name', { exact: true }).fill(body.pickupName)
  await page.getByLabel('Phone number', { exact: true }).fill(body.phoneNumber)
  await expect(page.locator('#checkout-voucher')).toHaveCount(0)
  await page.getByRole('button', { name: 'Review order', exact: true }).click()
  await page.getByRole('button', { name: 'Submit takeaway order', exact: true }).click()
  await expect.poll(() => writes.length).toBe(1)
  for (const key of ['expectedCustomerId', 'voucherId', 'expectedTotal', 'quoteFingerprint']) expect(writes[0]).not.toHaveProperty(key)
})

test('voucher checkout freezes grant, net proof and original request across account changes and recovery', async ({ page }, info) => {
  const writes: Record<string, unknown>[] = []
  const reads: Record<string, unknown>[] = []
  let quotes = 0
  await page.route('**/api/v1/customers/orders/quote', route => {
    quotes++
    expect(route.request().postDataJSON()).toMatchObject({ expectedCustomerId: customerId, voucherId })
    return route.fulfill({ json: envelope(quote) })
  })
  await page.route('**/api/v1/customers/orders', route => { writes.push(route.request().postDataJSON()); return route.abort() })
  await page.route('**/api/v1/customers/orders/recover', route => {
    reads.push(route.request().postDataJSON())
    return route.fulfill({ status: 503, json: {} })
  })
  await openCheckout(page)
  await page.locator('#checkout-voucher').selectOption(voucherId)
  await page.getByRole('button', { name: 'Review order', exact: true }).click()
  await expect(page.getByTestId('order-net-total')).toContainText('30,000.05')
  await expect(page.locator('#checkout-voucher')).toBeDisabled()
  await page.screenshot({ path: info.outputPath('voucher-review.png'), fullPage: true })
  expect(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.getByRole('button', { name: 'Submit takeaway order', exact: true }).click()
  await expect.poll(() => writes.length).toBe(1)
  await expect(page.getByRole('button', { name: 'Check the submitted order', exact: true })).toBeEnabled()
  await switchCustomer(page, otherCustomerId)
  await page.getByRole('button', { name: 'Check the submitted order', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  expect(reads).toHaveLength(0)
  await switchCustomer(page, customerId)
  await page.getByRole('button', { name: 'Check the submitted order', exact: true }).click()
  await expect.poll(() => reads.length).toBe(1)
  const { turnstileToken: _captcha, ...original } = writes[0]!
  expect(reads[0]).toEqual(original)
  expect(original).toMatchObject({ expectedCustomerId: customerId, voucherId, expectedTotal: '30000.05', quoteFingerprint: fingerprint, maxSubtotal: '35000.10' })
  expect(quotes).toBe(2)
  expect(writes).toHaveLength(1)
})

test('voucher rejection never removes selection or falls back to a full-price write', async ({ page }) => {
  let writes = 0
  await page.route('**/api/v1/customers/orders', route => { writes++; return route.abort() })
  await openCheckout(page)
  await page.locator('#checkout-voucher').selectOption(voucherId)
  await page.getByRole('button', { name: 'Review order', exact: true }).click()
  await page.route('**/api/v1/customers/orders/quote', route => route.fulfill({ status: 409, json: { code: 'VOUCHER_NOT_AVAILABLE', message: 'Voucher no longer available' } }))
  await page.getByRole('button', { name: 'Submit takeaway order', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.locator('#checkout-voucher')).toHaveValue(voucherId)
  expect(writes).toBe(0)
  await page.getByRole('button', { name: 'Edit order', exact: true }).click()
  await expect(page.locator('#checkout-voucher')).toHaveValue(voucherId)
})

test('changed voucher totals and opaque fingerprint require a fresh explicit review', async ({ page }) => {
  const writes: Record<string, unknown>[] = []
  await page.route('**/api/v1/customers/orders', route => { writes.push(route.request().postDataJSON()); return route.abort() })
  await openCheckout(page)
  await page.locator('#checkout-voucher').selectOption(voucherId)
  await page.getByRole('button', { name: 'Review order', exact: true }).click()
  const updated = { ...quote, totalAmount: '31000.05', discountAmount: '4000.05', quoteFingerprint: 'opaque:new',
    voucher: { ...snapshot, discountAmount: '4000.05', totalAmount: '31000.05' } }
  await page.route('**/api/v1/customers/orders/quote', route => route.fulfill({ json: envelope(updated) }))
  await page.getByRole('button', { name: 'Submit takeaway order', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByTestId('order-net-total')).toContainText('31,000.05')
  expect(writes).toHaveLength(0)
  await page.getByRole('button', { name: 'Submit takeaway order', exact: true }).click()
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0]).toMatchObject({ voucherId, maxSubtotal: '35000.10', expectedTotal: '31000.05', quoteFingerprint: 'opaque:new' })
})

test('switching customer invalidates an unsubmitted voucher selection and review', async ({ page }) => {
  await openCheckout(page)
  await page.locator('#checkout-voucher').selectOption(voucherId)
  await page.getByRole('button', { name: 'Review order', exact: true }).click()
  await switchCustomer(page, otherCustomerId)
  await expect(page.locator('#checkout-voucher')).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Review order', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Submit takeaway order', exact: true })).toHaveCount(0)
})

test('reload preserves voucher recovery proof without requoting or issuing a replacement write', async ({ page }) => {
  let writes = 0
  let reads = 0
  await page.route('**/api/v1/customers/orders', route => { writes++; return route.abort() })
  await page.route('**/api/v1/customers/orders/recover-by-key', route => {
    reads++
    expect(route.request().postDataJSON()).toMatchObject({ expectedCustomerId: customerId, clientRequestId: orderId })
    return route.fulfill({ status: 503, json: {} })
  })
  await page.goto('/cart')
  const saved = await page.evaluate(async payload => {
    const path = '/src/features/online-orders/online-orders.api.ts'
    const api = await import(path)
    try { await api.createOnlineOrder(payload) } catch {}
    return {
      ...api.readOnlineOrderRecovery(),
      originalKey: await api.findPendingOnlineOrderKey(payload),
      changedKeys: await Promise.all([
        { ...payload, voucherId: payload.expectedCustomerId },
        { ...payload, expectedTotal: '30000.06' },
        { ...payload, quoteFingerprint: 'other-proof' },
      ].map(value => api.findPendingOnlineOrderKey(value))),
    }
  }, body)
  expect(saved.payload.draft).toMatchObject({ voucherId, expectedTotal: '30000.05', quoteFingerprint: fingerprint, maxSubtotal: '35000.10' })
  expect(JSON.stringify(saved)).not.toContain(body.pickupName)
  expect(saved.originalKey).toBe(orderId)
  expect(saved.changedKeys).toEqual([null, null, null])
  await page.route('**/api/v1/customers/orders/quote', () => { throw new Error('Recovery must not quote') })
  await page.reload()
  await page.getByRole('button', { name: 'Check the submitted order', exact: true }).click()
  await expect.poll(() => reads).toBe(1)
  expect(writes).toBe(1)
})

test('a successful full-price response to a voucher write stays unresolved for recovery', async ({ page }) => {
  await page.route('**/api/v1/customers/orders', route => route.fulfill({ json: envelope({
    ...created, discountAmount: '0', quotedTotal: created.quotedSubtotal, voucher: null,
  }) }))
  await page.goto('/cart')
  const result = await page.evaluate(async payload => {
    const path = '/src/features/online-orders/online-orders.api.ts'
    const api = await import(path)
    let rejected = false
    try { await api.createOnlineOrder(payload) } catch { rejected = true }
    return { rejected, saved: api.readOnlineOrderRecovery() }
  }, body)
  expect(result.rejected).toBe(true)
  expect(result.saved.payload.draft).toMatchObject({ voucherId, expectedTotal: body.expectedTotal, quoteFingerprint: fingerprint })
})

test('reorder copies only items and never the previous voucher or quote proof', async ({ page }) => {
  const writes: Record<string, unknown>[] = []
  await page.route(`**/api/v1/customers/orders/${orderId}/reorder-template`, route => route.fulfill({ json: envelope({
    customerId, voucherId, voucher: snapshot, expectedTotal: body.expectedTotal, quoteFingerprint: fingerprint,
    items: [{ menuItemId: itemId, quantity: 1, optionIds: [] }],
    quote: { previousSubtotal: quote.subtotal, currentSubtotal: quote.subtotal, canSubmit: true, stockAvailable: true,
      lines: [{ lineNumber: 1, previousName: item.name, previousUnitPrice: item.price,
        currentName: item.name, currentUnitPrice: item.price, available: true, reason: null }] },
  }) }))
  await page.route('**/api/v1/customers/orders', route => { writes.push(route.request().postDataJSON()); return route.abort() })
  await page.goto(`/account/orders/${orderId}/reorder`)
  await page.getByLabel('Pickup name', { exact: true }).fill(body.pickupName)
  await page.getByLabel('Phone', { exact: true }).fill(body.phoneNumber)
  await page.getByRole('button', { name: /^Reorder/ }).click()
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0]).toMatchObject({ expectedCustomerId: customerId, maxSubtotal: '35000.10', items: [{ menuItemId: itemId, quantity: 1, optionIds: [] }] })
  for (const key of ['voucherId', 'voucher', 'expectedTotal', 'quoteFingerprint']) expect(writes[0]).not.toHaveProperty(key)
})

test('customer history and detail display the saved net total without recalculating a voucher', async ({ page }, info) => {
  await page.route('**/api/v1/customers/orders?*', route => route.fulfill({ json: envelope({
    customerId, ...pageOf([{ id: orderId, status: 'PENDING', createdAt: date, pickupAt: null,
      quotedSubtotal: created.quotedSubtotal, discountAmount: created.discountAmount,
      quotedTotal: created.quotedTotal, voucher: snapshot }]),
  }) }))
  await page.route(`**/api/v1/customers/orders/${orderId}`, route => route.fulfill({ json: envelope({
    ...created, customerId, pickupAccessToken: null, invoices: [], isPaid: false, orderItems: [],
  }) }))
  await page.goto('/account')
  const entry = page.locator(`a[href="/account/orders/${orderId}"]`)
  await expect(entry).toContainText('30,000.05')
  await expect(entry).not.toContainText('35,000.10')
  await entry.click()
  await expect(page.getByTestId('order-totals')).toContainText('35,000.10')
  await expect(page.getByTestId('order-totals')).toContainText('-5,000.05')
  await expect(page.getByTestId('order-net-total')).toContainText('30,000.05')
  await expect(page.getByTestId('order-totals')).toContainText(snapshot.name)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('voucher-account-order.png'), fullPage: true })
})

test('public tracking displays saved gross discount and net without campaign lookups', async ({ page }) => {
  await page.addInitScript(access => sessionStorage.setItem('coffee_shop_takeaway_order', JSON.stringify([access])), {
    requestId: orderId, accessToken: token,
  })
  await page.route('**/api/v1/online-orders/requests/status', route => route.fulfill({
    json: envelope({ ...created, isPaid: false, orderItems: [] }),
  }))
  await page.goto('/order')
  await expect(page.getByTestId('order-totals')).toContainText('35,000.10')
  await expect(page.getByTestId('order-totals')).toContainText('-5,000.05')
  await expect(page.getByTestId('order-totals')).toContainText(snapshot.name)
  await expect(page.getByTestId('order-net-total')).toContainText('30,000.05')
})

async function openStaff(page: Page, permissions: string[], tab = 'fulfillment', hasCustomerAccount = true) {
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: envelope(defaultMockAdminEmployee) }))
  await page.route('**/api/v1/auth/me/permissions', route => route.fulfill({ json: envelope(defaultMockAdminAuth(permissions)) }))
  await page.route('**/api/v1/online-orders/requests?*', route => route.fulfill({ json: envelope(pageOf([{ ...staffOrder, hasCustomerAccount }])) }))
  await page.route('**/api/v1/online-orders/requests/fulfillment?*', route => route.fulfill({ json: envelope(pageOf([{ ...staffOrder, hasCustomerAccount }])) }))
  await page.goto(`/staff/online-orders?tab=${tab}`)
}

test('collection uses net default cash and exact change, with gross discount and net detail', async ({ page }, info) => {
  await openStaff(page, ['/online-orders_read', '/orders_items_handoff', '/invoices_create', '/invoices_pay'])
  await expect(page.getByTestId('order-net-total')).toContainText('30,000.05')
  await page.getByRole('button', { name: 'Collect cash & Hand over', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Cash received (VND)')).toHaveValue('30000.05')
  await dialog.getByLabel('Cash received (VND)').fill('40000.10')
  await expect(dialog).toContainText('10,000.05')
  await expect(dialog.getByTestId('order-totals')).toContainText(snapshot.name)
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('voucher-collection.png'), fullPage: true })
})

for (const tab of ['pending', 'fulfillment']) {
  test(`voucher gift is available only for the selected customer order in ${tab} detail`, async ({ page }) => {
    await openStaff(page, ['/online-orders_read', '/vouchers_read', '/vouchers_issue'], tab)
    await expect(page.getByRole('button', { name: 'Gift voucher', exact: true })).toBeVisible()
  })
}
for (const missing of ['/vouchers_read', '/vouchers_issue', 'customer']) {
  test(`voucher gift is hidden without ${missing}`, async ({ page }) => {
    const permissions = ['/online-orders_read', '/vouchers_read', '/vouchers_issue'].filter(key => key !== missing)
    await openStaff(page, permissions, 'pending', missing !== 'customer')
    await expect(page.getByTestId('order-net-total')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Gift voucher', exact: true })).toHaveCount(0)
  })
}
