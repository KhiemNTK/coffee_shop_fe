import { expect, request, test } from '@playwright/test'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { createHash, createHmac, randomUUID } from 'node:crypto'
import type { PrismaClient } from '../.runtime/backend-client'
import { backendTestEnvironment } from './backend-environment.ts'

test.describe('real Docker backend contract', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })
  const requireBackend = createRequire(resolve('../coffee_shop_be/package.json'))
  const fixtureNames = ['position', 'employee', 'role', 'category', 'menu',
    'session', 'invoice', 'item', 'supplier', 'receipt', 'stocktake', 'unit',
    'inventoryCategory', 'inventoryItem', 'emptyItem', 'procurementItem', 'cashFund', 'bankFund', 'restrictedEmployee', 'candidate', 'optionGroup', 'option', 'googleEmployee'] as const
  const ids = Object.fromEntries(fixtureNames.map(name => [name, randomUUID()])) as Record<typeof fixtureNames[number], string>
  ids.inventoryItem = '00000000-0000-4000-8000-' + randomUUID().slice(-12)
  ids.emptyItem = 'ffffffff-ffff-4fff-8fff-' + randomUUID().slice(-12)
  const prefix = 'FE-CONTRACT-' + randomUUID().slice(0, 8)
  const password = randomUUID() + '!Fixture'
  let prisma: PrismaClient
  let cookies: Awaited<ReturnType<Awaited<ReturnType<typeof request.newContext>>['storageState']>>['cookies'] = []

  test.beforeAll(async () => {
    const env = backendTestEnvironment()
    const { PrismaClient } = requireBackend('@prisma/client') as typeof import('../.runtime/backend-client')
    prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } })
    const hash = await (requireBackend('bcrypt') as { hash: (value: string, rounds: number) => Promise<string> }).hash(password, 4)
    const { PermissionKeys } = requireBackend('./dist/common/consts/permission-keys.js') as { PermissionKeys: Record<string, string> }
    await prisma.permission.createMany({ data: Object.values(PermissionKeys).map(key => ({ key, name: key })), skipDuplicates: true })
    const permissions = await prisma.permission.findMany({ where: { deletedAt: null }, select: { id: true } })
    await prisma.$transaction([
      prisma.position.create({ data: { id: ids.position, name: prefix, salary: '0' } }),
      prisma.employee.create({ data: { id: ids.employee, email: prefix.toLowerCase() + '@example.test',
        username: prefix, fullName: prefix, password: hash, positionId: ids.position } }),
      prisma.employee.create({ data: { id: ids.restrictedEmployee, email: prefix.toLowerCase() + '-restricted@example.test',
        username: prefix + '-restricted', fullName: prefix + '-restricted', password: hash, positionId: ids.position } }),
      prisma.employee.create({ data: { id: ids.googleEmployee, email: prefix.toLowerCase() + '-google@example.test',
        username: prefix + '-google', fullName: prefix + '-google', password: hash, positionId: ids.position,
        googleSubject: 'fixture-subject-' + ids.googleEmployee } }),
      prisma.role.create({ data: { id: ids.role, name: prefix } }),
      prisma.employeeRole.create({ data: { employeeId: ids.employee, roleId: ids.role } }),
      prisma.rolePermission.createMany({ data: permissions.map((permission: { id: string }) => ({
        roleId: ids.role, permissionId: permission.id,
      })) }),
      prisma.menuCategory.create({ data: { id: ids.category, name: prefix } }),
      prisma.menuItem.create({ data: { id: ids.menu, name: prefix + '-coffee', price: '35000',
        categoryId: ids.category, isAvailable: true } }),
      prisma.menuItem.create({ data: { id: ids.candidate, name: prefix + '-cake', price: '12000',
        categoryId: ids.category, isAvailable: true, optionGroups: { create: {
          id: ids.optionGroup, name: 'Size', minSelected: 1, maxSelected: 1,
          options: { create: { id: ids.option, name: 'Large', priceDelta: '3000' } },
        } } } }),
      prisma.orderSession.create({ data: { id: ids.session, employeeId: ids.employee } }),
      prisma.invoice.create({ data: { id: ids.invoice, invoiceNumber: prefix, subTotal: '60000',
        totalAmount: '60000', orderSessionId: ids.session, employeeId: ids.employee } }),
      prisma.orderItem.create({ data: { id: ids.item, quantity: 2, priceAtTime: '30000',
        orderSessionId: ids.session, invoiceId: ids.invoice, menuItemId: ids.menu } }),
      prisma.unit.create({ data: { id: ids.unit, name: prefix } }),
      prisma.inventoryCategory.create({ data: { id: ids.inventoryCategory, name: prefix } }),
      prisma.inventoryItem.create({ data: { id: ids.inventoryItem, name: prefix, stock: '1.2345',
        averageUnitCost: '100', categoryId: ids.inventoryCategory, unitId: ids.unit } }),
      prisma.inventoryItem.create({ data: { id: ids.emptyItem, name: prefix + '-low-stock', stock: '0.1000',
        averageUnitCost: '100', categoryId: ids.inventoryCategory, unitId: ids.unit } }),
      prisma.inventoryItem.create({ data: { id: ids.procurementItem, name: prefix + '-procurement', stock: '10',
        averageUnitCost: '20000', categoryId: ids.inventoryCategory, unitId: ids.unit } }),
      prisma.fund.create({ data: { id: ids.cashFund, name: prefix + '-cash', type: 'CASH', balance: '0' } }),
      prisma.fund.create({ data: { id: ids.bankFund, name: prefix + '-bank', type: 'BANK', balance: '0' } }),
      prisma.supplier.create({ data: { id: ids.supplier, code: prefix, name: prefix } }),
      prisma.purchaseReceipt.create({ data: { id: ids.receipt, receiptNumber: prefix, totalAmount: '123.45',
        supplierId: ids.supplier, createdById: ids.employee, items: { create: {
          inventoryItemId: ids.inventoryItem, inventoryItemName: prefix, unitName: prefix,
          quantity: '1.2345', unitPrice: '100', totalAmount: '123.45',
        } } } }),
      prisma.stocktake.create({ data: { id: ids.stocktake, stocktakeNumber: prefix, createdById: ids.employee,
        items: { create: { inventoryItemId: ids.inventoryItem, inventoryItemName: prefix,
          unitName: prefix, expectedQuantity: '1.2345' } } } }),
    ])
    const api = await request.newContext({ baseURL: 'http://localhost:4174' })
    try {
      const login = await api.post('/api/v1/auth/sign-in', { data: { email: prefix.toLowerCase() + '@example.test', password } })
      expect(login.status()).toBe(201)
      cookies = (await api.storageState()).cookies
    } finally { await api.dispose() }
  })

  test.afterAll(async () => {
    await prisma?.$disconnect()
  })

  test.beforeEach(async ({ context }) => { await context.addCookies(cookies) })

  async function preparationFixture(stock = '10') {
    const name = prefix + '-recipe-' + randomUUID().slice(0, 6)
    const beanId = '00000000-0000-4000-8000-' + randomUUID().slice(-12)
    const milkId = 'ffffffff-ffff-4fff-8fff-' + randomUUID().slice(-12)
    await prisma.inventoryItem.createMany({ data: [
      { id: beanId, name: name + '-beans', stock, averageUnitCost: '20000', unitId: ids.unit, categoryId: ids.inventoryCategory },
      { id: milkId, name: name + '-milk', stock, averageUnitCost: '30000', unitId: ids.unit, categoryId: ids.inventoryCategory },
    ] })
    const station = await prisma.kitchenStation.create({ data: { name, code: name } })
    const menu = await prisma.menuItem.create({ data: { name, price: '25000', categoryId: ids.category, kitchenStationId: station.id,
      ingredients: { create: [{ inventoryItemId: beanId, quantity: '0.1234' }, { inventoryItemId: milkId, quantity: '0.2000' }] },
      optionGroups: { create: { name: 'Topping', minSelected: 1, maxSelected: 1, options: { create: { name: 'Extra shot', priceDelta: '1500.25',
        ingredients: { create: [{ inventoryItemId: beanId, quantity: '0.0001' }, { inventoryItemId: milkId, quantity: '0.0001' }] },
      } } } },
    } })
    return { name, beanId, milkId, stationId: station.id, menuId: menu.id }
  }

  test('real catalog pagination and station search drive creation without clearing unchanged routing', async ({ page }, info) => {
    const name = prefix + '-catalog-' + randomUUID().slice(0, 4)
    const categories = Array.from({ length: 101 }, (_, index) => ({ id: randomUUID(), name: `${name}-cat-${String(index).padStart(3, '0')}` }))
    const stations = Array.from({ length: 21 }, (_, index) => ({ id: randomUUID(), name: `${name}-station-${String(index).padStart(3, '0')}`, code: `C${name.slice(-4)}${index}` }))
    await prisma.menuCategory.createMany({ data: categories })
    await prisma.kitchenStation.createMany({ data: stations })
    await page.goto('/staff/menu')
    await page.getByRole('tab', { name: 'Danh mục', exact: true }).click()
    const panel = page.getByRole('tabpanel')
    await panel.getByLabel('Tìm danh mục', { exact: true }).fill(name + '-cat-')
    await expect(panel.getByRole('heading', { name: 'Danh mục theo bộ lọc (101)' })).toBeVisible()
    await panel.getByRole('button', { name: 'Trang sau' }).click()
    await expect(panel).toContainText(categories[15]!.name)
    await page.getByRole('button', { name: 'Tạo món mới', exact: true }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByLabel('Tên món', { exact: true }).fill(name)
    await dialog.getByLabel('Đơn giá (VNĐ)').fill('35000.25')
    const categoryPicker = dialog.getByRole('group', { name: 'Danh mục món', exact: true })
    const stationPicker = dialog.getByRole('group', { name: 'Quầy chế biến phụ trách', exact: true })
    await categoryPicker.getByLabel('Tìm danh mục món').fill(name + '-cat-')
    for (let index = 0; index < 2; index++) await categoryPicker.getByRole('button', { name: 'Trang sau' }).click()
    await categoryPicker.getByRole('combobox').selectOption(categories[100]!.id)
    await stationPicker.getByLabel('Tìm quầy chế biến phụ trách').fill(name + '-station-')
    await stationPicker.getByRole('button', { name: 'Trang sau' }).click()
    await stationPicker.getByRole('combobox').selectOption(stations[20]!.id)
    await dialog.getByRole('button', { name: 'Tạo món', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    const created = await prisma.menuItem.findFirstOrThrow({ where: { name } })
    expect(created.categoryId).toBe(categories[100]!.id)
    expect(created.kitchenStationId).toBe(stations[20]!.id)
    expect(created.price.toString()).toBe('35000.25')
    await page.getByRole('tab', { name: 'Danh sách món', exact: true }).click()
    await page.getByPlaceholder('Tìm kiếm theo tên món...').fill(name)
    const row = page.getByRole('row').filter({ hasText: name })
    await row.getByTitle('Sửa thông tin món').click()
    dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('combobox', { name: 'Danh mục món', exact: true })).toHaveValue(created.categoryId)
    await expect(dialog.getByRole('combobox', { name: 'Quầy chế biến phụ trách', exact: true })).toHaveValue(created.kitchenStationId!)
    await dialog.getByLabel('Đơn giá (VNĐ)').fill('37000.25')
    await page.screenshot({ path: info.outputPath('real-catalog-picker.png'), fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click()
    await expect(dialog).not.toBeVisible()
    const updated = await prisma.menuItem.findUniqueOrThrow({ where: { id: created.id } })
    expect(updated.price.toString()).toBe('37000.25')
    expect(updated.categoryId).toBe(created.categoryId)
    expect(updated.kitchenStationId).toBe(created.kitchenStationId)
    // Keep these lookup fixtures out of later KDS workflows in this isolated database.
    await prisma.menuItem.update({ where: { id: created.id }, data: { kitchenStationId: null } })
    await prisma.kitchenStation.updateMany({ where: { id: { in: stations.map(station => station.id) } }, data: { deletedAt: new Date() } })
  })

  test('real stock status returns the filtered count, later-page risks and untracked recipes', async ({ page }) => {
    const name = prefix + '-stock-view-' + randomUUID().slice(0, 4)
    const items = Array.from({ length: 16 }, (_, index) => ({ id: randomUUID(), name: `${name}-${String(index).padStart(2, '0')}`, price: '12000', categoryId: ids.category }))
    await prisma.menuItem.createMany({ data: items })
    await prisma.menuItemIngredient.create({ data: { menuItemId: items[15]!.id, inventoryItemId: ids.emptyItem, quantity: '100' } })
    await page.goto('/staff/menu')
    await page.getByRole('tab', { name: 'Nguyên liệu theo món' }).click()
    const panel = page.getByRole('tabpanel')
    await panel.getByLabel('Tìm món theo nguyên liệu').fill(name)
    await expect(panel.getByRole('heading', { name: 'Món theo bộ lọc (16)' })).toBeVisible()
    await expect(panel.getByText('Chưa có công thức', { exact: true })).toHaveCount(15)
    expect(await panel.getByRole('table').evaluate(table => table.getBoundingClientRect().width)).toBeGreaterThanOrEqual(720)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    await panel.getByRole('button', { name: 'Trang sau' }).click()
    const row = panel.getByRole('row').filter({ hasText: items[15]!.name })
    await expect(row).toContainText('Không đủ một suất')
    await row.getByRole('button', { name: 'Ngừng bán', exact: true }).click()
    await expect(row.getByRole('button', { name: 'Ngừng bán', exact: true })).toHaveCount(0)
    expect((await prisma.menuItem.findUniqueOrThrow({ where: { id: items[15]!.id } })).isAvailable).toBe(false)
    expect(await prisma.inventoryTransaction.count({ where: { inventoryItemId: ids.emptyItem } })).toBe(0)
  })

  async function preparationOrder(page: import('@playwright/test').Page, fixture: Awaited<ReturnType<typeof preparationFixture>>, quantity = 2) {
    const menu = await prisma.menuItem.findUniqueOrThrow({ where: { id: fixture.menuId }, include: { optionGroups: { include: { options: true } } } })
    await page.goto('/staff')
    await expect(page.getByRole('heading', { name: prefix, exact: true })).toBeVisible()
    const sessionId = await page.evaluate(async input => {
      const { openOrderSession, addOrderItems } = await import('/src/features/pos/pos.api.ts')
      const session = await openOrderSession(null)
      await addOrderItems(session.id, [{ menuItemId: input.menuId, quantity: input.quantity, optionIds: [input.optionId] }])
      return session.id
    }, { menuId: fixture.menuId, quantity, optionId: menu.optionGroups[0]!.options[0]!.id })
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderSessionId: sessionId } })
    return { sessionId, itemId: item.id }
  }

  test('recipe and topping UI feed immutable cooking consumption and cancellation waste', async ({ page }, info) => {
    const fixture = await preparationFixture()
    await page.goto('/staff/menu')
    await page.getByPlaceholder('Tìm kiếm theo tên món...').fill(fixture.name)
    const row = page.getByRole('row').filter({ hasText: fixture.name })
    await row.getByTitle('Công thức nguyên liệu').click()
    let dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel('Định lượng ' + fixture.name + '-beans', { exact: true })).toHaveValue('0.1234')
    await dialog.getByLabel('Định lượng ' + fixture.name + '-beans', { exact: true }).fill('0.2345')
    await dialog.getByRole('button', { name: 'Lưu công thức', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await row.getByTitle('Tùy chọn món (Size, Topping...)').click()
    dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Định lượng tùy chọn Extra shot' }).click()
    await expect(dialog.getByLabel('Định lượng ' + fixture.name + '-beans', { exact: true })).toHaveValue('0.0001')
    await dialog.getByLabel('Giá cộng thêm', { exact: true }).fill('2500.25')
    await dialog.getByRole('button', { name: 'Lưu tùy chọn', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    const order = await preparationOrder(page, fixture)
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: fixture.beanId } })).stock.toString()).toBe('10')
    expect(await prisma.inventoryTransaction.count({ where: { orderItemId: order.itemId } })).toBe(0)
    const recipes = await prisma.orderItemRecipeIngredient.findMany({ where: { orderItemId: order.itemId }, orderBy: { inventoryItemId: 'asc' } })
    expect(recipes.map(row => row.quantityPerItem.toString())).toEqual(['0.2346', '0.2001'])
    await page.evaluate(async input => {
      const { replaceItemRecipe, replaceItemOptions } = await import('/src/features/menu/menu.admin.api.ts')
      await replaceItemRecipe(input.menuId, [{ inventoryItemId: input.beanId, quantity: '1.0000' }])
      await replaceItemOptions(input.menuId, [{ name: 'Changed', minSelected: 0, maxSelected: 1, options: [{ name: 'Different topping', priceDelta: '0', ingredients: [] }] }])
    }, fixture)
    await page.goto('/staff/kitchen')
    await page.getByRole('button', { name: `${fixture.name} (${fixture.name})`, exact: true }).click()
    const ticket = page.getByRole('article').filter({ hasText: fixture.name })
    await ticket.getByRole('button', { name: 'Bắt đầu làm', exact: true }).click()
    await expect(ticket.getByRole('button', { name: 'Xong món', exact: true })).toBeVisible()
    const completedLabel = page.getByRole('checkbox', { name: 'Xem cả món đã xong' }).locator('..')
    await expect(completedLabel).toBeVisible()
    expect((await completedLabel.boundingBox())!.height).toBeLessThanOrEqual(32)
    await page.screenshot({ path: info.outputPath('real-preparation.png'), fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: fixture.beanId } })).stock.toString()).toBe('9.5308')
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: fixture.milkId } })).stock.toString()).toBe('9.5998')
    const snapshots = await prisma.orderItemIngredientSnapshot.findMany({ where: { orderItemId: order.itemId }, orderBy: { inventoryItemId: 'asc' } })
    expect(snapshots.map(row => [row.totalQuantity.toString(), row.unitCost.toString(), row.totalCost.toString()])).toEqual([['0.4692', '20000', '9384'], ['0.4002', '30000', '12006']])
    expect(await prisma.inventoryTransaction.count({ where: { orderItemId: order.itemId } })).toBe(2)
    await page.goto('/staff/pos/sessions/' + order.sessionId)
    page.once('dialog', dialog => dialog.accept('Prepared order changed'))
    await page.getByRole('button', { name: 'Hủy món', exact: true }).click()
    await expect(page.getByText('Đã hủy món thành công')).toBeVisible()
    expect(await prisma.inventoryWaste.count({ where: { orderItemId: order.itemId } })).toBe(2)
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: fixture.beanId } })).stock.toString()).toBe('9.5308')
    expect(await prisma.inventoryTransaction.count({ where: { orderItemId: order.itemId } })).toBe(2)
    await page.goto('/staff/inventory')
    await page.getByRole('button', { name: 'Hao hụt', exact: true }).click()
    await page.getByLabel('Mã món trong đơn').fill(order.itemId)
    await page.getByRole('button', { name: 'Lọc hao hụt', exact: true }).click()
    const waste = page.getByRole('region', { name: 'Hao hụt nguyên liệu' })
    await expect(waste).toContainText('0.4692')
    await expect(waste).toContainText('0.4002')
    await expect(waste).toContainText('Prepared order changed')
  })

  test('concurrent cooking cannot oversell or duplicate consumption and cancellation waste', async ({ page }) => {
    const fixture = await preparationFixture()
    await prisma.inventoryItem.update({ where: { id: fixture.beanId }, data: { stock: '0.1235' } })
    await prisma.inventoryItem.update({ where: { id: fixture.milkId }, data: { stock: '0.2001' } })
    const first = await preparationOrder(page, fixture, 1)
    const second = await preparationOrder(page, fixture, 1)
    const results = await page.evaluate(async input => {
      const { updateOrderItemStatus } = await import('/src/features/kitchen/kitchen.api.ts')
      return (await Promise.allSettled(input.map(id => updateOrderItemStatus(id, 'COOKING')))).map(result => result.status === 'fulfilled' ? { ok: true } : { ok: false, status: (result.reason as { status: number }).status, code: (result.reason as { code: string }).code })
    }, [first.itemId, second.itemId])
    expect(results.filter(result => result.ok)).toHaveLength(1)
    expect(results.filter(result => !result.ok)).toEqual([{ ok: false, status: 409, code: 'INVENTORY_INSUFFICIENT_STOCK' }])
    const items = await prisma.orderItem.findMany({ where: { id: { in: [first.itemId, second.itemId] } } })
    const winner = items.find(item => item.serveStatus === 'COOKING')!.id
    const loser = items.find(item => item.serveStatus === 'PENDING')!.id
    expect(await prisma.inventoryTransaction.count({ where: { orderItemId: { in: [winner, loser] } } })).toBe(2)
    expect(await prisma.orderItemIngredientSnapshot.count({ where: { orderItemId: loser } })).toBe(0)
    await page.evaluate(async id => {
      const { updateOrderItemStatus } = await import('/src/features/kitchen/kitchen.api.ts')
      await Promise.all([updateOrderItemStatus(id, 'COOKING'), updateOrderItemStatus(id, 'COOKING')])
    }, winner)
    expect(await prisma.inventoryTransaction.count({ where: { orderItemId: winner } })).toBe(2)
    await page.evaluate(async id => {
      const { cancelOrderItem } = await import('/src/features/pos/pos.api.ts')
      await Promise.allSettled([cancelOrderItem(id, 'Cancelled once'), cancelOrderItem(id, 'Cancelled once')])
    }, winner)
    expect(await prisma.inventoryWaste.count({ where: { orderItemId: winner } })).toBe(2)
    expect(await prisma.inventoryTransaction.count({ where: { orderItemId: winner } })).toBe(2)
    for (const id of [fixture.beanId, fixture.milkId]) expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id } })).stock.toString()).toBe('0')
    expect(await prisma.actionLog.count({ where: { actionType: 'ORDER_ITEM_CANCELLED', details: { path: ['orderItemId'], equals: winner } } })).toBe(1)
    expect(await prisma.outboxEvent.count({ where: { aggregateId: winner, eventName: 'inventory.stock.exported' } })).toBe(1)
  })

  test('insufficient cooking rolls back every ingredient and pending cancellation consumes nothing', async ({ page }) => {
    const fixture = await preparationFixture('1')
    await prisma.inventoryItem.update({ where: { id: fixture.milkId }, data: { stock: '0' } })
    const order = await preparationOrder(page, fixture, 1)
    const failed = await page.evaluate(async id => {
      const { updateOrderItemStatus } = await import('/src/features/kitchen/kitchen.api.ts')
      try { await updateOrderItemStatus(id, 'COOKING'); return null }
      catch (error) { return { status: (error as { status: number }).status, code: (error as { code: string }).code } }
    }, order.itemId)
    expect(failed).toEqual({ status: 409, code: 'INVENTORY_INSUFFICIENT_STOCK' })
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: fixture.beanId } })).stock.toString()).toBe('1')
    expect((await prisma.orderItem.findUniqueOrThrow({ where: { id: order.itemId } })).serveStatus).toBe('PENDING')
    expect(await prisma.inventoryTransaction.count({ where: { orderItemId: order.itemId } })).toBe(0)
    expect(await prisma.orderItemIngredientSnapshot.count({ where: { orderItemId: order.itemId } })).toBe(0)
    expect(await prisma.actionLog.count({ where: { actionType: 'ORDER_ITEM_STATUS_UPDATED', details: { path: ['orderItemId'], equals: order.itemId } } })).toBe(0)
    expect(await prisma.outboxEvent.count({ where: { aggregateId: order.itemId } })).toBe(0)
    await page.evaluate(async id => { const { cancelOrderItem } = await import('/src/features/pos/pos.api.ts'); await cancelOrderItem(id, 'Cancel before preparation') }, order.itemId)
    expect(await prisma.inventoryWaste.count({ where: { orderItemId: order.itemId } })).toBe(0)
    expect(await prisma.inventoryTransaction.count({ where: { orderItemId: order.itemId } })).toBe(0)
  })

  test('frontend adapters parse actual API responses and render a takeaway invoice', async ({ page, context }, info) => {
    await context.addCookies(cookies)
    await page.goto('/staff')
    await expect(page.getByRole('heading', { name: prefix, exact: true })).toBeVisible()
    const checks = await page.evaluate(async (fixture) => {
      const failures: string[] = []
      let passed = 0
      const check = async (module: string, name: string, args: unknown[] = []) => {
        try {
          const api = await import('/src/features/' + module + '.ts')
          const parts = name.split('.')
          const owner = parts.length === 2 ? api[parts[0]!] : api
          await owner[parts.at(-1)!](...args)
          passed++
        } catch (error) { failures.push(name + ': ' + String(error)) }
      }
      await check('menu/menu.api', 'getCategories')
      await check('menu/menu.api', 'getMenu', [{ keyword: '', categoryId: '', page: 1 }])
      await check('menu/menu.admin.api', 'getAdminCategories', [{}])
      await check('menu/menu.admin.api', 'getAdminItems', [{}])
      await check('pos/pos.api', 'getDiningTables')
      await check('pos/pos.api', 'getActiveSessions')
      await check('pos/pos.api', 'getSessionDetail', [fixture.session])
      await check('invoices/invoices.api', 'getInvoices')
      await check('invoices/invoices.api', 'getInvoiceById', [fixture.invoice])
      await check('invoices/invoices.api', 'getInvoicePaymentAttempts', [fixture.invoice])
      await check('invoices/invoices.api', 'getPaymentProviders')
      await check('inventory/inventory.api', 'getInventoryItems')
      await check('inventory/inventory.api', 'getInventoryCategories')
      await check('inventory/inventory.api', 'getInventoryUnits')
      await check('inventory/inventory.api', 'getInventoryTransactions')
      await check('inventory/procurement.api', 'getSuppliers', [1, ''])
      await check('inventory/procurement.api', 'getReceipts', [1])
      await check('inventory/procurement.api', 'getReceipt', [fixture.receipt])
      await check('inventory/procurement.api', 'getStocktakes', [1])
      await check('inventory/procurement.api', 'getStocktake', [fixture.stocktake])
      await check('kitchen/kitchen.api', 'getKitchenStations')
      await check('kitchen/kitchen.api', 'getKitchenWorkload')
      await check('promotions/promotions.api', 'getPromotions')
      await check('employees/employees.api', 'getEmployees', [{}])
      await check('employees/employees.api', 'getRoles', [{}])
      await check('employees/employees.api', 'getPermissions', [{}])
      await check('online-orders/online-orders.api', 'getPendingOnlineOrders')
      await check('online-orders/online-orders.api', 'getFulfillmentOnlineOrders')
      await check('employees/employees.api', 'getPositions', [{}])
      await check('employees/employees.api', 'getRolePermissions', [fixture.role])
      await check('employees/employees.api', 'getEmployeeRoles', [fixture.employee])
      await check('cashier-shifts/cashier-shifts.api', 'getCurrentShift')
      await check('cashier-shifts/cashier-shifts.api', 'getCashierShifts')
      await check('cashier-shifts/cashier-shifts.api', 'getFunds')
      await check('cashier-shifts/cashier-shifts.api', 'getAllCashHandovers')
      await check('cashier-shifts/cashier-shifts.api', 'getExpenseRequests')
      await check('reports/reports.api', 'getDashboardReport')
      await check('reports/reports.api', 'getKitchenSlaReport')
      await check('reports/reports.api', 'getKitchenBottlenecks')
      await check('printing/printing.api', 'printingApi.getDevices')
      await check('printing/printing.api', 'printingApi.getJobs')
      await check('settings/settings.api', 'settingsApi.getEquipment')
      await check('settings/settings.api', 'settingsApi.getSystemSettings')
      await check('settings/settings.api', 'settingsApi.getManagementExceptionsSummary')
      await check('settings/settings.api', 'settingsApi.getManagementExceptions', [{ kind: 'PAYMENT' }])
      await check('audit-logs/audit-logs.api', 'auditLogsApi.getAuditLogs')
      await check('reservations/reservations.api', 'getReservations', [{}])
      return { passed, failures }
    }, ids)
    expect(checks.failures).toEqual([])
    expect(checks.passed).toBe(47)
    await page.goto('/staff/invoices')
    await page.getByRole('code').filter({ hasText: prefix }).click()
    await expect(page.getByRole('dialog').getByText(prefix + '-coffee', { exact: true })).toBeVisible()
    await expect(page.getByRole('dialog').getByText('Mang đi', { exact: true })).toBeVisible()
    await page.screenshot({ path: info.outputPath('live-takeaway-invoice.png') })
  })

  test('staff paging filters all employees and printers through the actual UI and API', async ({ page }, info) => {
    const marker = prefix + '-paged'
    const actor = await prisma.employee.findUniqueOrThrow({ where: { id: ids.employee }, select: { password: true } })
    await prisma.employee.createMany({ data: Array.from({ length: 25 }, (_, index) => ({
      fullName: marker + '-' + index, email: marker.toLowerCase() + '-' + index + '@example.test',
      username: marker + '-' + index, password: actor.password, positionId: ids.position, isActive: false,
    })) })
    await prisma.printDevice.createMany({ data: Array.from({ length: 3 }, (_, index) => ({
      name: marker + '-printer-' + index, type: 'RECEIPT' as const, paperSize: '80mm',
      apiKeyHash: createHash('sha256').update(randomUUID()).digest('hex'), isActive: false,
    })) })
    await page.goto('/staff/employees')
    await page.getByPlaceholder('Tìm theo tên nhân viên, username hoặc email...').fill(marker)
    await page.getByLabel('Lọc theo trạng thái').selectOption('INACTIVE')
    await page.getByLabel('Lọc theo vị trí').selectOption(ids.position)
    await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(20)
    const first = await page.getByRole('table').locator('tbody tr td:first-child').allTextContents()
    await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
    await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(5)
    const second = await page.getByRole('table').locator('tbody tr td:first-child').allTextContents()
    expect(second.every(name => !first.includes(name))).toBe(true)
    await page.screenshot({ path: info.outputPath('real-staff-paging.png') })
    const result = await page.evaluate(async ({ marker, positionId }) => {
      const employeesPath = '/src/features/employees/employees.api.ts'
      const printersPath = '/src/features/printing/printing.api.ts'
      const { getEmployees } = await import(employeesPath)
      const { printingApi } = await import(printersPath)
      const active = await getEmployees({ search: marker, isActive: true, positionId })
      const printers = await printingApi.getDevices({ keyword: marker, isActive: false, page: 2, itemPerPage: 2 })
      return { activeCount: active.totalItems, printers }
    }, { marker, positionId: ids.position })
    expect(result.activeCount).toBe(0)
    expect(result.printers).toMatchObject({ totalItems: 3, totalPages: 2, currentPage: 2 })
    expect(result.printers.list).toHaveLength(1)
    expect(result.printers.list[0]?.name).toContain(marker)
    expect(result.printers.list[0]).not.toHaveProperty('apiKeyHash')
  })
  test('cash checkout, repeated handoff and feedback keep one ledger entry per operation', async ({ page }, info) => {
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
      const input = { orderSessionId: session.id, paymentMethod: 'CASH' as const,
        amountTendered: '50000', idempotencyKey: crypto.randomUUID(), closeSessionAfterPayment: true }
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
    expect(await prisma.actionLog.count({ where: { employeeId: ids.employee, actionType: 'ORDER_ITEM_STATUS_UPDATED',
      details: { path: ['orderItemId'], equals: result.itemId } } })).toBe(3)
    expect(await prisma.takeawayFeedback.count({ where: { invoiceId: result.replay.id } })).toBe(1)
    const audit = await prisma.actionLog.findFirstOrThrow({ where: { employeeId: ids.employee } })
    await expect(prisma.actionLog.update({ where: { id: audit.id }, data: { details: { changed: true } } })).rejects.toThrow()
    expect((await prisma.actionLog.findUniqueOrThrow({ where: { id: audit.id } })).details).toEqual(audit.details)
    await page.goto('/pickup#' + new URLSearchParams({ invoiceId: result.credential.invoiceId, code: result.credential.code }))
    await expect(page.getByRole('heading', { name: 'Đã nhận món', exact: true })).toBeVisible()
    await page.screenshot({ path: info.outputPath('real-collected-pickup.png') })
  })

  test('real quoted partial promotion checkout leaves remaining lines unbilled', async ({ page }, info) => {
    const promotion = await prisma.promotion.create({ data: {
      name: prefix + '-partial', discountType: 'PERCENTAGE', discountValue: '10',
      startDate: new Date(Date.now() - 60000), endDate: new Date(Date.now() + 3600000),
    } })
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

  test('concurrent stock export cannot oversell and failed bulk export rolls back every row', async ({ page }) => {
    await page.goto('/staff')
    await expect(page.getByRole('heading', { name: prefix, exact: true })).toBeVisible()
    const results = await page.evaluate(async fixture => {
      const { bulkMoveStock } = await import('/src/features/inventory/operations.api.ts')
      const results = await Promise.allSettled(['race-one', 'race-two'].map(note => bulkMoveStock({ type: 'EXPORT',
        items: [{ inventoryItemId: fixture.inventoryItem, quantity: '1.0001', note }] })))
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
        await bulkMoveStock({ type: 'EXPORT', items: [
          { inventoryItemId: fixture.inventoryItem, quantity: '0.2000', note: 'rollback-first' },
          { inventoryItemId: fixture.emptyItem, quantity: '0.2000', note: 'rollback-second' },
        ] })
        return 0
      } catch (error) { return (error as { status: number }).status }
    }, ids)
    expect(failed).toBe(409)
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: ids.inventoryItem } })).stock.toString()).toBe('0.2344')
    expect(await prisma.inventoryTransaction.count({ where: { inventoryItemId: { in: [ids.inventoryItem!, ids.emptyItem!] } } })).toBe(1)
    expect(await prisma.actionLog.count({ where: { employeeId: ids.employee, actionType: 'INVENTORY_EXPORT' } })).toBe(beforeAudit)
    expect(await prisma.outboxEvent.count({ where: { topic: 'inventory' } })).toBe(beforeOutbox)
  })

  test('receipt draft and posting update the real inventory and weighted-average cost through the UI', async ({ page }, info) => {
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
    expect(await prisma.actionLog.count({ where: { employeeId: ids.employee, actionType: 'INVENTORY_PURCHASE_RECEIPT_POSTED',
      details: { path: ['purchaseReceiptId'], equals: draft.id } } })).toBe(1)
    await row.getByRole('button', { name: 'Chi tiết', exact: true }).click()
    const detail = page.getByRole('dialog', { name: draft.receiptNumber })
    await expect(detail.getByLabel('Số lượng', { exact: true })).toBeDisabled()
    await expect(detail.getByRole('button', { name: 'Lưu phiếu nháp', exact: true })).toHaveCount(0)
    await detail.getByRole('button', { name: 'Đóng', exact: true }).click()
    await page.getByRole('button', { name: 'Kho hàng & Tồn kho' }).click()
    await page.getByPlaceholder('Tìm tên nguyên liệu…').fill(prefix + '-procurement')
    const inventoryRow = page.getByRole('row').filter({ hasText: prefix + '-procurement' })
    await expect(inventoryRow.getByRole('cell').nth(3)).toContainText('15')
    const costCell = inventoryRow.getByRole('cell').nth(5)
    await expect(costCell).toContainText('21.000')
    await costCell.scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath('procurement-stock-cost.png'), fullPage: true })
  })

  test('concurrent receipt create and post replay once and posted documents reject mutations', async ({ page }) => {
    const item = await prisma.inventoryItem.create({ data: { name: prefix + '-receipt-race', stock: '1.2345',
      averageUnitCost: '100.25', categoryId: ids.inventoryCategory, unitId: ids.unit } })
    await page.goto('/staff')
    await expect(page.getByRole('heading', { name: prefix, exact: true })).toBeVisible()
    const result = await page.evaluate(async input => {
      const api = await import('/src/features/inventory/procurement.api.ts')
      const payload = { supplierId: input.supplierId, note: input.note,
        items: [{ inventoryItemId: input.itemId, quantity: '0.0005', unitPrice: '200.75' }] }
      const receipts = await Promise.all([api.saveReceipt(payload), api.saveReceipt(payload)])
      const receipt = receipts[0]!
      const posts = await Promise.all([api.postDocument('purchase-receipts', receipt.id), api.postDocument('purchase-receipts', receipt.id)])
      const rejected = async (operation: () => Promise<unknown>) => {
        try { await operation(); return 0 } catch (error) { return (error as { status: number }).status }
      }
      return { ids: receipts.map(row => row.id), posts: posts.map(row => row.status),
        newPost: await rejected(() => api.postDocument('purchase-receipts', receipt.id)),
        update: await rejected(() => api.saveReceipt({ ...payload, note: 'Changed' }, receipt.id)),
        cancel: await rejected(() => api.cancelDocument('purchase-receipts', receipt.id, 'Cannot cancel posted receipt')) }
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
    const creation = await prisma.idempotencyRequest.findFirstOrThrow({ where: { employeeId: ids.employee,
      operation: 'inventory.purchase-receipt.create', response: { path: ['id'], equals: result.ids[0] } } })
    const changedIntent = await page.evaluate(async input => {
      const { apiMutate } = await import('/src/shared/api/client.ts')
      const { receiptDetailSchema } = await import('/src/features/inventory/procurement.api.ts')
      try { await apiMutate('/inventory/purchase-receipts', 'POST', receiptDetailSchema,
        { supplierId: input.supplierId, note: 'Different intent', idempotencyKey: input.key,
          items: [{ inventoryItemId: input.itemId, quantity: '0.0005', unitPrice: '200.75' }] }); return 0 }
      catch (error) { return (error as { status: number }).status }
    }, { supplierId: ids.supplier, itemId: item.id, key: creation.key })
    expect(changedIntent).toBe(409)
  })

  test('failed multi-line receipt posting rolls back stock, ledger, audit, outbox and its key', async ({ page }) => {
    const firstId = '00000000-0000-4000-8000-' + randomUUID().slice(-12)
    const lastId = 'ffffffff-ffff-4fff-8fff-' + randomUUID().slice(-12)
    await prisma.inventoryItem.createMany({ data: [firstId, lastId].map((id, index) => ({ id,
      name: prefix + '-receipt-rollback-' + index, stock: '2', averageUnitCost: '10',
      categoryId: ids.inventoryCategory, unitId: ids.unit })) })
    await page.goto('/staff')
    await expect(page.getByRole('heading', { name: prefix, exact: true })).toBeVisible()
    const receipt = await page.evaluate(async input => {
      const api = await import('/src/features/inventory/procurement.api.ts')
      return api.saveReceipt({ supplierId: input.supplierId, items: input.itemIds.map(inventoryItemId => ({ inventoryItemId, quantity: '1', unitPrice: '20' })) })
    }, { supplierId: ids.supplier, itemIds: [firstId, lastId] })
    await prisma.inventoryItem.update({ where: { id: lastId }, data: { deletedAt: new Date() } })
    const post = () => page.evaluate(async id => {
      const { postDocument } = await import('/src/features/inventory/procurement.api.ts')
      try { await postDocument('purchase-receipts', id); return 0 } catch (error) { return (error as { status: number }).status }
    }, receipt.id)
    expect(await post()).toBe(409)
    expect((await prisma.purchaseReceipt.findUniqueOrThrow({ where: { id: receipt.id } })).status).toBe('DRAFT')
    const stock = await prisma.inventoryItem.findMany({ where: { id: { in: [firstId, lastId] } } })
    expect(stock.map(row => [row.stock.toString(), row.averageUnitCost.toString()])).toEqual([['2', '10'], ['2', '10']])
    expect(await prisma.inventoryTransaction.count({ where: { purchaseReceiptItem: { purchaseReceiptId: receipt.id } } })).toBe(0)
    expect(await prisma.outboxEvent.count({ where: { aggregateId: receipt.id } })).toBe(0)
    expect(await prisma.actionLog.count({ where: { employeeId: ids.employee, actionType: 'INVENTORY_PURCHASE_RECEIPT_POSTED',
      details: { path: ['purchaseReceiptId'], equals: receipt.id } } })).toBe(0)
    expect(await prisma.idempotencyRequest.count({ where: { employeeId: ids.employee, operation: 'inventory.purchase-receipt.post',
      requestHash: createHash('sha256').update(JSON.stringify({ id: receipt.id })).digest('hex') } })).toBe(0)
    await prisma.inventoryItem.update({ where: { id: lastId }, data: { deletedAt: null } })
    expect(await post()).toBe(0)
    expect(await prisma.inventoryTransaction.count({ where: { purchaseReceiptItem: { purchaseReceiptId: receipt.id } } })).toBe(2)
    expect(await prisma.outboxEvent.count({ where: { aggregateId: receipt.id } })).toBe(1)
  })

  test('stocktake UI posts positive negative and zero variances with exact cost snapshots', async ({ page }, info) => {
    const values = [['5.1234', '10', '5.6235'], ['8.3333', '20.25', '7.1111'], ['0.0001', '100', '0.0001']] as const
    const items: { id: string; name: string; counted: string; averageUnitCost: string }[] = []
    for (const [index, [stock, averageUnitCost, counted]] of values.entries()) {
      const item = await prisma.inventoryItem.create({ data: { name: prefix + '-stocktake-ui-' + index,
        stock, averageUnitCost, categoryId: ids.inventoryCategory, unitId: ids.unit } })
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
    expect(await prisma.actionLog.count({ where: { employeeId: ids.employee, actionType: 'INVENTORY_STOCKTAKE_POSTED',
      details: { path: ['stocktakeId'], equals: draft.id } } })).toBe(1)
    await row.getByRole('button', { name: 'Chi tiết', exact: true }).click()
    await expect(detail.getByRole('table')).toContainText('-1,2222')
    await expect(detail.getByRole('spinbutton')).toHaveCount(0)
  })

  test('stocktake create replays and different posting keys cannot write the ledger twice', async ({ page }) => {
    const item = await prisma.inventoryItem.create({ data: { name: prefix + '-stocktake-race', stock: '10',
      averageUnitCost: '20', categoryId: ids.inventoryCategory, unitId: ids.unit } })
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
      return { id, createdIds: created.map(row => row.id), uncounted, statuses: posts.map(row => row.status).sort(), replay: replay.status,
        update: await rejected(() => api.saveCounts(id, [{ inventoryItemId: input.itemId, countedQuantity: '0' }])),
        cancel: await rejected(() => api.cancelDocument('stocktakes', id, 'Posted document must stay immutable')) }
    }, { itemId: item.id, note: prefix + '-stocktake-race' })
    expect(result.createdIds).toEqual([result.id, result.id])
    expect(result.uncounted).toBe(409)
    expect(result.statuses).toEqual([0, 409])
    expect(result.replay).toBe('POSTED')
    expect([result.update, result.cancel]).toEqual([409, 409])
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).stock.toString()).toBe('9.9999')
    expect(await prisma.inventoryTransaction.count({ where: { stocktakeItem: { stocktakeId: result.id } } })).toBe(1)
    expect(await prisma.outboxEvent.count({ where: { aggregateId: result.id } })).toBe(1)
    expect(await prisma.actionLog.count({ where: { employeeId: ids.employee, actionType: 'INVENTORY_STOCKTAKE_POSTED',
      details: { path: ['stocktakeId'], equals: result.id } } })).toBe(1)
  })

  test('posting rejects counts edited after review and accepts an explicitly refreshed review', async ({ page }) => {
    const item = await prisma.inventoryItem.create({ data: { name: prefix + '-stocktake-review', stock: '2',
      averageUnitCost: '10', categoryId: ids.inventoryCategory, unitId: ids.unit } })
    await page.goto('/staff')
    await expect(page.getByRole('heading', { name: prefix, exact: true })).toBeVisible()
    const result = await page.evaluate(async itemId => {
      const api = await import('/src/features/inventory/procurement.api.ts')
      const draft = await api.createStocktake([itemId])
      await api.saveCounts(draft.id, [{ inventoryItemId: itemId, countedQuantity: '1.2345' }])
      const review = await api.getStocktake(draft.id)
      await api.saveCounts(draft.id, [{ inventoryItemId: itemId, countedQuantity: '1.1111' }])
      try { await api.postDocument('stocktakes', draft.id, review.items.map(line => ({
        inventoryItemId: line.inventoryItemId, countedQuantity: line.countedQuantity!,
      }))); return { id: draft.id, status: 0, code: '' } }
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
      await api.postDocument('stocktakes', id, refreshed.items.map(line => ({ inventoryItemId: line.inventoryItemId, countedQuantity: line.countedQuantity! })))
    }, result.id)
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).stock.toString()).toBe('1.1111')
    expect(await prisma.inventoryTransaction.count({ where: { stocktakeItem: { stocktakeId: result.id } } })).toBe(1)
  })

  test('stale stocktake rolls back every line and requires cancellation plus a new snapshot', async ({ page }) => {
    const itemIds = ['00000000-0000-4000-8000-' + randomUUID().slice(-12), 'ffffffff-ffff-4fff-8fff-' + randomUUID().slice(-12)]
    await prisma.inventoryItem.createMany({ data: itemIds.map((id, index) => ({ id, name: prefix + '-stocktake-stale-' + index,
      stock: '2', averageUnitCost: '10', categoryId: ids.inventoryCategory, unitId: ids.unit })) })
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
      try { await postDocument('stocktakes', id); return { status: 0, message: '' } }
      catch (error) { const failure = error as { status: number; serverMessage: string }; return { status: failure.status, message: failure.serverMessage } }
    }, draft.id)
    expect(await attempt()).toMatchObject({ status: 409, message: expect.stringContaining('Cancel this draft and create a new stocktake') })
    await page.evaluate(async input => {
      const { saveCounts } = await import('/src/features/inventory/procurement.api.ts')
      await saveCounts(input.id, input.itemIds.map(inventoryItemId => ({ inventoryItemId, countedQuantity: '3' })))
    }, { id: draft.id, itemIds })
    expect((await attempt()).status).toBe(409)
    const persisted = await prisma.stocktake.findUniqueOrThrow({ where: { id: draft.id }, include: { items: true } })
    expect(persisted.status).toBe('DRAFT')
    expect(persisted.items.every(line => line.expectedQuantity.toString() === '2' && line.differenceQuantity === null)).toBe(true)
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemIds[0] } })).stock.toString()).toBe('2')
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemIds[1] } })).stock.toString()).toBe('3')
    expect(await prisma.inventoryTransaction.count({ where: { stocktakeItem: { stocktakeId: draft.id } } })).toBe(0)
    expect(await prisma.outboxEvent.count({ where: { aggregateId: draft.id } })).toBe(0)
    expect(await prisma.actionLog.count({ where: { actionType: 'INVENTORY_STOCKTAKE_POSTED',
      details: { path: ['stocktakeId'], equals: draft.id } } })).toBe(0)
    expect(await prisma.idempotencyRequest.count({ where: { employeeId: ids.employee, operation: 'inventory.stocktake.post',
      requestHash: createHash('sha256').update(JSON.stringify({ id: draft.id })).digest('hex') } })).toBe(0)
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

  test('duplicate bank imports are rejected and the real statement renders without balance mutation', async ({ page }, info) => {
    await page.goto('/staff')
    await expect(page.getByRole('heading', { name: prefix, exact: true })).toBeVisible()
    const results = await page.evaluate(async fixture => {
      const { importBankStatement } = await import('/src/features/reconciliation/reconciliation.api.ts')
      const input = { fundId: fixture.bankFund, sourceFileName: fixture.bankFund + '.json',
        statementFrom: new Date(Date.now() - 60_000).toISOString(), statementTo: new Date(Date.now() + 60_000).toISOString(),
        entries: [{ externalId: fixture.bankFund, direction: 'CREDIT' as const, amount: '125000.50',
          transactionDate: new Date().toISOString(), bankReference: 'TEST-' + fixture.bankFund }] }
      const results = await Promise.allSettled([importBankStatement(input), importBankStatement(input)])
      return results.map(result => result.status === 'fulfilled'
        ? { status: 'fulfilled', importId: result.value.statementImport.id }
        : { status: 'rejected', httpStatus: (result.reason as { status: number }).status })
    }, ids)
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toEqual([{ status: 'rejected', httpStatus: 409 }])
    expect(await prisma.bankStatementImport.count({ where: { fundId: ids.bankFund } })).toBe(1)
    expect(await prisma.bankStatementEntry.count({ where: { fundId: ids.bankFund } })).toBe(1)
    expect((await prisma.fund.findUniqueOrThrow({ where: { id: ids.bankFund } })).balance.toString()).toBe('0')
    expect(await prisma.actionLog.count({ where: { employeeId: ids.employee, actionType: 'BANK_STATEMENT_IMPORTED' } })).toBe(1)
    await page.goto('/staff/reconciliation?tab=bank')
    await expect(page.locator('a[aria-current="page"]:visible').first()).toHaveCSS('color', 'rgb(255, 255, 255)')
    await page.getByRole('button', { name: new RegExp(ids.bankFund!) }).click()
    await expect(page.getByRole('heading', { name: 'Giao dịch sao kê', exact: true })).toBeVisible()
    await expect(page.getByText('CREDIT · UNMATCHED', { exact: false })).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await page.screenshot({ path: info.outputPath('real-bank-statement.png') })
  })

  test('two POS requests with different keys cannot pay the same session twice', async ({ page }) => {
    const before = await prisma.fund.findUniqueOrThrow({ where: { id: ids.cashFund } })
    await page.goto('/staff')
    await expect(page.getByRole('heading', { name: prefix, exact: true })).toBeVisible()
    const result = await page.evaluate(async fixture => {
      const pos = await import('/src/features/pos/pos.api.ts')
      const session = await pos.openOrderSession(null)
      await pos.addOrderItems(session.id, [{ menuItemId: fixture.menu, quantity: 1 }])
      const attempts = await Promise.allSettled([crypto.randomUUID(), crypto.randomUUID()].map(idempotencyKey =>
        pos.checkoutInvoice({ orderSessionId: session.id, amountTendered: '50000', idempotencyKey })))
      return { sessionId: session.id, attempts: attempts.map(attempt => attempt.status === 'fulfilled'
        ? { status: 'fulfilled', invoiceId: attempt.value.id }
        : { status: 'rejected', httpStatus: (attempt.reason as { status: number }).status }) }
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

  test('online cohorts reach cash collection with one exposure and server-authoritative conversion', async ({ page, context }, info) => {
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
        }, payload as unknown as import('../src/features/online-orders/online-orders.api').CreateOnlineOrderPayload)
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

  test('signed VNPay IPN settles once and return cannot confirm payment', async ({ page, context }, info) => {
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
    await page.getByRole('button', { name: 'Cổng thanh toán (VNPay / MoMo)', exact: true }).click()
    const creation = page.waitForResponse(res => res.request().method() === 'POST' && new URL(res.url()).pathname === `/api/v1/invoices/${invoice.id}/payment-attempts`)
    await page.getByRole('button', { name: 'Tạo phiên VNPAY', exact: true }).click()
    const created = await creation
    expect(created.status()).toBe(201)
    const { data: attempt } = await created.json() as { data: { id: string; merchantReference: string } }
    await expect(page.getByRole('link', { name: 'Mở thanh toán VNPAY' })).toBeVisible()
    await page.screenshot({ path: info.outputPath('real-payment-gateway.png') })
    const env = backendTestEnvironment()
    const sign = (params: Record<string, string>) => {
      const query = new URLSearchParams(params)
      query.sort()
      query.set('vnp_SecureHash', createHmac('sha512', env.VNPAY_HASH_SECRET).update(query.toString()).digest('hex'))
      return query.toString()
    }
    const fields = { vnp_TmnCode: env.VNPAY_TMN_CODE, vnp_TxnRef: attempt.merchantReference,
      vnp_Amount: '3500000', vnp_ResponseCode: '00', vnp_TransactionStatus: '00',
      vnp_TransactionNo: attempt.id.replaceAll('-', ''), vnp_PayDate: '20261004150000' }
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
    await page.getByRole('button', { name: 'Kiểm tra lại', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText('Server đã ghi nhận thanh toán thành công.')
    expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status).toBe('SUCCEEDED')
    expect(await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).toMatchObject({ paymentStatus: 'PAID', paymentMethod: 'TRANSFER' })
    expect(await prisma.outboxEvent.count({ where: { eventName: 'order.invoice.paid', aggregateId: invoice.id } })).toBe(1)
    expect(await prisma.cashTransaction.count({ where: { invoiceId: invoice.id } })).toBe(0)
    expect(await prisma.paymentWebhookEvent.count({ where: { paymentAttemptId: attempt.id } })).toBe(2)
  })

  test('signed MoMo IPN is idempotent and cannot be substituted by VNPay', async ({ page, context }) => {
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
    const attempt = await prisma.paymentAttempt.create({ data: {
      provider: 'MOMO', invoiceId: invoice.id, createdById: ids.employee, shiftId: shift.id,
      amount: '35000', merchantReference: reference, idempotencyKey: randomUUID(), requestHash: 'fixture',
      expiresAt: new Date(Date.now() + 15 * 60_000),
    } })
    const env = backendTestEnvironment()
    const substituted = new URLSearchParams({ vnp_TmnCode: env.VNPAY_TMN_CODE, vnp_TxnRef: reference,
      vnp_Amount: '3500000', vnp_ResponseCode: '00', vnp_TransactionStatus: '00', vnp_TransactionNo: '123456' })
    substituted.sort()
    substituted.set('vnp_SecureHash', createHmac('sha512', env.VNPAY_HASH_SECRET).update(substituted.toString()).digest('hex'))
    const rejected = await context.request.get('/api/v1/payments/vnpay/ipn?' + substituted.toString())
    expect(await rejected.json()).toMatchObject({ RspCode: '01' })
    const wrongReturn = await context.request.get('/api/v1/payments/vnpay/return?' + substituted.toString())
    expect(await wrongReturn.json()).toMatchObject({ data: { signatureValid: true, attempt: null } })
    expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status).toBe('PENDING')
    const fields = { amount: 35000, extraData: '', message: 'Successful', orderId: reference,
      orderInfo: `Thanh toan hoa don ${invoice.invoiceNumber}`.slice(0, 255), orderType: 'momo_wallet',
      partnerCode: env.MOMO_PARTNER_CODE, payType: 'qr', requestId: reference,
      responseTime: Date.now(), resultCode: 0,
      transId: Number.parseInt(randomUUID().replaceAll('-', '').slice(0, 12), 16) }
    const sign = (body: typeof fields) => ({ ...body, signature: createHmac('sha256', env.MOMO_SECRET_KEY)
      .update(Object.entries({ accessKey: env.MOMO_ACCESS_KEY, ...body }).sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}=${value}`).join('&')).digest('hex') })
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
    await page.getByRole('button', { name: 'Kiểm tra lại', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText('Server đã ghi nhận thanh toán thành công.')
    expect((await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status).toBe('SUCCEEDED')
    expect(await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).toMatchObject({ paymentStatus: 'PAID', paymentMethod: 'TRANSFER' })
    expect(await prisma.outboxEvent.count({ where: { eventName: 'order.invoice.paid', aggregateId: invoice.id } })).toBe(1)
    expect(await prisma.cashTransaction.count({ where: { invoiceId: invoice.id } })).toBe(0)
    expect(await prisma.paymentWebhookEvent.count({ where: { paymentAttemptId: attempt.id, provider: 'MOMO' } })).toBe(2)
  })

  test('provider amount mismatch blocks manual collection and void without a second ledger', async ({ page, context }) => {
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
    const query = new URLSearchParams({ vnp_TmnCode: env.VNPAY_TMN_CODE, vnp_TxnRef: attempt.merchantReference,
      vnp_Amount: '3500100', vnp_ResponseCode: '00', vnp_TransactionStatus: '00', vnp_TransactionNo: attempt.id.replaceAll('-', '') })
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
        () => voidInvoice(id),
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

  test('cookie mutations require CSRF and employees without roles cannot access staff data', async ({ page }) => {
    await page.goto('/staff')
    const noCsrf = await page.request.post('/api/v1/orders/sessions', { data: { tableId: null } })
    expect(noCsrf.status()).toBe(403)
    const restricted = await request.newContext({ baseURL: 'http://localhost:4174' })
    try {
      expect((await restricted.post('/api/v1/auth/sign-in', { data: {
        email: prefix.toLowerCase() + '-restricted@example.test', password,
      } })).status()).toBe(201)
      expect((await restricted.get('/api/v1/invoices')).status()).toBe(403)
      await prisma.employee.update({ where: { id: ids.restrictedEmployee }, data: { isActive: false } })
      expect((await restricted.get('/api/v1/auth/me')).status()).toBe(401)
    } finally { await restricted.dispose() }
  })

  test('real Google unlink requires password/CSRF and concurrent calls revoke every session once @api-only', async () => {
    const first = await request.newContext({ baseURL: 'http://localhost:4174' })
    const second = await request.newContext({ baseURL: 'http://localhost:4174' })
    const email = prefix.toLowerCase() + '-google@example.test'
    try {
      for (const api of [first, second]) {
        expect((await api.post('/api/v1/auth/sign-in', { data: { email, password } })).status()).toBe(201)
      }
      const profile = await first.get('/api/v1/auth/me')
      expect(await profile.json()).toMatchObject({ data: { googleLinked: true } })
      expect((await profile.json()).data).not.toHaveProperty('googleSubject')
      expect((await first.post('/api/v1/auth/google/unlink', { data: { password } })).status()).toBe(403)
      const csrf = async (api: typeof first) => {
        const cookie = (await api.storageState()).cookies.find(value => value.name === 'csrfToken')
        if (!cookie) throw new Error('Missing real CSRF cookie')
        return { 'X-CSRF-Token': cookie.value }
      }
      expect((await first.post('/api/v1/auth/google/unlink', { headers: await csrf(first), data: { password: 'incorrect' } })).status()).toBe(401)
      expect(await prisma.authSession.count({ where: { employeeId: ids.googleEmployee, revokedAt: null } })).toBe(2)
      const headers = await Promise.all([csrf(first), csrf(second)])
      const results = await Promise.all([first, second].map((api, index) => api.post('/api/v1/auth/google/unlink', {
        headers: headers[index]!, data: { password },
      })))
      const statuses = results.map(result => result.status())
      expect(statuses).toContain(201)
      expect(statuses.every(status => [201, 400, 401].includes(status))).toBe(true)
      expect((await prisma.employee.findUniqueOrThrow({ where: { id: ids.googleEmployee } })).googleSubject).toBeNull()
      expect(await prisma.authSession.count({ where: { employeeId: ids.googleEmployee, revokedAt: null } })).toBe(0)
      expect(await prisma.actionLog.count({ where: { employeeId: ids.googleEmployee, actionType: 'GOOGLE_ACCOUNT_UNLINKED' } })).toBe(1)
      for (const api of [first, second]) expect((await api.get('/api/v1/auth/me')).status()).toBe(401)
      expect((await first.post('/api/v1/auth/sign-in', { data: { email, password } })).status()).toBe(201)
      expect(await (await first.get('/api/v1/auth/me')).json()).toMatchObject({ data: { googleLinked: false } })
      const sessions = await prisma.authSession.count({ where: { employeeId: ids.googleEmployee } })
      expect((await first.post('/api/v1/auth/google', { data: { idToken: 'g'.repeat(100) } })).status()).toBe(503)
      expect(await prisma.authSession.count({ where: { employeeId: ids.googleEmployee } })).toBe(sessions)
    } finally { await first.dispose(); await second.dispose() }
  })

  test('unconfigured Telegram is hidden by actual tracking metadata and issues no link', async ({ page }) => {
    await page.goto('/order')
    const result = await page.evaluate(async menuItemId => {
      const online = await import('/src/features/online-orders/online-orders.api.ts')
      const { ApiError } = await import('/src/shared/api/client.ts')
      const order = await online.createOnlineOrder({ pickupName: 'Telegram fixture', phoneNumber: '0901234567',
        items: [{ menuItemId, quantity: 1 }] })
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
})
