import { test, expect } from '../fixtures/live-backend'
import { createHash, randomUUID } from 'node:crypto'

test('concurrent stock export cannot oversell and failed bulk export rolls back every row', async ({ backend, page }) => {
  const { prefix, ids, prisma } = backend
  await page.goto('/staff')
  await expect(page.getByRole('heading', { name: prefix, exact: true })).toBeVisible()
  const results = await page.evaluate(async fixture => {
    const { bulkMoveStock } = await import('/src/features/inventory/operations.api.ts')
    const results = await Promise.allSettled(['race-one', 'race-two'].map(note => bulkMoveStock({
      type: 'EXPORT',
      items: [{ inventoryItemId: fixture.inventoryItem, quantity: '1.0001', note }]
    })))
    return results.map(result => result.status === 'fulfilled'
      ? { status: 'fulfilled', quantity: result.value[0]!.quantity }
      : { status: 'rejected', httpStatus: (result.reason as { status: number }).status })
  }, ids)
  expect(results.filter(result => result.status === 'fulfilled')).toEqual([{ status: 'fulfilled', quantity: '1.0001' }])
  expect(results.filter(result => result.status === 'rejected')).toEqual([{ status: 'rejected', httpStatus: 409 }])
  const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: ids.inventoryItem } })
  expect(item.stock.toString()).toBe('0.2344')
  expect(await prisma.inventoryTransaction.count({ where: { inventoryItemId: ids.inventoryItem } })).toBe(1)
  const beforeAudit = await prisma.actionLog.count({ where: { employeeId: ids.employee, actionType: 'INVENTORY_EXPORT' } })
  const beforeOutbox = await prisma.outboxEvent.count({ where: { topic: 'inventory' } })
  const failed = await page.evaluate(async fixture => {
    const { bulkMoveStock } = await import('/src/features/inventory/operations.api.ts')
    try {
      await bulkMoveStock({
        type: 'EXPORT', items: [
          { inventoryItemId: fixture.inventoryItem, quantity: '0.2000', note: 'rollback-first' },
          { inventoryItemId: fixture.emptyItem, quantity: '0.2000', note: 'rollback-second' },
        ]
      })
      return 0
    } catch (error) { return (error as { status: number }).status }
  }, ids)
  expect(failed).toBe(409)
  expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: ids.inventoryItem } })).stock.toString()).toBe('0.2344')
  expect(await prisma.inventoryTransaction.count({ where: { inventoryItemId: { in: [ids.inventoryItem!, ids.emptyItem!] } } })).toBe(1)
  expect(await prisma.actionLog.count({ where: { employeeId: ids.employee, actionType: 'INVENTORY_EXPORT' } })).toBe(beforeAudit)
  expect(await prisma.outboxEvent.count({ where: { topic: 'inventory' } })).toBe(beforeOutbox)
})

