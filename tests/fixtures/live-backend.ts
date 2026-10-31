import { test as base, expect, type APIRequestContext } from '@playwright/test'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '../../.runtime/backend-client'
import { backendTestEnvironment } from '../backend-environment.ts'

const requireBackend = createRequire(new URL('../../../coffee_shop_be/package.json', import.meta.url))

async function createBackendFixture(requestFactory: typeof import('@playwright/test').request, prisma: PrismaClient) {
  const fixtureNames = ['position', 'employee', 'role', 'category', 'menu',
    'session', 'invoice', 'item', 'supplier', 'receipt', 'stocktake', 'unit',
    'inventoryCategory', 'inventoryItem', 'emptyItem', 'procurementItem', 'cashFund', 'bankFund', 'restrictedEmployee', 'candidate', 'optionGroup', 'option', 'googleEmployee'] as const
  const ids = Object.fromEntries(fixtureNames.map(name => [name, randomUUID()])) as Record<typeof fixtureNames[number], string>
  ids.inventoryItem = '00000000-0000-4000-8000-' + randomUUID().slice(-12)
  ids.emptyItem = 'ffffffff-ffff-4fff-8fff-' + randomUUID().slice(-12)
  const prefix = 'FE-CONTRACT-' + randomUUID().slice(0, 8)
  const password = randomUUID() + '!Fixture'
  let cookies: Awaited<ReturnType<APIRequestContext['storageState']>>['cookies'] = []
  const hash = await (requireBackend('bcrypt') as { hash: (value: string, rounds: number) => Promise<string> }).hash(password, 4)
  const { PermissionKeys } = requireBackend('./dist/common/consts/permission-keys.js') as { PermissionKeys: Record<string, string> }
  await prisma.permission.createMany({ data: Object.values(PermissionKeys).map(key => ({ key, name: key })), skipDuplicates: true })
  const permissions = await prisma.permission.findMany({ where: { deletedAt: null }, select: { id: true } })
  await prisma.$transaction([
    prisma.position.create({ data: { id: ids.position, name: prefix, salary: '0' } }),
    prisma.employee.create({
      data: {
        id: ids.employee, email: prefix.toLowerCase() + '@example.test',
        username: prefix, fullName: prefix, password: hash, positionId: ids.position
      }
    }),
    prisma.employee.create({
      data: {
        id: ids.restrictedEmployee, email: prefix.toLowerCase() + '-restricted@example.test',
        username: prefix + '-restricted', fullName: prefix + '-restricted', password: hash, positionId: ids.position
      }
    }),
    prisma.employee.create({
      data: {
        id: ids.googleEmployee, email: prefix.toLowerCase() + '-google@example.test',
        username: prefix + '-google', fullName: prefix + '-google', password: hash, positionId: ids.position,
        googleSubject: 'fixture-subject-' + ids.googleEmployee
      }
    }),
    prisma.role.create({ data: { id: ids.role, name: prefix } }),
    prisma.employeeRole.create({ data: { employeeId: ids.employee, roleId: ids.role } }),
    prisma.rolePermission.createMany({
      data: permissions.map((permission: { id: string }) => ({
        roleId: ids.role, permissionId: permission.id,
      }))
    }),
    prisma.menuCategory.create({ data: { id: ids.category, name: prefix } }),
    prisma.menuItem.create({
      data: {
        id: ids.menu, name: prefix + '-coffee', price: '35000',
        categoryId: ids.category, isAvailable: true
      }
    }),
    prisma.menuItem.create({
      data: {
        id: ids.candidate, name: prefix + '-cake', price: '12000',
        categoryId: ids.category, isAvailable: true, optionGroups: {
          create: {
            id: ids.optionGroup, name: 'Size', minSelected: 1, maxSelected: 1,
            options: { create: { id: ids.option, name: 'Large', priceDelta: '3000' } },
          }
        }
      }
    }),
    prisma.orderSession.create({ data: { id: ids.session, employeeId: ids.employee } }),
    prisma.invoice.create({
      data: {
        id: ids.invoice, invoiceNumber: prefix, subTotal: '60000',
        totalAmount: '60000', orderSessionId: ids.session, employeeId: ids.employee
      }
    }),
    prisma.orderItem.create({
      data: {
        id: ids.item, quantity: 2, priceAtTime: '30000',
        orderSessionId: ids.session, invoiceId: ids.invoice, menuItemId: ids.menu
      }
    }),
    prisma.unit.create({ data: { id: ids.unit, name: prefix } }),
    prisma.inventoryCategory.create({ data: { id: ids.inventoryCategory, name: prefix } }),
    prisma.inventoryItem.create({
      data: {
        id: ids.inventoryItem, name: prefix, stock: '1.2345',
        averageUnitCost: '100', categoryId: ids.inventoryCategory, unitId: ids.unit
      }
    }),
    prisma.inventoryItem.create({
      data: {
        id: ids.emptyItem, name: prefix + '-low-stock', stock: '0.1000',
        averageUnitCost: '100', categoryId: ids.inventoryCategory, unitId: ids.unit
      }
    }),
    prisma.inventoryItem.create({
      data: {
        id: ids.procurementItem, name: prefix + '-procurement', stock: '10',
        averageUnitCost: '20000', categoryId: ids.inventoryCategory, unitId: ids.unit
      }
    }),
    prisma.fund.create({ data: { id: ids.cashFund, name: prefix + '-cash', type: 'CASH', balance: '0' } }),
    prisma.fund.create({ data: { id: ids.bankFund, name: prefix + '-bank', type: 'BANK', balance: '0' } }),
    prisma.supplier.create({ data: { id: ids.supplier, code: prefix, name: prefix } }),
    prisma.purchaseReceipt.create({
      data: {
        id: ids.receipt, receiptNumber: prefix, totalAmount: '123.45',
        supplierId: ids.supplier, createdById: ids.employee, items: {
          create: {
            inventoryItemId: ids.inventoryItem, inventoryItemName: prefix, unitName: prefix,
            quantity: '1.2345', unitPrice: '100', totalAmount: '123.45',
          }
        }
      }
    }),
    prisma.stocktake.create({
      data: {
        id: ids.stocktake, stocktakeNumber: prefix, createdById: ids.employee,
        items: {
          create: {
            inventoryItemId: ids.inventoryItem, inventoryItemName: prefix,
            unitName: prefix, expectedQuantity: '1.2345'
          }
        }
      }
    }),
  ])
  const api = await requestFactory.newContext({ baseURL: 'http://localhost:4174' })
  try {
    const login = await api.post('/api/v1/auth/sign-in', { data: { email: prefix.toLowerCase() + '@example.test', password } })
    expect(login.status()).toBe(201)
    cookies = (await api.storageState()).cookies
  } finally { await api.dispose() }

  async function preparationFixture(stock = '10') {
    const name = prefix + '-recipe-' + randomUUID().slice(0, 6)
    const beanId = '00000000-0000-4000-8000-' + randomUUID().slice(-12)
    const milkId = 'ffffffff-ffff-4fff-8fff-' + randomUUID().slice(-12)
    await prisma.inventoryItem.createMany({
      data: [
        { id: beanId, name: name + '-beans', stock, averageUnitCost: '20000', unitId: ids.unit, categoryId: ids.inventoryCategory },
        { id: milkId, name: name + '-milk', stock, averageUnitCost: '30000', unitId: ids.unit, categoryId: ids.inventoryCategory },
      ]
    })
    const station = await prisma.kitchenStation.create({ data: { name, code: name } })
    const menu = await prisma.menuItem.create({
      data: {
        name, price: '25000', categoryId: ids.category, kitchenStationId: station.id,
        ingredients: { create: [{ inventoryItemId: beanId, quantity: '0.1234' }, { inventoryItemId: milkId, quantity: '0.2000' }] },
        optionGroups: {
          create: {
            name: 'Topping', minSelected: 1, maxSelected: 1, options: {
              create: {
                name: 'Extra shot', priceDelta: '1500.25',
                ingredients: { create: [{ inventoryItemId: beanId, quantity: '0.0001' }, { inventoryItemId: milkId, quantity: '0.0001' }] },
              }
            }
          }
        },
      }
    })
    return { name, beanId, milkId, stationId: station.id, menuId: menu.id }
  }

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

  async function openShift() {
    const csrf = cookies.find(cookie => cookie.name === 'csrfToken')
    if (!csrf) throw new Error('Missing real CSRF cookie')
    const api = await requestFactory.newContext({
      baseURL: 'http://localhost:4174', storageState: { cookies, origins: [] },
    })
    try {
      const response = await api.post('/api/v1/cashier-shifts/open', {
        headers: { 'X-CSRF-Token': csrf.value },
        data: { fundId: ids.cashFund, startingCash: '0', idempotencyKey: randomUUID() },
      })
      expect(response.status()).toBe(201)
    } finally { await api.dispose() }
  }

  return { prisma, ids, prefix, password, cookies, preparationFixture, preparationOrder, openShift }
}

type BackendFixture = Awaited<ReturnType<typeof createBackendFixture>>

export const test = base.extend<{ backend: BackendFixture }, { database: PrismaClient }>({
  // oxlint-disable-next-line no-empty-pattern -- Playwright parses destructuring to find fixture dependencies.
  database: [async ({}, runFixture) => {
    const env = backendTestEnvironment()
    const { PrismaClient } = requireBackend('@prisma/client') as typeof import('../../.runtime/backend-client')
    const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } })
    try { await runFixture(prisma) } finally { await prisma.$disconnect() }
  }, { scope: 'worker' }],
  backend: async ({ playwright, database }, runFixture) => {
    await runFixture(await createBackendFixture(playwright.request, database))
  },
  context: async ({ context, backend }, runFixture) => {
    await context.addCookies(backend.cookies)
    await runFixture(context)
  },
})
export { expect } from '@playwright/test'
