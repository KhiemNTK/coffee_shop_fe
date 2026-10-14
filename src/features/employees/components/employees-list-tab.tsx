import { useState, useMemo, useDeferredValue } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { Session } from '../../auth/session'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Mail,
  Phone,
  ShieldCheck,
} from 'lucide-react'
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeeRoles,
  replaceEmployeeRoles,
  type EmployeeListItem,
  type PositionDropdownItem,
  type Role,
  type CreateEmployeeInput,
  type UpdateEmployeeInput,
} from '@/features/employees/employees.api'
import { errorMessage } from '@/shared/api/client'
import { Pagination } from '@/shared/ui/pagination'
import {
  Button,
  Badge,
  Card,
  CardContent,
  Input,
} from '@/shared/ui'
import { CreateEmployeeModal } from './modals/create-employee-modal'
import { EditEmployeeModal } from './modals/edit-employee-modal'
import { AssignRolesModal } from './modals/assign-roles-modal'
import { DeleteEmployeeModal } from './modals/delete-employee-modal'

export interface EmployeesListTabProps {
  positionsDropdown: PositionDropdownItem[]
  roles: Role[]
  rolesLoaded: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  canManageRoles: boolean
  onToast: (msg: string) => void
  isCreateOpen: boolean
  setIsCreateOpen: (open: boolean) => void
}

