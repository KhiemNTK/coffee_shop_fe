import { useState, useMemo, useDeferredValue, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import { sessionKey, type Session } from '../../auth/session'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Search, Edit2, Trash2, Mail, Phone, ShieldCheck } from 'lucide-react'
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
import { Button, Badge, AdminTable, Input } from '@/shared/ui'
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
  canCreate,
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
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [positionFilter, setPositionFilter] = useState<string>('ALL')

  // Modals state: Employee Create
  const [createEmployeeData, setCreateEmployeeData] = useState<CreateEmployeeInput>({
    fullName: '',
    email: '',
    username: '',
    password: '',
    phoneNumber: '',
    address: '',
    positionId: '',
    isActive: true,
  })
  const [createEmployeeError, setCreateEmployeeError] = useState<string | null>(null)

  // Modals state: Employee Edit
  const [editingEmployee, setEditingEmployee] = useState<EmployeeListItem | null>(null)
  const [editEmployeeData, setEditEmployeeData] = useState<UpdateEmployeeInput>({
    fullName: '',
    phoneNumber: '',
    address: '',
    positionId: '',
    isActive: true,
  })
  const [editEmployeeError, setEditEmployeeError] = useState<string | null>(null)

  // Modals state: Employee Delete
  const [deletingEmployee, setDeletingEmployee] = useState<EmployeeListItem | null>(null)
  const [deleteEmployeeError, setDeleteEmployeeError] = useState<string | null>(null)

  // Modals state: Employee Role Assignment
  const [roleAssignEmployee, setRoleAssignEmployee] = useState<EmployeeListItem | null>(null)
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[] | null>(null)
  const roleBaseline = useRef<string[] | null>(null)
  const [roleAssignError, setRoleAssignError] = useState<string | null>(null)
  const [roleReviewRequired, setRoleReviewRequired] = useState(false)
  const assignment = useQuery({
    queryKey: ['private', employee.id, 'employee-role-assignment', roleAssignEmployee?.id],
    queryFn: ({ signal }) => getEmployeeRoles(roleAssignEmployee!.id, signal),
    enabled: Boolean(roleAssignEmployee) && canManageRoles,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const roleIds =
    selectedRoleIds ?? assignment.data?.employeeRoles.map((item) => item.role.id) ?? []
  const assignmentReady =
    canManageRoles &&
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
    queryKey: ['private', 'employees', deferredSearchQuery, statusFilter, positionFilter, page],
    queryFn: ({ signal }) =>
      getEmployees(
        {
          page,
          itemPerPage: 20,
          search: deferredSearchQuery.trim() || undefined,
          isActive: statusFilter === 'ALL' ? undefined : statusFilter === 'ACTIVE',
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
    mutationFn: ({ id, roleIds, expectedRoleIds }: { id: string; roleIds: string[]; expectedRoleIds: string[] }) =>
      replaceEmployeeRoles(id, roleIds, expectedRoleIds),
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
      void queryClient.invalidateQueries({ queryKey: sessionKey })
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
    roleBaseline.current = null
    setSelectedRoleIds(null)
    void queryClient.invalidateQueries({
      queryKey: ['private', employee.id, 'employee-role-assignment', emp.id],
    })
  }

  return (
    <div className="space-y-4">
      <section aria-label="Bộ lọc nhân sự" className="admin-toolbar">
        <div className="relative min-w-0 flex-1 basis-64">
          <Search
            size={16}
            aria-hidden="true"
            className="absolute left-3 top-3 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Tìm nhân viên"
            placeholder="Tìm theo tên nhân viên, username hoặc email..."
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value)
              setPage(1)
            }}
            className="pl-9"
          />
        </div>
        <select
          aria-label="Lọc theo trạng thái"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')
            setPage(1)
          }}
          className="min-w-0 rounded-md border border-input bg-card px-3 text-sm"
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang làm việc</option>
          <option value="INACTIVE">Tạm khóa</option>
        </select>
        <select
          aria-label="Lọc theo vị trí"
          value={positionFilter}
          onChange={(event) => {
            setPositionFilter(event.target.value)
            setPage(1)
          }}
          className="min-w-0 rounded-md border border-input bg-card px-3 text-sm"
        >
          <option value="ALL">Tất cả vị trí</option>
          {positionsDropdown.map((position) => (
            <option key={position.id} value={position.id}>
              {position.name}
            </option>
          ))}
        </select>
      </section>
      {error ? (
        <div role="alert" className="border-l-4 border-destructive p-4 text-sm">
          {errorMessage(error)}{' '}
          <Button variant="outline" onClick={() => void refetch()}>
            Thử lại
          </Button>
        </div>
      ) : isLoadingEmployees ? (
        <p role="status" className="py-12 text-center text-sm text-muted-foreground">
          Đang tải danh sách nhân sự...
        </p>
      ) : employees.length === 0 ? (
        <div className="py-12 text-center">
          <Users size={28} aria-hidden="true" className="mx-auto mb-3 text-muted-foreground" />
          <h3 className="text-base font-semibold">Không tìm thấy nhân viên</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Không có dữ liệu phù hợp với điều kiện tìm kiếm hoặc hệ thống chưa có nhân sự.
          </p>
        </div>
      ) : (
        <AdminTable label="Danh sách nhân sự">
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Vị trí</th>
              <th>Liên hệ</th>
              <th>Trạng thái</th>
              <th className="text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              const posName = emp.positionId ? positionMap.get(emp.positionId) || '—' : 'Chưa xếp'
              const initials = emp.fullName
                .trim()
                .split(/\s+/)
                .slice(-2)
                .map((word) => word[0])
                .join('')
                .toUpperCase()
              return (
                <tr key={emp.id}>
                  <td className="max-w-64">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary"
                      >
                        {initials}
                      </span>
                      <div className="min-w-0">
                        <strong className="block break-words">{emp.fullName}</strong>
                        <span className="block break-words text-xs text-muted-foreground">
                          @{emp.username}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="max-w-56">
                    <Badge variant="secondary" className="max-w-full break-words" title={posName}>
                      {posName}
                    </Badge>
                  </td>
                  <td className="max-w-72">
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p className="flex items-start gap-1.5">
                        <Mail size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
                        <span className="break-all">{emp.email}</span>
                      </p>
                      {emp.phoneNumber && (
                        <p className="flex items-center gap-1.5">
                          <Phone size={14} aria-hidden="true" />
                          {emp.phoneNumber}
                        </p>
                      )}
                    </div>
                  </td>
                  <td>
                    <Badge variant={emp.isActive ? 'success' : 'warning'}>
                      {emp.isActive ? 'Hoạt động' : 'Tạm khóa'}
                    </Badge>
                  </td>
                  <td>
                    <div className="admin-actions">
                      {canManageRoles && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenRoleAssign(emp)}
                          title="Phân quyền vai trò"
                          aria-label={`Phân quyền vai trò ${emp.fullName}`}
                        >
                          <ShieldCheck size={15} aria-hidden="true" />
                          Vai trò
                        </Button>
                      )}
                      {canUpdate && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10"
                          title="Chỉnh sửa thông tin"
                          aria-label={`Chỉnh sửa thông tin ${emp.fullName}`}
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
                        >
                          <Edit2 size={16} aria-hidden="true" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 text-destructive"
                          title="Xóa nhân viên"
                          aria-label={`Xóa nhân viên ${emp.fullName}`}
                          onClick={() => {
                            setDeletingEmployee(emp)
                            setDeleteEmployeeError(null)
                          }}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </AdminTable>
      )}
      {employeesData && !error && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {employeesData.totalItems} nhân viên · Trang {employeesData.currentPage}
          </span>
          <Pagination
            page={page}
            totalPages={employeesData.totalPages}
            onPage={setPage}
            disabled={isFetching}
          />
        </div>
      )}

      {/* Modals */}
      <CreateEmployeeModal
        isOpen={canCreate && isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        positionsDropdown={positionsDropdown}
        formData={createEmployeeData}
        setFormData={setCreateEmployeeData}
        error={createEmployeeError}
        setError={setCreateEmployeeError}
        isPending={createEmployeeMutation.isPending}
        onSubmit={() => { if (canCreate) createEmployeeMutation.mutate(createEmployeeData) }}
      />

      <EditEmployeeModal
        employee={canUpdate ? editingEmployee : null}
        onClose={() => setEditingEmployee(null)}
        positionsDropdown={positionsDropdown}
        formData={editEmployeeData}
        setFormData={setEditEmployeeData}
        error={editEmployeeError}
        isPending={updateEmployeeMutation.isPending}
        onSubmit={(e) => {
          e.preventDefault()
          if (!canUpdate || !editingEmployee) return
          updateEmployeeMutation.mutate({
            id: editingEmployee.id,
            data: editEmployeeData,
          })
        }}
      />

      <AssignRolesModal
        employee={canManageRoles ? roleAssignEmployee : null}
        onClose={() => setRoleAssignEmployee(null)}
        roles={roles}
        rolesLoaded={rolesLoaded}
        roleIds={roleIds}
        setSelectedRoleIds={(ids) => {
          roleBaseline.current ??= assignment.data?.employeeRoles.map((entry) => entry.role.id) ?? []
          setSelectedRoleIds(ids)
        }}
        assignment={assignment}
        assignmentReady={assignmentReady}
        roleAssignError={roleAssignError}
        roleReviewRequired={roleReviewRequired}
        onReconcile={async () => {
          const current = await assignment.refetch()
          if (!current.isSuccess) return
          roleBaseline.current = null
          setSelectedRoleIds(null)
          setRoleReviewRequired(false)
          setRoleAssignError(null)
        }}
        isPending={replaceRolesMutation.isPending}
        onSubmit={(ids) => {
          if (!canManageRoles || !roleAssignEmployee) return
          replaceRolesMutation.mutate({
            id: roleAssignEmployee.id,
            roleIds: ids,
            expectedRoleIds: roleBaseline.current ?? assignment.data?.employeeRoles.map((entry) => entry.role.id) ?? [],
          })
        }}
      />

      <DeleteEmployeeModal
        employee={canDelete ? deletingEmployee : null}
        onClose={() => setDeletingEmployee(null)}
        error={deleteEmployeeError}
        isPending={deleteEmployeeMutation.isPending}
        onConfirm={() => {
          if (!canDelete || !deletingEmployee) return
          deleteEmployeeMutation.mutate(deletingEmployee.id)
        }}
      />
    </div>
  )
}
