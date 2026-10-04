import { useState, useMemo, useDeferredValue } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  AlertCircle,
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
import {
  Button,
  Badge,
  Card,
  CardContent,
  Input,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui'

export interface EmployeesListTabProps {
  positionsDropdown: PositionDropdownItem[]
  roles: Role[]
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
  canUpdate,
  canDelete,
  canManageRoles,
  onToast,
  isCreateOpen,
  setIsCreateOpen,
}: EmployeesListTabProps) {
  const queryClient = useQueryClient()

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('')
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
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([])
  const [roleAssignError, setRoleAssignError] = useState<string | null>(null)

  // Queries
  const {
    data: employeesData,
    isLoading: isLoadingEmployees,
  } = useQuery({
    queryKey: ['private', 'employees', deferredSearchQuery],
    queryFn: ({ signal }) =>
      getEmployees(
        { page: 1, itemPerPage: 100, search: deferredSearchQuery.trim() || undefined },
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
      setDeletingEmployee(null)
      setDeleteEmployeeError(null)
    },
    onError: (err) => setDeleteEmployeeError(errorMessage(err)),
  })

  const replaceRolesMutation = useMutation({
    mutationFn: ({ id, roleIds }: { id: string; roleIds: string[] }) =>
      replaceEmployeeRoles(id, roleIds),
    onSuccess: () => {
      invalidateEmployeeQueries()
      onToast('Đã cập nhật phân quyền vai trò cho nhân viên')
      setRoleAssignEmployee(null)
      setSelectedRoleIds([])
      setRoleAssignError(null)
    },
    onError: (err) => setRoleAssignError(errorMessage(err)),
  })

  // Position Map for quick lookup
  const positionMap = useMemo(() => {
    const map = new Map<string, string>()
    positionsDropdown.forEach((p) => map.set(p.id, p.name))
    return map
  }, [positionsDropdown])

  // Filtered Employees
  const filteredEmployees = useMemo(() => {
    const list = employeesData?.list ?? []
    return list.filter((emp) => {
      if (statusFilter === 'ACTIVE' && !emp.isActive) return false
      if (statusFilter === 'INACTIVE' && emp.isActive) return false
      if (positionFilter !== 'ALL' && emp.positionId !== positionFilter) return false
      return true
    })
  }, [employeesData?.list, statusFilter, positionFilter])

  // Handler: Open Role Assignment Modal
  const handleOpenRoleAssign = async (emp: EmployeeListItem) => {
    setRoleAssignEmployee(emp)
    setRoleAssignError(null)
    try {
      const res = await getEmployeeRoles(emp.id)
      const currentRoleIds = res.employeeRoles.map((er) => er.role.id)
      setSelectedRoleIds(currentRoleIds)
    } catch {
      setSelectedRoleIds([])
    }
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
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Lọc theo trạng thái"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="h-8.5 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang làm việc</option>
                <option value="INACTIVE">Tạm khóa</option>
              </select>

              <select
                aria-label="Lọc theo vị trí"
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
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
      {isLoadingEmployees ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Đang tải danh sách nhân sự...</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">Không tìm thấy nhân viên</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Không có dữ liệu phù hợp với điều kiện tìm kiếm hoặc hệ thống chưa có nhân sự.
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
                {filteredEmployees.map((emp) => {
                  const posName = emp.positionId
                    ? positionMap.get(emp.positionId) || '—'
                    : 'Chưa xếp'

                  return (
                    <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
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

      {/* MODAL: CREATE EMPLOYEE */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        className="max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            Thêm nhân viên mới
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Khởi tạo tài khoản nhân sự và liên kết vị trí làm việc
          </DialogDescription>
        </DialogHeader>

        {createEmployeeError && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{createEmployeeError}</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!createEmployeeData.positionId) {
              setCreateEmployeeError('Vui lòng chọn vị trí công việc')
              return
            }
            createEmployeeMutation.mutate(createEmployeeData)
          }}
          className="mt-4 space-y-3.5"
        >
          <div>
            <label className="text-xs font-medium text-foreground">
              Họ và tên <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              placeholder="Ví dụ: Nguyễn Văn An"
              value={createEmployeeData.fullName}
              onChange={(e) =>
                setCreateEmployeeData({ ...createEmployeeData, fullName: e.target.value })
              }
              required
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground">
                Email đăng nhập <span className="text-destructive">*</span>
              </label>
              <Input
                type="email"
                placeholder="nhanvien@example.com"
                value={createEmployeeData.email}
                onChange={(e) =>
                  setCreateEmployeeData({ ...createEmployeeData, email: e.target.value })
                }
                required
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">
                Tên đăng nhập (Username) <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                placeholder="nguyenvanan"
                value={createEmployeeData.username}
                onChange={(e) =>
                  setCreateEmployeeData({ ...createEmployeeData, username: e.target.value })
                }
                required
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground">
                Mật khẩu ban đầu <span className="text-destructive">*</span>
              </label>
              <Input
                type="password"
                placeholder="Tối thiểu 12 ký tự"
                minLength={12}
                maxLength={72}
                value={createEmployeeData.password}
                onChange={(e) =>
                  setCreateEmployeeData({ ...createEmployeeData, password: e.target.value })
                }
                required
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">
                Vị trí công việc <span className="text-destructive">*</span>
              </label>
              <select
                aria-label="Chọn vị trí công việc"
                value={createEmployeeData.positionId}
                onChange={(e) =>
                  setCreateEmployeeData({ ...createEmployeeData, positionId: e.target.value })
                }
                required
                className="mt-1 w-full rounded-lg border border-border bg-card p-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                <option value="">-- Chọn vị trí --</option>
                {positionsDropdown.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground">Số điện thoại</label>
              <Input
                type="tel"
                placeholder="0912345678"
                value={createEmployeeData.phoneNumber || ''}
                onChange={(e) =>
                  setCreateEmployeeData({ ...createEmployeeData, phoneNumber: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Địa chỉ</label>
              <Input
                type="text"
                placeholder="Địa chỉ cư trú"
                value={createEmployeeData.address || ''}
                onChange={(e) =>
                  setCreateEmployeeData({ ...createEmployeeData, address: e.target.value })
                }
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
              disabled={createEmployeeMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createEmployeeMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createEmployeeMutation.isPending ? 'Đang tạo...' : 'Lưu nhân viên'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* MODAL: EDIT EMPLOYEE */}
      <Dialog
        open={!!editingEmployee}
        onOpenChange={(open) => !open && setEditingEmployee(null)}
        className="max-h-[90vh] overflow-y-auto"
      >
        {editingEmployee && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground">
                Cập nhật thông tin nhân viên
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Điều chỉnh thông tin hồ sơ và trạng thái tài khoản của {editingEmployee.fullName}
              </DialogDescription>
            </DialogHeader>

            {editEmployeeError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{editEmployeeError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                updateEmployeeMutation.mutate({
                  id: editingEmployee.id,
                  data: editEmployeeData,
                })
              }}
              className="mt-4 space-y-3.5"
            >
              <div>
                <label className="text-xs font-medium text-foreground">Họ và tên</label>
                <Input
                  type="text"
                  value={editEmployeeData.fullName || ''}
                  onChange={(e) =>
                    setEditEmployeeData({ ...editEmployeeData, fullName: e.target.value })
                  }
                  required
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground">Vị trí công việc</label>
                  <select
                    aria-label="Chọn vị trí công việc"
                    value={editEmployeeData.positionId || ''}
                    onChange={(e) =>
                      setEditEmployeeData({ ...editEmployeeData, positionId: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-border bg-card p-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
                  >
                    <option value="">-- Chưa xếp vị trí --</option>
                    {positionsDropdown.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground">Trạng thái làm việc</label>
                  <select
                    aria-label="Trạng thái làm việc"
                    value={editEmployeeData.isActive ? 'true' : 'false'}
                    onChange={(e) =>
                      setEditEmployeeData({
                        ...editEmployeeData,
                        isActive: e.target.value === 'true',
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-border bg-card p-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
                  >
                    <option value="true">Đang làm việc (Hoạt động)</option>
                    <option value="false">Tạm khóa tài khoản</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground">Số điện thoại</label>
                  <Input
                    type="tel"
                    value={editEmployeeData.phoneNumber || ''}
                    onChange={(e) =>
                      setEditEmployeeData({ ...editEmployeeData, phoneNumber: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground">
                    Đổi mật khẩu mới (Tùy chọn)
                  </label>
                  <Input
                    type="password"
                    placeholder="Để trống nếu không đổi"
                    value={editEmployeeData.password || ''}
                    onChange={(e) =>
                      setEditEmployeeData({
                        ...editEmployeeData,
                        password: e.target.value || undefined,
                      })
                    }
                    className="mt-1"
                  />
                </div>
              </div>

              <DialogFooter className="mt-6 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingEmployee(null)}
                  disabled={updateEmployeeMutation.isPending}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={updateEmployeeMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {updateEmployeeMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </Dialog>

      {/* MODAL: ASSIGN ROLES TO EMPLOYEE */}
      <Dialog
        open={!!roleAssignEmployee}
        onOpenChange={(open) => !open && setRoleAssignEmployee(null)}
      >
        {roleAssignEmployee && (
          <>
            <DialogHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 mb-2">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Phân vai trò: {roleAssignEmployee.fullName}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Chọn các vai trò phân quyền áp dụng cho tài khoản này
              </DialogDescription>
            </DialogHeader>

            {roleAssignError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{roleAssignError}</span>
              </div>
            )}

            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto pr-1">
              {roles.map((role) => {
                const isChecked = selectedRoleIds.includes(role.id)

                return (
                  <label
                    key={role.id}
                    className="flex items-start gap-3 rounded-xl border border-border/80 p-3 hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRoleIds([...selectedRoleIds, role.id])
                        } else {
                          setSelectedRoleIds(selectedRoleIds.filter((id) => id !== role.id))
                        }
                      }}
                      className="rounded border-border text-blue-600 focus:ring-blue-500 mt-0.5"
                    />
                    <div className="flex-1 text-xs">
                      <div className="font-semibold text-foreground">{role.name}</div>
                      <div className="text-muted-foreground">{role.description || '—'}</div>
                    </div>
                  </label>
                )
              })}
            </div>

            <DialogFooter className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRoleAssignEmployee(null)}
                disabled={replaceRolesMutation.isPending}
              >
                Hủy
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  replaceRolesMutation.mutate({
                    id: roleAssignEmployee.id,
                    roleIds: selectedRoleIds,
                  })
                }}
                disabled={replaceRolesMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {replaceRolesMutation.isPending ? 'Đang lưu...' : 'Lưu vai trò'}
              </Button>
            </DialogFooter>
          </>
        )}
      </Dialog>

      {/* MODAL: DELETE EMPLOYEE CONFIRM */}
      <Dialog
        open={!!deletingEmployee}
        onOpenChange={(open) => !open && setDeletingEmployee(null)}
      >
        {deletingEmployee && (
          <>
            <DialogHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive mb-2">
                <Trash2 className="h-5 w-5" />
              </div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Xác nhận xóa nhân viên
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Bạn có chắc chắn muốn xóa nhân viên{' '}
                <span className="font-semibold text-foreground">
                  {deletingEmployee.fullName}
                </span>{' '}
                (@{deletingEmployee.username})? Toàn bộ phiên đăng nhập của nhân viên này sẽ bị thu
                hồi ngay lập tức.
              </DialogDescription>
            </DialogHeader>

            {deleteEmployeeError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{deleteEmployeeError}</span>
              </div>
            )}

            <DialogFooter className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeletingEmployee(null)}
                disabled={deleteEmployeeMutation.isPending}
              >
                Hủy
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => deleteEmployeeMutation.mutate(deletingEmployee.id)}
                disabled={deleteEmployeeMutation.isPending}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                {deleteEmployeeMutation.isPending ? 'Đang xóa...' : 'Xác nhận xóa'}
              </Button>
            </DialogFooter>
          </>
        )}
      </Dialog>
    </div>
  )
}