test('receipt draft and posting update the real inventory and weighted-average cost through the UI', async ({ backend, page }, info) => {
  const { prefix, ids, prisma } = backend
  await page.goto('/staff/inventory')
  await page.getByRole('button', { name: 'Mua hàng & Kiểm kê' }).click()
  await page.getByRole('button', { name: 'Phiếu nhập', exact: true }).click()
  await page.getByRole('button', { name: 'Tạo mới', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Tạo phiếu nhập nháp' })
  await dialog.getByLabel('Tìm nhà cung cấp', { exact: true }).fill(prefix)
  await dialog.getByRole('combobox', { name: 'Nhà cung cấp', exact: true }).selectOption(ids.supplier)
  await dialog.getByLabel('Tìm nguyên liệu', { exact: true }).fill(prefix + '-procurement')
  await dialog.getByRole('combobox', { name: 'Nguyên liệu', exact: true }).selectOption(ids.procurementItem)
  await dialog.getByLabel('Số lượng', { exact: true }).fill('5')
  await dialog.getByLabel('Đơn giá', { exact: true }).fill('23000')
  const note = prefix + '-ui-receipt'
  await dialog.getByLabel('Ghi chú', { exact: true }).fill(note)
  await dialog.getByRole('button', { name: 'Lưu phiếu nháp', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  const draft = await prisma.purchaseReceipt.findFirstOrThrow({ where: { note, createdById: ids.employee } })
  expect(draft.status).toBe('DRAFT')
  expect(draft.totalAmount.toString()).toBe('115000')
  expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: ids.procurementItem } })).stock.toString()).toBe('10')
  expect(await prisma.inventoryTransaction.count({ where: { purchaseReceiptItem: { purchaseReceiptId: draft.id } } })).toBe(0)
  const row = page.getByRole('row').filter({ hasText: draft.receiptNumber })
  await row.getByRole('button', { name: 'Ghi sổ', exact: true }).click()
  await page.getByRole('dialog', { name: 'Xác nhận ghi sổ' }).getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(row).toContainText('Đã ghi sổ')
  const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: ids.procurementItem } })
  expect(item.stock.toString()).toBe('15')
  expect(item.averageUnitCost.toString()).toBe('21000')
  expect(await prisma.inventoryTransaction.count({ where: { purchaseReceiptItem: { purchaseReceiptId: draft.id } } })).toBe(1)
  expect(await prisma.outboxEvent.count({ where: { aggregateId: draft.id } })).toBe(1)
  expect(await prisma.actionLog.count({
    where: {
      employeeId: ids.employee, actionType: 'INVENTORY_PURCHASE_RECEIPT_POSTED',
      details: { path: ['purchaseReceiptId'], equals: draft.id }
    }
  })).toBe(1)
  await row.getByRole('button', { name: 'Chi tiết', exact: true }).click()
  const detail = page.getByRole('dialog', { name: draft.receiptNumber })
  await expect(detail.getByLabel('Số lượng', { exact: true })).toBeDisabled()
  await expect(detail.getByRole('button', { name: 'Lưu phiếu nháp', exact: true })).toHaveCount(0)
  await detail.getByRole('button', { name: 'Đóng', exact: true }).click()
  await page.getByRole('button', { name: 'Kho hàng & Tồn kho' }).click()
  await page.getByPlaceholder('Tìm tên nguyên liệu…').fill(prefix + '-procurement')
  const inventoryTable = page.getByRole('region', { name: 'Danh sách tồn kho', exact: true }).getByRole('table')
  const inventoryRow = inventoryTable.getByRole('row').filter({ hasText: prefix + '-procurement' })
  await expect(inventoryRow).toBeVisible()
  const columns = await inventoryTable.getByRole('columnheader').allTextContents()
  expect(columns).toEqual(expect.arrayContaining(['Tồn thực tế', 'Giá vốn BQ']))
  await expect(inventoryRow.getByRole('cell').nth(columns.indexOf('Tồn thực tế'))).toContainText('15')
  const costCell = inventoryRow.getByRole('cell').nth(columns.indexOf('Giá vốn BQ'))
  await expect(costCell).toContainText('21.000')
  await costCell.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('procurement-stock-cost.png'), fullPage: true })
})

