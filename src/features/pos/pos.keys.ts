export const posKeys = {
  tables: (employeeId: string) => ['private', employeeId, 'dining-tables'] as const,
  sessions: (employeeId: string) => ['private', employeeId, 'orders', 'active-sessions'] as const,
  session: (employeeId: string, sessionId?: string) => ['private', employeeId, 'orders', 'session', sessionId] as const,
}
