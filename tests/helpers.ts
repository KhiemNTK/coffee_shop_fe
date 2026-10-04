/**
 * Shared test helpers and fixtures for Playwright E2E suites.
 */

export const envelope = (data: unknown) => ({
  errors: null,
  data,
  message: 'OK',
})

export const defaultMockAdminEmployee = {
  id: '10000000-0000-4000-8000-000000000001',
  email: 'admin@coffee.test',
  username: 'admin',
  fullName: 'Quản trị viên Hệ thống',
  isActive: true,
  position: { id: '20000000-0000-4000-8000-000000000001', name: 'Quản trị viên' },
}

export function defaultMockAdminAuth(permissions: string[] = []) {
  return {
    employeeId: defaultMockAdminEmployee.id,
    employeeEmail: defaultMockAdminEmployee.email,
    roleNames: ['ADMIN'],
    permissionKeys: permissions,
  }
}