test('concurrent receipt create and post replay once and posted documents reject mutations', async ({ backend, page }) => {
  const { prisma, prefix, ids } = backend
  const item = await prisma.inventoryItem.create({
    data: {
      name: prefix + '-receipt-race', stock: '1.2345',
      averageUnitCost: '100.25', categoryId: ids.inventoryCategory, unitId: ids.unit
    }
  })
  await page.goto('/staff')
  await expect(page.getByRole('heading', { name: prefix, exact: true })).toBeVisible()
  const result = await page.evaluate(async input => {
    const api = await import('/src/features/inventory/procurement.api.ts')
    const payload = {
      supplierId: input.supplierId, note: input.note,
      items: [{ inventoryItemId: input.itemId, quantity: '0.0005', unitPrice: '200.75' }]
    }
    const receipts = await Promise.all([api.saveReceipt(payload), api.saveReceipt(payload)])
    const receipt = receipts[0]!
    const review = { expectedUpdatedAt: receipt.updatedAt }
    const posts = await Promise.all([api.postDocument('purchase-receipts', receipt.id, review), api.postDocument('purchase-receipts', receipt.id, review)])
    const rejected = async (operation: () => Promise<unknown>) => {
      try { await operation(); return 0 } catch (error) { return (error as { status: number }).status }
    }
    return {
      ids: receipts.map(row => row.id), posts: posts.map(row => row.status),
      newPost: await rejected(() => api.postDocument('purchase-receipts', receipt.id, review)),
      update: await rejected(() => api.saveReceipt({ ...payload, note: 'Changed' }, receipt.id)),
      cancel: await rejected(() => api.cancelDocument('purchase-receipts', receipt.id, 'Cannot cancel posted receipt'))
    }
  }, { supplierId: ids.supplier, itemId: item.id, note: prefix + '-receipt-race' })
  expect(result.ids[0]).toBe(result.ids[1])
  expect(result.posts).toEqual(['POSTED', 'POSTED'])
  expect([result.newPost, result.update, result.cancel]).toEqual([409, 409, 409])
  const persisted = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })
  expect(persisted.stock.toString()).toBe('1.235')
  expect(persisted.averageUnitCost.toString()).toBe('100.29')
  expect(await prisma.inventoryTransaction.count({ where: { inventoryItemId: item.id } })).toBe(1)
  expect(await prisma.purchaseReceipt.count({ where: { createdById: ids.employee, note: prefix + '-receipt-race' } })).toBe(1)
  expect(await prisma.outboxEvent.count({ where: { aggregateId: result.ids[0] } })).toBe(1)
  const creation = await prisma.idempotencyRequest.findFirstOrThrow({
    where: {
      employeeId: ids.employee,
      operation: 'inventory.purchase-receipt.create', response: { path: ['id'], equals: result.ids[0] }
    }
  })
  const changedIntent = await page.evaluate(async input => {
    const { apiMutate } = await import('/src/shared/api/client.ts')
    const { receiptDetailSchema } = await import('/src/features/inventory/procurement.api.ts')
    try {
      await apiMutate('/inventory/purchase-receipts', 'POST', receiptDetailSchema,
        {
          supplierId: input.supplierId, note: 'Different intent', idempotencyKey: input.key,
          items: [{ inventoryItemId: input.itemId, quantity: '0.0005', unitPrice: '200.75' }]
        }); return 0
    }
    catch (error) { return (error as { status: number }).status }
  }, { supplierId: ids.supplier, itemId: item.id, key: creation.key })
  expect(changedIntent).toBe(409)
})

test('failed multi-line receipt posting rolls back stock, ledger, audit, outbox and its key', async ({ backend, page }) => {
  const { prisma, prefix, ids } = backend
  const firstId = '00000000-0000-4000-8000-' + randomUUID().slice(-12)
  const lastId = 'ffffffff-ffff-4fff-8fff-' + randomUUID().slice(-12)
  await prisma.inventoryItem.createMany({
    data: [firstId, lastId].map((id, index) => ({
      id,
      name: prefix + '-receipt-rollback-' + index, stock: '2', averageUnitCost: '10',
      categoryId: ids.inventoryCategory, unitId: ids.unit
    }))
  })
  await page.goto('/staff')
  await expect(page.getByRole('heading', { name: prefix, exact: true })).toBeVisible()
  const receipt = await page.evaluate(async input => {
    const api = await import('/src/features/inventory/procurement.api.ts')
    return api.saveReceipt({ supplierId: input.supplierId, items: input.itemIds.map(inventoryItemId => ({ inventoryItemId, quantity: '1', unitPrice: '20' })) })
  }, { supplierId: ids.supplier, itemIds: [firstId, lastId] })
  await prisma.inventoryItem.update({ where: { id: lastId }, data: { deletedAt: new Date() } })
  const post = () => page.evaluate(async input => {
    const { postDocument } = await import('/src/features/inventory/procurement.api.ts')
    try { await postDocument('purchase-receipts', input.id, { expectedUpdatedAt: input.updatedAt }); return 0 } catch (error) { return (error as { status: number }).status }
  }, { id: receipt.id, updatedAt: receipt.updatedAt })
  expect(await post()).toBe(409)
  expect((await prisma.purchaseReceipt.findUniqueOrThrow({ where: { id: receipt.id } })).status).toBe('DRAFT')
  const stock = await prisma.inventoryItem.findMany({ where: { id: { in: [firstId, lastId] } } })
  expect(stock.map(row => [row.stock.toString(), row.averageUnitCost.toString()])).toEqual([['2', '10'], ['2', '10']])
  expect(await prisma.inventoryTransaction.count({ where: { purchaseReceiptItem: { purchaseReceiptId: receipt.id } } })).toBe(0)
  expect(await prisma.outboxEvent.count({ where: { aggregateId: receipt.id } })).toBe(0)
  expect(await prisma.actionLog.count({
    where: {
      employeeId: ids.employee, actionType: 'INVENTORY_PURCHASE_RECEIPT_POSTED',
      details: { path: ['purchaseReceiptId'], equals: receipt.id }
    }
  })).toBe(0)
  expect(await prisma.idempotencyRequest.count({
    where: {
      employeeId: ids.employee, operation: 'inventory.purchase-receipt.post',
      requestHash: createHash('sha256').update(JSON.stringify({ id: receipt.id, expectedUpdatedAt: receipt.updatedAt })).digest('hex')
    }
  })).toBe(0)
  await prisma.inventoryItem.update({ where: { id: lastId }, data: { deletedAt: null } })
  expect(await post()).toBe(0)
  expect(await prisma.inventoryTransaction.count({ where: { purchaseReceiptItem: { purchaseReceiptId: receipt.id } } })).toBe(2)
  expect(await prisma.outboxEvent.count({ where: { aggregateId: receipt.id } })).toBe(1)
})