export function EmployeesListTab({
  positionsDropdown,
  roles,
  rolesLoaded,
  canUpdate,
  canDelete,
  canManageRoles,
  onToast,
  isCreateOpen,
  setIsCreateOpen,
}: EmployeesListTabProps) {
  const { employee } = useOutletContext<Session>()
  const queryClient = useQueryClient()

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'ACTIVE' | 'INACTIVE'
  >('ALL')
  const [positionFilter, setPositionFilter] = useState<string>('ALL')

  // Modals state: Employee Create
  const [createEmployeeData, setCreateEmployeeData] =
    useState<CreateEmployeeInput>({
      fullName: '',
      email: '',
      username: '',
      password: '',
      phoneNumber: '',
      address: '',
      positionId: '',
      isActive: true,
    })
  const [createEmployeeError, setCreateEmployeeError] = useState<string | null>(
    null,
  )

  // Modals state: Employee Edit
  const [editingEmployee, setEditingEmployee] =
    useState<EmployeeListItem | null>(null)
  const [editEmployeeData, setEditEmployeeData] = useState<UpdateEmployeeInput>(
    {
      fullName: '',
      phoneNumber: '',
      address: '',
      positionId: '',
      isActive: true,
    },
  )
  const [editEmployeeError, setEditEmployeeError] = useState<string | null>(
    null,
  )

  // Modals state: Employee Delete
  const [deletingEmployee, setDeletingEmployee] =
    useState<EmployeeListItem | null>(null)
  const [deleteEmployeeError, setDeleteEmployeeError] = useState<string | null>(
    null,
  )

  // Modals state: Employee Role Assignment
  const [roleAssignEmployee, setRoleAssignEmployee] =
    useState<EmployeeListItem | null>(null)
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[] | null>(null)
  const [roleAssignError, setRoleAssignError] = useState<string | null>(null)
  const [roleReviewRequired, setRoleReviewRequired] = useState(false)
  const assignment = useQuery({
    queryKey: [
      'private',
      employee.id,
      'employee-role-assignment',
      roleAssignEmployee?.id,
    ],
    queryFn: ({ signal }) => getEmployeeRoles(roleAssignEmployee!.id, signal),
    enabled: Boolean(roleAssignEmployee),
    retry: false,
    refetchOnWindowFocus: false,
  })
  const roleIds =
    selectedRoleIds ??
    assignment.data?.employeeRoles.map((item) => item.role.id) ??
    []
  const assignmentReady =
    rolesLoaded &&
    assignment.isSuccess &&
    !assignment.isFetching &&
    assignment.data.canManageRoles &&
    !roleReviewRequired

  // Queries
  const {
    data: employeesData,
    isLoading: isLoadingEmployees,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'private',
      'employees',
      deferredSearchQuery,
      statusFilter,
      positionFilter,
      page,
    ],
    queryFn: ({ signal }) =>
      getEmployees(
        {
          page,
          itemPerPage: 20,
          search: deferredSearchQuery.trim() || undefined,
          isActive:
            statusFilter === 'ALL' ? undefined : statusFilter === 'ACTIVE',
          positionId: positionFilter === 'ALL' ? undefined : positionFilter,
        },
        signal,
      ),
  })

  const invalidateEmployeeQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ['private', 'employees'] })
  }

  // Mutations
  const createEmployeeMutation = useMutation({
    mutationFn: (data: CreateEmployeeInput) => createEmployee(data),
    onSuccess: (emp) => {
      invalidateEmployeeQueries()
      onToast(`Đã thêm nhân viên "${emp.fullName}" thành công`)
      setIsCreateOpen(false)
      setCreateEmployeeData({
        fullName: '',
        email: '',
        username: '',
        password: '',
        phoneNumber: '',
        address: '',
        positionId: '',
        isActive: true,
      })
      setCreateEmployeeError(null)
    },
    onError: (err) => setCreateEmployeeError(errorMessage(err)),
  })

  const updateEmployeeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEmployeeInput }) =>
      updateEmployee(id, data),
    onSuccess: (emp) => {
      invalidateEmployeeQueries()
      onToast(`Đã cập nhật thông tin nhân viên "${emp.fullName}"`)
      setEditingEmployee(null)
      setEditEmployeeError(null)
    },
    onError: (err) => setEditEmployeeError(errorMessage(err)),
  })

  const deleteEmployeeMutation = useMutation({
    mutationFn: (id: string) => deleteEmployee(id),
    onSuccess: () => {
      invalidateEmployeeQueries()
      onToast('Đã xóa nhân viên thành công')
      setPage(1)
      setDeletingEmployee(null)
      setDeleteEmployeeError(null)
    },
    onError: (err) => setDeleteEmployeeError(errorMessage(err)),
  })

  const replaceRolesMutation = useMutation({
    retry: false,
    mutationFn: ({ id, roleIds }: { id: string; roleIds: string[] }) =>
      replaceEmployeeRoles(id, roleIds),
    onSuccess: () => {
      invalidateEmployeeQueries()
      onToast('Đã cập nhật phân quyền vai trò cho nhân viên')
      setRoleAssignEmployee(null)
      setSelectedRoleIds([])
      setRoleAssignError(null)
    },
    onError: (err) => {
      setRoleAssignError(errorMessage(err))
      setRoleReviewRequired(true)
    },
  })

  // Position Map for quick lookup
  const positionMap = useMemo(() => {
    const map = new Map<string, string>()
    positionsDropdown.forEach((p) => map.set(p.id, p.name))
    return map
  }, [positionsDropdown])

  // Filtered Employees
  const employees = employeesData?.list ?? []

  // Handler: Open Role Assignment Modal
  const handleOpenRoleAssign = (emp: EmployeeListItem) => {
    setRoleAssignEmployee(emp)
    setRoleAssignError(null)
    setRoleReviewRequired(false)
    setSelectedRoleIds(null)
    void queryClient.invalidateQueries({
      queryKey: ['private', employee.id, 'employee-role-assignment', emp.id],
    })
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <Card className="border border-border/70 shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Tìm theo tên nhân viên, username hoặc email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="pl-9"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Lọc theo trạng thái"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(
                    e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE',
                  )
                  setPage(1)
                }}
                className="h-8.5 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang làm việc</option>
                <option value="INACTIVE">Tạm khóa</option>
              </select>

              <select
                aria-label="Lọc theo vị trí"
                value={positionFilter}
                onChange={(e) => {
                  setPositionFilter(e.target.value)
                  setPage(1)
                }}
                className="h-8.5 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                <option value="ALL">Tất cả vị trí</option>
                {positionsDropdown.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee Table */}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(error)}{' '}
          <Button variant="outline" onClick={() => void refetch()}>
            Thử lại
          </Button>
        </p>
      ) : isLoadingEmployees ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Đang tải danh sách nhân sự...
          </p>
        </div>
      ) : employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            Không tìm thấy nhân viên
          </h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Không có dữ liệu phù hợp với điều kiện tìm kiếm hoặc hệ thống chưa
            có nhân sự.
          </p>
        </div>
      ) : (
        <Card className="border border-border/80 overflow-hidden shadow-xs">
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Nhân viên</th>
                  <th className="px-4 py-3">Vị trí</th>
                  <th className="px-4 py-3">Liên hệ</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {employees.map((emp) => {
                  const posName = emp.positionId
                    ? positionMap.get(emp.positionId) || '—'
                    : 'Chưa xếp'

                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-xs text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                            {emp.fullName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground leading-tight">
                              {emp.fullName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              @{emp.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge
                          variant="outline"
                          className="border-blue-200 bg-blue-50/50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                        >
                          {posName}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{emp.email}</span>
                          </div>
                          {emp.phoneNumber && (
                            <div className="flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{emp.phoneNumber}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {emp.isActive ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                          >
                            Hoạt động
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-border bg-muted text-muted-foreground"
                          >
                            Tạm khóa
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Manage Roles */}
                          {canManageRoles && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleOpenRoleAssign(emp)}
                              className="h-7 px-2 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300"
                              title="Phân quyền vai trò"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Vai trò</span>
                            </Button>
                          )}

                          {/* Edit Employee */}
                          {canUpdate && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingEmployee(emp)
                                setEditEmployeeData({
                                  fullName: emp.fullName,
                                  phoneNumber: emp.phoneNumber || '',
                                  address: emp.address || '',
                                  positionId: emp.positionId || '',
                                  isActive: emp.isActive,
                                })
                                setEditEmployeeError(null)
                              }}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                              title="Chỉnh sửa thông tin"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}

                          {/* Delete Employee */}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingEmployee(emp)
                                setDeleteEmployeeError(null)
                              }}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                              title="Xóa nhân viên"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {employeesData && !error && (
        <Pagination
          page={page}
          totalPages={employeesData.totalPages}
          onPage={setPage}
          disabled={isFetching}
        />
      )}

      {/* Modals */}
      <CreateEmployeeModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        positionsDropdown={positionsDropdown}
        formData={createEmployeeData}
        setFormData={setCreateEmployeeData}
        error={createEmployeeError}
        setError={setCreateEmployeeError}
        isPending={createEmployeeMutation.isPending}
        onSubmit={() => createEmployeeMutation.mutate(createEmployeeData)}
      />

      <EditEmployeeModal
        employee={editingEmployee}
        onClose={() => setEditingEmployee(null)}
        positionsDropdown={positionsDropdown}
        formData={editEmployeeData}
        setFormData={setEditEmployeeData}
        error={editEmployeeError}
        isPending={updateEmployeeMutation.isPending}
        onSubmit={(e) => {
          e.preventDefault()
          if (!editingEmployee) return
          updateEmployeeMutation.mutate({
            id: editingEmployee.id,
            data: editEmployeeData,
          })
        }}
      />

      <AssignRolesModal
        employee={roleAssignEmployee}
        onClose={() => setRoleAssignEmployee(null)}
        roles={roles}
        rolesLoaded={rolesLoaded}
        roleIds={roleIds}
        setSelectedRoleIds={setSelectedRoleIds}
        assignment={assignment}
        assignmentReady={assignmentReady}
        roleAssignError={roleAssignError}
        setRoleAssignError={setRoleAssignError}
        roleReviewRequired={roleReviewRequired}
        setRoleReviewRequired={setRoleReviewRequired}
        isPending={replaceRolesMutation.isPending}
        onSubmit={(ids) => {
          if (!roleAssignEmployee) return
          replaceRolesMutation.mutate({
            id: roleAssignEmployee.id,
            roleIds: ids,
          })
        }}
      />

      <DeleteEmployeeModal
        employee={deletingEmployee}
        onClose={() => setDeletingEmployee(null)}
        error={deleteEmployeeError}
        isPending={deleteEmployeeMutation.isPending}
        onConfirm={() => {
          if (!deletingEmployee) return
          deleteEmployeeMutation.mutate(deletingEmployee.id)
        }}
      />
    </div>
  )
}
