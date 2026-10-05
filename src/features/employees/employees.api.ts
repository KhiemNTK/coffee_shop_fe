import { z } from 'zod'
import { apiGet, apiMutate } from '@/shared/api/client'
import { moneySchema } from '../menu/menu.api'

// ==========================================
// POSITIONS SCHEMAS
// ==========================================

export const positionDropdownItemSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export type PositionDropdownItem = z.infer<typeof positionDropdownItemSchema>

export const positionSchema = z.object({
  id: z.string(),
  name: z.string(),
  salary: moneySchema,
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export type Position = z.infer<typeof positionSchema>

export const paginatedPositionsSchema = z.object({
  list: z.array(positionSchema),
  totalPages: z.number(),
  totalItems: z.number(),
  currentPage: z.number(),
})

export type PaginatedPositions = z.infer<typeof paginatedPositionsSchema>

// ==========================================
// ROLES & PERMISSIONS SCHEMAS
// ==========================================

export const permissionSchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string(),
  description: z.string().nullable().optional(),
})

export type Permission = z.infer<typeof permissionSchema>

export const paginatedPermissionsSchema = z.object({
  list: z.array(permissionSchema),
  totalPages: z.number(),
  totalItems: z.number(),
  currentPage: z.number(),
})

export type PaginatedPermissions = z.infer<typeof paginatedPermissionsSchema>

export const roleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  isSystemRole: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export type Role = z.infer<typeof roleSchema>

export const paginatedRolesSchema = z.object({
  list: z.array(roleSchema),
  totalPages: z.number(),
  totalItems: z.number(),
  currentPage: z.number(),
})

export type PaginatedRoles = z.infer<typeof paginatedRolesSchema>

export const rolePermissionDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  isSystemRole: z.boolean().optional(),
  rolePermissions: z.array(
    z.object({
      permission: permissionSchema,
    }),
  ),
})

export type RolePermissionDetail = z.infer<typeof rolePermissionDetailSchema>

// ==========================================
// EMPLOYEES SCHEMAS
// ==========================================

export const employeeListItemSchema = z.object({
  id: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable().optional(),
  fullName: z.string(),
  address: z.string().nullable().optional(),
  phoneNumber: z.string().nullable().optional(),
  username: z.string(),
  salary: moneySchema.nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  positionId: z.string().nullable().optional(),
})

export type EmployeeListItem = z.infer<typeof employeeListItemSchema>

export const paginatedEmployeesSchema = z.object({
  list: z.array(employeeListItemSchema),
  totalPages: z.number(),
  totalItems: z.number(),
  currentPage: z.number(),
})

export type PaginatedEmployees = z.infer<typeof paginatedEmployeesSchema>

export const employeeRolesResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  fullName: z.string(),
  isActive: z.boolean(),
  employeeRoles: z.array(
    z.object({
      role: z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().nullable().optional(),
        isSystemRole: z.boolean().optional(),
      }),
    }),
  ),
})

export type EmployeeRolesResponse = z.infer<typeof employeeRolesResponseSchema>

const newPasswordSchema = z
  .string()
  .min(12, 'Mật khẩu tối thiểu 12 ký tự')
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    'Mật khẩu tối đa 72 byte UTF-8',
  )
const phoneInputSchema = z
  .string()
  .trim()
  .refine(
    (value) => !value || (value.length >= 10 && value.length <= 15),
    'Điện thoại cần 10–15 ký tự',
  )

export const createEmployeeInputSchema = z.object({
  fullName: z.string().trim().min(1, 'Họ và tên không được để trống'),
  email: z.string().trim().email('Email không đúng định dạng'),
  username: z.string().trim().min(3, 'Tên đăng nhập tối thiểu 3 ký tự'),
  password: newPasswordSchema,
  phoneNumber: phoneInputSchema.optional(),
  address: z.string().trim().optional(),
  positionId: z.string().min(1, 'Vui lòng chọn vị trí công việc'),
  isActive: z.boolean().default(true),
})

export type CreateEmployeeInput = z.infer<typeof createEmployeeInputSchema>

export const updateEmployeeInputSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, 'Họ và tên không được để trống')
    .optional(),
  phoneNumber: phoneInputSchema.optional(),
  address: z.string().trim().optional(),
  positionId: z.string().optional(),
  isActive: z.boolean().optional(),
  password: newPasswordSchema.optional(),
})

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeInputSchema>

export const actionMessageResponseSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
})

export type ActionMessageResponse = z.infer<typeof actionMessageResponseSchema>

// ==========================================
// API CLIENT FUNCTIONS
// ==========================================

// Employees API
export async function getEmployees(
  params: {
    page?: number
    itemPerPage?: number
    search?: string
    isActive?: boolean
    positionId?: string
  },
  signal?: AbortSignal,
): Promise<PaginatedEmployees> {
  const query = new URLSearchParams()
  query.set('page', String(params.page || 1))
  query.set('itemPerPage', String(params.itemPerPage || 10))
  if (params.search) query.set('search', params.search)
  if (params.isActive !== undefined)
    query.set('isActive', String(params.isActive))
  if (params.positionId) query.set('positionId', params.positionId)
  return apiGet(
    `/employees?${query.toString()}`,
    paginatedEmployeesSchema,
    signal,
    true,
  )
}