test('stocktake UI posts positive negative and zero variances with exact cost snapshots', async ({ backend, page }, info) => {
  const { prisma, prefix, ids } = backend
  const values = [['5.1234', '10', '5.6235'], ['8.3333', '20.25', '7.1111'], ['0.0001', '100', '0.0001']] as const
  const items: { id: string; name: string; counted: string; averageUnitCost: string }[] = []
  for (const [index, [stock, averageUnitCost, counted]] of values.entries()) {
    const item = await prisma.inventoryItem.create({
      data: {
        name: prefix + '-stocktake-ui-' + index,
        stock, averageUnitCost, categoryId: ids.inventoryCategory, unitId: ids.unit
      }
    })
    items.push({ id: item.id, name: item.name, counted, averageUnitCost })
  }
  await page.goto('/staff/inventory')
  await page.getByRole('button', { name: 'Mua hàng & Kiểm kê' }).click()
  await page.getByRole('button', { name: 'Kiểm kê', exact: true }).click()
  await page.getByRole('button', { name: 'Tạo mới', exact: true }).click()
  const creation = page.getByRole('dialog', { name: 'Tạo phiếu kiểm kê' })
  await creation.getByLabel('Tìm nguyên liệu', { exact: true }).fill(prefix + '-stocktake-ui-')
  await expect(creation.getByRole('checkbox')).toHaveCount(3)
  for (const checkbox of await creation.getByRole('checkbox').all()) await checkbox.check()
  const note = prefix + '-stocktake-ui'
  await creation.getByLabel('Ghi chú', { exact: true }).fill(note)
  await creation.getByRole('button', { name: 'Tạo phiếu kiểm kê', exact: true }).click()
  await expect(creation).not.toBeVisible()
  const draft = await prisma.stocktake.findFirstOrThrow({ where: { note, createdById: ids.employee } })
  const row = page.getByRole('row').filter({ hasText: draft.stocktakeNumber })
  await row.getByRole('button', { name: 'Ghi sổ', exact: true }).click()
  const review = page.getByRole('dialog', { name: 'Xác nhận ghi sổ' })
  await expect(review.getByRole('button', { name: 'Xác nhận', exact: true })).toBeDisabled()
  await expect(review.getByRole('table')).toContainText('Chưa đếm')
  await review.getByRole('button', { name: 'Đóng', exact: true }).click()
  await row.getByRole('button', { name: 'Chi tiết', exact: true }).click()
  const detail = page.getByRole('dialog', { name: draft.stocktakeNumber })
  for (const item of items) await detail.getByRole('spinbutton', { name: `Số lượng thực đếm ${item.name}`, exact: true }).fill(item.counted)
  await detail.getByRole('button', { name: 'Lưu số đếm', exact: true }).click()
  await expect(detail).not.toBeVisible()
  await row.getByRole('button', { name: 'Ghi sổ', exact: true }).click()
  await expect(review.getByRole('table')).toContainText('0,5001')
  await expect(review.getByRole('table')).toContainText('-1,2222')
  await expect(review.getByRole('button', { name: 'Xác nhận', exact: true })).toBeEnabled()
  await expect(review.getByRole('cell').filter({ hasText: '-1,2222' })).toBeInViewport()
  if (info.project.name === 'desktop') await expect(review.getByRole('columnheader', { name: 'Chênh lệch', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('real-stocktake-review.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  await review.getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(row).toContainText('Đã ghi sổ')
  const transactions = await prisma.inventoryTransaction.findMany({ where: { stocktakeItem: { stocktakeId: draft.id } } })
  expect(transactions).toHaveLength(2)
  expect(transactions.find(line => line.inventoryItemId === items[0]!.id)).toMatchObject({ type: 'IMPORT' })
  expect(transactions.find(line => line.inventoryItemId === items[0]!.id)?.quantity.toString()).toBe('0.5001')
  expect(transactions.find(line => line.inventoryItemId === items[0]!.id)?.totalAmount?.toString()).toBe('5')
  expect(transactions.find(line => line.inventoryItemId === items[1]!.id)).toMatchObject({ type: 'EXPORT' })
  expect(transactions.find(line => line.inventoryItemId === items[1]!.id)?.quantity.toString()).toBe('1.2222')
  expect(transactions.find(line => line.inventoryItemId === items[1]!.id)?.totalAmount?.toString()).toBe('24.75')
  for (const item of items) {
    const persisted = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })
    expect(persisted.stock.toString()).toBe(item.counted)
    expect(persisted.averageUnitCost.toString()).toBe(item.averageUnitCost.toString())
  }
  expect(await prisma.outboxEvent.count({ where: { aggregateId: draft.id } })).toBe(1)
  expect(await prisma.actionLog.count({
    where: {
      employeeId: ids.employee, actionType: 'INVENTORY_STOCKTAKE_POSTED',
      details: { path: ['stocktakeId'], equals: draft.id }
    }
  })).toBe(1)
  await row.getByRole('button', { name: 'Chi tiết', exact: true }).click()
  await expect(detail.getByRole('table')).toContainText('-1,2222')
  await expect(detail.getByRole('spinbutton')).toHaveCount(0)
})

test('stocktake create replays and different posting keys cannot write the ledger twice', async ({ backend, page }) => {
  const { prisma, prefix, ids } = backend
  const item = await prisma.inventoryItem.create({
    data: {
      name: prefix + '-stocktake-race', stock: '10',
      averageUnitCost: '20', categoryId: ids.inventoryCategory, unitId: ids.unit
    }
  })
  await page.goto('/staff')
  await expect(page.getByRole('heading', { name: prefix, exact: true })).toBeVisible()
  const result = await page.evaluate(async input => {
    const api = await import('/src/features/inventory/procurement.api.ts')
    const { apiMutate } = await import('/src/shared/api/client.ts')
    const statusSchema = api.stocktakeSchema.pick({ id: true, status: true })
    const created = await Promise.all([api.createStocktake([input.itemId], input.note), api.createStocktake([input.itemId], input.note)])
    const id = created[0]!.id
    const rejected = async (operation: () => Promise<unknown>) => {
      try { await operation(); return 0 } catch (error) { return (error as { status: number }).status }
    }
    const uncounted = await rejected(() => api.postDocument('stocktakes', id))
    await api.saveCounts(id, [{ inventoryItemId: input.itemId, countedQuantity: '9.9999' }])
    const keys = [crypto.randomUUID(), crypto.randomUUID()]
    const post = (key: string) => apiMutate(`/inventory/stocktakes/${id}/post`, 'POST', statusSchema, { idempotencyKey: key })
    const posts = await Promise.all(keys.map(async key => ({ key, status: await rejected(() => post(key)) })))
    const winner = posts.find(row => row.status === 0)!
    const replay = await post(winner.key)
    return {
      id, createdIds: created.map(row => row.id), uncounted, statuses: posts.map(row => row.status).sort(), replay: replay.status,
      update: await rejected(() => api.saveCounts(id, [{ inventoryItemId: input.itemId, countedQuantity: '0' }])),
      cancel: await rejected(() => api.cancelDocument('stocktakes', id, 'Posted document must stay immutable'))
    }
  }, { itemId: item.id, note: prefix + '-stocktake-race' })
  expect(result.createdIds).toEqual([result.id, result.id])
  expect(result.uncounted).toBe(409)
  expect(result.statuses).toEqual([0, 409])
  expect(result.replay).toBe('POSTED')
  expect([result.update, result.cancel]).toEqual([409, 409])
  expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).stock.toString()).toBe('9.9999')
  expect(await prisma.inventoryTransaction.count({ where: { stocktakeItem: { stocktakeId: result.id } } })).toBe(1)
  expect(await prisma.outboxEvent.count({ where: { aggregateId: result.id } })).toBe(1)
  expect(await prisma.actionLog.count({
    where: {
      employeeId: ids.employee, actionType: 'INVENTORY_STOCKTAKE_POSTED',
      details: { path: ['stocktakeId'], equals: result.id }
    }
  })).toBe(1)
})

