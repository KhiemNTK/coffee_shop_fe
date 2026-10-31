import assert from 'node:assert/strict'
import test from 'node:test'
import { boundaryViolation, moduleImports, runtimeCycles } from './check-boundaries.mjs'
import { moneySchema, signedMoneySchema } from '../src/shared/api/money.ts'

test('shared infrastructure cannot import app or feature implementations', () => {
  assert.ok(boundaryViolation('src/shared/ui/header.tsx', 'src/features/customers/customers.api.ts'))
  assert.ok(boundaryViolation('src/shared/api/client.ts', 'src/app/router.tsx'))
  assert.ok(boundaryViolation('src/features/auth/session.ts', 'src/app/query-client.ts'))
  assert.equal(boundaryViolation('src/features/auth/session.ts', 'src/shared/api/query-client.ts'), null)
})

test('features expose root entries, not their private components, hooks or pages', () => {
  assert.ok(boundaryViolation('src/features/pos/checkout.tsx', 'src/features/invoices/components/payment.tsx'))
  assert.ok(boundaryViolation('src/features/menu/menu-page.tsx', 'src/features/online-orders/hooks/use-checkout.ts'))
  assert.ok(boundaryViolation('src/features/menu/menu-page.tsx', 'src/features/customers/account-page.tsx'))
  assert.equal(boundaryViolation('src/features/pos/checkout.tsx', 'src/features/invoices/payment-gateway-panel.tsx'), null)
  assert.equal(boundaryViolation('src/features/menu/menu-page.tsx', 'src/features/menu/components/card.tsx'), null)
  assert.equal(boundaryViolation('src/app/router.tsx', 'src/features/menu/menu-page.tsx'), null)
})

test('imports include reexports and lazy imports while type-only edges stay distinguishable', () => {
  const imports = moduleImports(`
    import type { Session } from './session'
    import { type Item } from './item'
    import { getMenu, type MenuItem } from './menu'
    export type { User } from './user'
    export { type Account } from './account'
    export { Widget } from './widget'
    const Page = () => import('./page')
    type Options = import('./options').Options
  `, 'example.tsx')
  assert.deepEqual(imports.map(({ specifier, typeOnly }) => [specifier, typeOnly]), [
    ['./session', true], ['./item', true], ['./menu', false],
    ['./user', true], ['./account', true], ['./widget', false], ['./page', false], ['./options', true],
  ])
})

test('cycle detection rejects a cycle without confusing a shared leaf with one', () => {
  assert.deepEqual(runtimeCycles(new Map([['a', ['shared']], ['b', ['shared']], ['shared', []]])), [])
  assert.deepEqual(runtimeCycles(new Map([['a', ['b']], ['b', ['a']]])), [['a', 'b', 'a']])
})

test('shared money parsing retains exact decimals, sign rules and unsafe-number rejection', () => {
  for (const value of ['0', '35000.25', '9999999999999999.99', 0, 35000.25]) {
    assert.equal(moneySchema.parse(value), String(value))
    assert.equal(signedMoneySchema.parse(value), String(value))
  }
  for (const value of ['-1', -1]) {
    assert.equal(moneySchema.safeParse(value).success, false)
    assert.equal(signedMoneySchema.parse(value), String(value))
  }
  for (const value of ['1.001', '1e5', '10000000000000000.00', Number.NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    assert.equal(moneySchema.safeParse(value).success, false)
    assert.equal(signedMoneySchema.safeParse(value).success, false)
  }
})