export async function createEmployee(
  payload: CreateEmployeeInput,
): Promise<EmployeeListItem> {
  return apiMutate('/employees', 'POST', employeeListItemSchema, {
    ...payload,
    phoneNumber: payload.phoneNumber?.trim() || undefined,
  })
}

export async function updateEmployee(
  id: string,
  payload: UpdateEmployeeInput,
): Promise<EmployeeListItem> {
  return apiMutate(`/employees/${id}`, 'PATCH', employeeListItemSchema, {
    ...payload,
    phoneNumber:
      payload.phoneNumber === undefined
        ? undefined
        : payload.phoneNumber.trim() || null,
  })
}

export async function deleteEmployee(
  id: string,
): Promise<ActionMessageResponse> {
  return apiMutate(
    `/employees/${id}`,
    'DELETE',
    actionMessageResponseSchema,
    undefined,
  )
}

export async function getEmployeeRoles(
  id: string,
  signal?: AbortSignal,
): Promise<EmployeeRolesResponse> {
  return apiGet(
    `/employees/${id}/roles`,
    employeeRolesResponseSchema,
    signal,
    true,
  )
}

export async function replaceEmployeeRoles(
  id: string,
  roleIds: string[],
): Promise<ActionMessageResponse> {
  return apiMutate(
    `/employees/${id}/roles`,
    'PUT',
    actionMessageResponseSchema,
    { roleIds },
  )
}

// Positions API
export async function getPositionsDropdown(
  signal?: AbortSignal,
): Promise<PositionDropdownItem[]> {
  return apiGet(
    '/positions/dropdown',
    z.array(positionDropdownItemSchema),
    signal,
    true,
  )
}

export async function getPositions(
  params: { page?: number; itemPerPage?: number },
  signal?: AbortSignal,
): Promise<PaginatedPositions> {
  const query = new URLSearchParams()
  query.set('page', String(params.page || 1))
  query.set('itemPerPage', String(params.itemPerPage || 20))
  return apiGet(
    `/positions?${query.toString()}`,
    paginatedPositionsSchema,
    signal,
    true,
  )
}

export async function createPosition(payload: {
  name: string
  salary: string
}): Promise<Position> {
  return apiMutate('/positions', 'POST', positionSchema, payload)
}

export async function updatePosition(
  id: string,
  payload: { name?: string; salary?: string },
): Promise<Position> {
  return apiMutate(`/positions/${id}`, 'PATCH', positionSchema, payload)
}

export async function deletePosition(
  id: string,
): Promise<ActionMessageResponse> {
  return apiMutate(
    `/positions/${id}`,
    'DELETE',
    actionMessageResponseSchema,
    undefined,
  )
}

// Roles & Permissions API
export async function getRoles(
  params: { page?: number; itemPerPage?: number },
  signal?: AbortSignal,
): Promise<PaginatedRoles> {
  const query = new URLSearchParams()
  query.set('page', String(params.page || 1))
  query.set('itemPerPage', String(params.itemPerPage || 20))
  return apiGet(
    `/roles?${query.toString()}`,
    paginatedRolesSchema,
    signal,
    true,
  )
}

export async function getRolePermissions(
  id: string,
  signal?: AbortSignal,
): Promise<RolePermissionDetail> {
  return apiGet(
    `/roles/${id}/permissions`,
    rolePermissionDetailSchema,
    signal,
    true,
  )
}

export async function replaceRolePermissions(
  id: string,
  permissionIds: string[],
): Promise<ActionMessageResponse> {
  return apiMutate(
    `/roles/${id}/permissions`,
    'PUT',
    actionMessageResponseSchema,
    {
      permissionIds,
    },
  )
}

export async function getPermissions(
  params: { page?: number; itemPerPage?: number },
  signal?: AbortSignal,
): Promise<PaginatedPermissions> {
  const query = new URLSearchParams()
  query.set('page', String(params.page || 1))
  query.set('itemPerPage', String(params.itemPerPage || 100))
  return apiGet(
    `/permissions?${query.toString()}`,
    paginatedPermissionsSchema,
    signal,
    true,
  )
}

export async function getAllRoles(signal?: AbortSignal) {
  const list: Role[] = []
  let page = 1
  let totalPages = 1
  do {
    const result = await getRoles({ page, itemPerPage: 100 }, signal)
    list.push(...result.list)
    totalPages = result.totalPages
    page++
  } while (page <= totalPages)
  return list
}

export async function getAllPermissions(signal?: AbortSignal) {
  const list: Permission[] = []
  let page = 1
  let totalPages = 1
  do {
    const result = await getPermissions({ page, itemPerPage: 100 }, signal)
    list.push(...result.list)
    totalPages = result.totalPages
    page++
  } while (page <= totalPages)
  return list
}

export function saveRole(
  id: string | undefined,
  data: { name: string; description?: string | null },
) {
  return apiMutate(
    id ? `/roles/${id}` : '/roles',
    id ? 'PATCH' : 'POST',
    roleSchema,
    data,
  )
}

export function deleteRole(id: string) {
  return apiMutate(`/roles/${id}`, 'DELETE', z.unknown())
}