test('posting rejects counts edited after review and accepts an explicitly refreshed review', async ({ backend, page }) => {
  const { prisma, prefix, ids } = backend
  const item = await prisma.inventoryItem.create({
    data: {
      name: prefix + '-stocktake-review', stock: '2',
      averageUnitCost: '10', categoryId: ids.inventoryCategory, unitId: ids.unit
    }
  })
  await page.goto('/staff')
  await expect(page.getByRole('heading', { name: prefix, exact: true })).toBeVisible()
  const result = await page.evaluate(async itemId => {
    const api = await import('/src/features/inventory/procurement.api.ts')
    const draft = await api.createStocktake([itemId])
    await api.saveCounts(draft.id, [{ inventoryItemId: itemId, countedQuantity: '1.2345' }])
    const review = await api.getStocktake(draft.id)
    await api.saveCounts(draft.id, [{ inventoryItemId: itemId, countedQuantity: '1.1111' }])
    try {
      await api.postDocument('stocktakes', draft.id, {
        expectedCounts: review.items.map(line => ({
          inventoryItemId: line.inventoryItemId, countedQuantity: line.countedQuantity!,
        }))
      }); return { id: draft.id, status: 0, code: '' }
    }
    catch (error) { const failure = error as { status: number; code: string }; return { id: draft.id, status: failure.status, code: failure.code } }
  }, item.id)
  expect(result.status).toBe(409)
  expect(result.code).toBe('INVENTORY_STOCKTAKE_COUNTS_CHANGED')
  expect((await prisma.stocktake.findUniqueOrThrow({ where: { id: result.id } })).status).toBe('DRAFT')
  expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).stock.toString()).toBe('2')
  expect(await prisma.inventoryTransaction.count({ where: { stocktakeItem: { stocktakeId: result.id } } })).toBe(0)
  expect(await prisma.outboxEvent.count({ where: { aggregateId: result.id } })).toBe(0)
  await page.evaluate(async id => {
    const api = await import('/src/features/inventory/procurement.api.ts')
    const refreshed = await api.getStocktake(id)
    await api.postDocument('stocktakes', id, { expectedCounts: refreshed.items.map(line => ({ inventoryItemId: line.inventoryItemId, countedQuantity: line.countedQuantity! })) })
  }, result.id)
  expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).stock.toString()).toBe('1.1111')
  expect(await prisma.inventoryTransaction.count({ where: { stocktakeItem: { stocktakeId: result.id } } })).toBe(1)
})

