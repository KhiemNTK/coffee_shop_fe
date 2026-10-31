import { test, expect } from '../fixtures/live-backend'

test('identical bank imports replay once and conflicting entries leave balances unchanged', async ({ backend, page }, info) => {
  const { prefix, ids, prisma } = backend
  await page.goto('/staff')
  await expect(page.getByRole('heading', { name: prefix, exact: true })).toBeVisible()
  const { input, results } = await page.evaluate(async fixture => {
    const { importBankStatement } = await import('/src/features/reconciliation/reconciliation.api.ts')
    const input = {
      fundId: fixture.bankFund, sourceFileName: fixture.bankFund + '.json',
      statementFrom: new Date(Date.now() - 60_000).toISOString(), statementTo: new Date(Date.now() + 60_000).toISOString(),
      entries: [{
        externalId: fixture.bankFund, direction: 'CREDIT' as const, amount: '125000.50',
        transactionDate: new Date().toISOString(), bankReference: 'TEST-' + fixture.bankFund
      }]
    }
    const results = await Promise.allSettled([importBankStatement(input), importBankStatement(input)])
    return {
      input, results: results.map(result => result.status === 'fulfilled'
        ? { status: 'fulfilled' as const, importId: result.value.statementImport.id, replayed: result.value.replayed === true }
        : { status: 'rejected' as const, httpStatus: (result.reason as { status: number }).status })
    }
  }, ids)
  const successful = results.filter(result => result.status === 'fulfilled')
  expect(successful).toHaveLength(2)
  expect(new Set(successful.map(result => result.importId)).size).toBe(1)
  expect(successful.filter(result => result.replayed)).toHaveLength(1)
  const conflictStatus = await page.evaluate(async input => {
    const { importBankStatement } = await import('/src/features/reconciliation/reconciliation.api.ts')
    try {
      await importBankStatement({ ...input, entries: input.entries.map(entry => ({ ...entry, amount: '125000.51' })) })
      return 0
    } catch (error) { return (error as { status: number }).status }
  }, input)
  expect(conflictStatus).toBe(409)
  expect(await prisma.bankStatementImport.count({ where: { fundId: ids.bankFund } })).toBe(1)
  expect(await prisma.bankStatementEntry.count({ where: { fundId: ids.bankFund } })).toBe(1)
  const entry = await prisma.bankStatementEntry.findFirstOrThrow({ where: { fundId: ids.bankFund } })
  expect(entry.importId).toBe(successful[0]!.importId)
  expect(entry.amount.toFixed(2)).toBe('125000.50')
  expect((await prisma.fund.findUniqueOrThrow({ where: { id: ids.bankFund } })).balance.toString()).toBe('0')
  expect(await prisma.actionLog.count({ where: { employeeId: ids.employee, actionType: 'BANK_STATEMENT_IMPORTED' } })).toBe(1)
  await page.goto('/staff/reconciliation?tab=bank')
  await expect(page.locator('a[aria-current="page"]:visible').first()).toHaveCSS('color', 'rgb(255, 255, 255)')
  await page.getByRole('button', { name: new RegExp(ids.bankFund!) }).click()
  const statement = page.getByRole('region', { name: 'Chi tiết sao kê', exact: true })
  await expect(statement).toBeVisible()
  await expect(statement.getByText(ids.bankFund.toUpperCase(), { exact: true })).toBeVisible()
  await expect(statement.getByText('CREDIT', { exact: true })).toBeVisible()
  await expect(statement.getByText('UNMATCHED', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('real-bank-statement.png') })
})
