import { expect, request, test } from '@playwright/test'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

test.describe('real Docker backend contract', () => {
  test.skip(process.env.RUN_LIVE_BACKEND !== 'true', 'Opt-in local PostgreSQL/Redis fixture test')
  test.describe.configure({ mode: 'serial', timeout: 120_000 })
  const requireBackend = createRequire(resolve('../coffee_shop_be/package.json'))
  const ids = Object.fromEntries(['position', 'employee', 'role', 'category', 'menu',
    'session', 'invoice', 'item', 'supplier', 'receipt', 'stocktake', 'unit',
    'inventoryCategory', 'inventoryItem'].map((name) => [name, randomUUID()]))
  const prefix = 'FE-CONTRACT-' + randomUUID().slice(0, 8)
  const password = randomUUID() + '!Fixture'
  let prisma: ReturnType<typeof requireBackend>
  let cookies: Awaited<ReturnType<Awaited<ReturnType<typeof request.newContext>>['storageState']>>['cookies'] = []

  test.beforeAll(async () => {
    const env = requireBackend('dotenv').parse(readFileSync(resolve('../coffee_shop_be/.env')))
    const database = new URL(env.DATABASE_URL)
    if (env.NODE_ENV === 'production' || !['localhost', '127.0.0.1'].includes(database.hostname))
      throw new Error('Live fixtures are allowed only on the local development database')
    const { PrismaClient } = requireBackend('@prisma/client')
    prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } })
    const hash = await requireBackend('bcrypt').hash(password, 12)
    const permissions = await prisma.permission.findMany({ where: { deletedAt: null }, select: { id: true } })
    await prisma.$transaction([
      prisma.position.create({ data: { id: ids.position, name: prefix, salary: '0' } }),
      prisma.employee.create({ data: { id: ids.employee, email: prefix.toLowerCase() + '@example.test',
        username: prefix, fullName: prefix, password: hash, positionId: ids.position } }),
      prisma.role.create({ data: { id: ids.role, name: prefix } }),
      prisma.employeeRole.create({ data: { employeeId: ids.employee, roleId: ids.role } }),
      prisma.rolePermission.createMany({ data: permissions.map((permission: { id: string }) => ({
        roleId: ids.role, permissionId: permission.id,
      })) }),
      prisma.menuCategory.create({ data: { id: ids.category, name: prefix } }),
      prisma.menuItem.create({ data: { id: ids.menu, name: prefix + '-coffee', price: '35000',
        categoryId: ids.category, isAvailable: false } }),
      prisma.orderSession.create({ data: { id: ids.session, employeeId: ids.employee } }),
      prisma.invoice.create({ data: { id: ids.invoice, invoiceNumber: prefix, subTotal: '60000',
        totalAmount: '60000', orderSessionId: ids.session, employeeId: ids.employee } }),
      prisma.orderItem.create({ data: { id: ids.item, quantity: 2, priceAtTime: '30000',
        orderSessionId: ids.session, invoiceId: ids.invoice, menuItemId: ids.menu } }),
      prisma.unit.create({ data: { id: ids.unit, name: prefix } }),
      prisma.inventoryCategory.create({ data: { id: ids.inventoryCategory, name: prefix } }),
      prisma.inventoryItem.create({ data: { id: ids.inventoryItem, name: prefix, stock: '1.2345',
        categoryId: ids.inventoryCategory, unitId: ids.unit } }),
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
    const api = await request.newContext({ baseURL: 'http://localhost:8888' })
    try {
      const login = await api.post('/api/v1/auth/sign-in', { data: { email: prefix.toLowerCase() + '@example.test', password } })
      expect(login.status()).toBe(201)
      cookies = (await api.storageState()).cookies
    } finally { await api.dispose() }
  })

  test.afterAll(async () => {
    if (!prisma) return
    try {
      // Delete only the UUIDs owned by this run. Never disable immutable audit triggers.
      await prisma.$transaction([
        prisma.stocktake.deleteMany({ where: { id: ids.stocktake } }),
        prisma.purchaseReceipt.deleteMany({ where: { id: ids.receipt } }),
        prisma.supplier.deleteMany({ where: { id: ids.supplier } }),
        prisma.inventoryItem.deleteMany({ where: { id: ids.inventoryItem } }),
        prisma.inventoryCategory.deleteMany({ where: { id: ids.inventoryCategory } }),
        prisma.unit.deleteMany({ where: { id: ids.unit } }),
        prisma.orderItem.deleteMany({ where: { id: ids.item } }),
        prisma.invoice.deleteMany({ where: { id: ids.invoice } }),
        prisma.orderSession.deleteMany({ where: { id: ids.session } }),
        prisma.menuItem.deleteMany({ where: { id: ids.menu } }),
        prisma.menuCategory.deleteMany({ where: { id: ids.category } }),
        prisma.employee.deleteMany({ where: { id: ids.employee } }),
        prisma.role.deleteMany({ where: { id: ids.role } }),
        prisma.position.deleteMany({ where: { id: ids.position } }),
      ])
    } finally { await prisma.$disconnect() }
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
    expect(checks.passed).toBe(46)
    await page.goto('/staff/invoices')
    await page.getByRole('code').filter({ hasText: prefix }).click()
    await expect(page.getByRole('dialog').getByText(prefix + '-coffee', { exact: true })).toBeVisible()
    await expect(page.getByRole('dialog').getByText('Mang đi', { exact: true })).toBeVisible()
    await page.screenshot({ path: info.outputPath('live-takeaway-invoice.png') })
  })
})