test('stale stocktake rolls back every line and requires cancellation plus a new snapshot', async ({ backend, page }) => {
  const { prisma, prefix, ids } = backend
  const itemIds = ['00000000-0000-4000-8000-' + randomUUID().slice(-12), 'ffffffff-ffff-4fff-8fff-' + randomUUID().slice(-12)]
  await prisma.inventoryItem.createMany({
    data: itemIds.map((id, index) => ({
      id, name: prefix + '-stocktake-stale-' + index,
      stock: '2', averageUnitCost: '10', categoryId: ids.inventoryCategory, unitId: ids.unit
    }))
  })
  await page.goto('/staff')
  await expect(page.getByRole('heading', { name: prefix, exact: true })).toBeVisible()
  const draft = await page.evaluate(async ids => {
    const api = await import('/src/features/inventory/procurement.api.ts')
    const draft = await api.createStocktake(ids)
    await api.saveCounts(draft.id, ids.map(inventoryItemId => ({ inventoryItemId, countedQuantity: '1' })))
    return draft
  }, itemIds)
  await prisma.inventoryItem.update({ where: { id: itemIds[1] }, data: { stock: '3' } })
  const attempt = () => page.evaluate(async id => {
    const { postDocument } = await import('/src/features/inventory/procurement.api.ts')
    try { await postDocument('stocktakes', id); return { status: 0, code: '' } }
    catch (error) { const failure = error as { status: number; code: string }; return { status: failure.status, code: failure.code } }
  }, draft.id)
  expect(await attempt()).toEqual({ status: 409, code: 'INVENTORY_STOCKTAKE_SNAPSHOT_STALE' })
  await page.evaluate(async input => {
    const { saveCounts } = await import('/src/features/inventory/procurement.api.ts')
    await saveCounts(input.id, input.itemIds.map(inventoryItemId => ({ inventoryItemId, countedQuantity: '3' })))
  }, { id: draft.id, itemIds })
  expect(await attempt()).toEqual({ status: 409, code: 'INVENTORY_STOCKTAKE_SNAPSHOT_STALE' })
  const persisted = await prisma.stocktake.findUniqueOrThrow({ where: { id: draft.id }, include: { items: true } })
  expect(persisted.status).toBe('DRAFT')
  expect(persisted.items.every(line => line.expectedQuantity.toString() === '2' && line.differenceQuantity === null)).toBe(true)
  expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemIds[0] } })).stock.toString()).toBe('2')
  expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemIds[1] } })).stock.toString()).toBe('3')
  expect(await prisma.inventoryTransaction.count({ where: { stocktakeItem: { stocktakeId: draft.id } } })).toBe(0)
  expect(await prisma.outboxEvent.count({ where: { aggregateId: draft.id } })).toBe(0)
  expect(await prisma.actionLog.count({
    where: {
      actionType: 'INVENTORY_STOCKTAKE_POSTED',
      details: { path: ['stocktakeId'], equals: draft.id }
    }
  })).toBe(0)
  expect(await prisma.idempotencyRequest.count({
    where: {
      employeeId: ids.employee, operation: 'inventory.stocktake.post',
      requestHash: createHash('sha256').update(JSON.stringify({ id: draft.id })).digest('hex')
    }
  })).toBe(0)
  const fresh = await page.evaluate(async input => {
    const api = await import('/src/features/inventory/procurement.api.ts')
    await api.cancelDocument('stocktakes', input.id, 'Stock changed after original snapshot')
    return api.createStocktake(input.itemIds)
  }, { id: draft.id, itemIds })
  expect((await prisma.stocktake.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe('CANCELLED')
  expect(fresh.items.map(line => line.expectedQuantity)).toEqual(['2', '3'])
  expect(fresh.items.every(line => line.countedQuantity === null)).toBe(true)
  expect(await prisma.inventoryTransaction.count({ where: { inventoryItemId: { in: itemIds } } })).toBe(0)
  await page.evaluate(async input => {
    const api = await import('/src/features/inventory/procurement.api.ts')
    await api.saveCounts(input.id, input.itemIds.map(inventoryItemId => ({ inventoryItemId, countedQuantity: '1' })))
    await api.postDocument('stocktakes', input.id)
  }, { id: fresh.id, itemIds })
  expect(await prisma.inventoryTransaction.count({ where: { stocktakeItem: { stocktakeId: fresh.id } } })).toBe(2)
})
