import type { QueryClient } from '@tanstack/react-query'

export function invalidateReconciliation(client: QueryClient, employeeId: string) {
  const keys = [
    ['private', employeeId, 'invoices'],
    ['private', employeeId, 'invoice-detail'],
    ['private', employeeId, 'invoice-attempts'],
    ['private', employeeId, 'refunds'],
    ['private', employeeId, 'cash-handovers'],
    ['private', 'funds'],
    ['management-exceptions-list'],
    ['management-exceptions-summary'],
  ]
  return Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })))
}
