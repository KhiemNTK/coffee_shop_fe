import { AlertCircle, ShieldCheck, RefreshCw } from 'lucide-react'
import type { EmployeeListItem, Role } from '@/features/employees/employees.api'
import { errorMessage } from '@/shared/api/client'
import {
  Button,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui'

export interface RoleAssignmentData {
  canManageRoles: boolean
  assignableRoleIds: string[]
  employeeRoles: Array<{ role: Role }>
}

export interface AssignRolesModalProps {
  employee: EmployeeListItem | null
  onClose: () => void
  roles: Role[]
  rolesLoaded: boolean
  roleIds: string[]
  setSelectedRoleIds: (ids: string[]) => void
  assignment: {
    isPending: boolean
    isError: boolean
    error: unknown
    isSuccess: boolean
    isFetching: boolean
    refetch: () => Promise<unknown>
    data?: RoleAssignmentData
  }
  assignmentReady: boolean
  roleAssignError: string | null
  roleReviewRequired: boolean
  onReconcile: () => Promise<void>
  isPending: boolean
  onSubmit: (roleIds: string[]) => void
}

export function AssignRolesModal({
  employee,
  onClose,
  roles,
  rolesLoaded,
  roleIds,
  setSelectedRoleIds,
  assignment,
  assignmentReady,
  roleAssignError,
  roleReviewRequired,
  onReconcile,
  isPending,
  onSubmit,
}: AssignRolesModalProps) {
  const handleSave = () => {
    if (!assignmentReady || isPending || !assignment.data) return

    const previousIds = assignment.data.employeeRoles.map(
      (entry) => entry.role.id,
    )
    if (
      roles.some(
        (role) =>
          role.isSystemRole &&
          role.name === 'OWNER' &&
          previousIds.includes(role.id) !== roleIds.includes(role.id),
      ) &&
      !window.confirm('Thay đổi quyền chủ sở hữu của tài khoản này?')
    ) {
      return
    }

    if (
      !roleIds.length &&
      !window.confirm('Thu hồi toàn bộ vai trò của nhân viên này?')
    ) {
      return
    }

    onSubmit(roleIds)
  }

  return (
    <Dialog
      open={!!employee}
      onOpenChange={(open) => {
        if (!open && !isPending) onClose()
      }}
    >
      {employee && (
        <>
          <DialogHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 mb-2">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              Phân vai trò: {employee.fullName}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Chọn các vai trò phân quyền áp dụng cho tài khoản này
            </DialogDescription>
          </DialogHeader>

          {roleAssignError && (
            <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{roleAssignError}</span>
            </div>
          )}

          {assignment.isPending && (
            <p role="status">Đang tải vai trò hiện tại...</p>
          )}
          {assignment.isError && (
            <div role="alert">
              <p>{errorMessage(assignment.error)}</p>
              <Button
                variant="outline"
                onClick={() => void assignment.refetch()}
              >
                Thử tải lại
              </Button>
            </div>
          )}
          {!rolesLoaded && (
            <p role="alert">Danh sách vai trò chưa tải thành công.</p>
          )}
          {assignment.isSuccess && !assignment.data?.canManageRoles && (
            <p role="status" className="mt-3 text-sm text-muted-foreground">
              Không được thay đổi vai trò của tài khoản này.
            </p>
          )}
          {roleReviewRequired && (
            <Button
              variant="outline"
              disabled={assignment.isFetching}
              onClick={() => void onReconcile()}
            >
              <RefreshCw size={16} /> Đối chiếu vai trò
            </Button>
          )}
          <fieldset
            disabled={!assignmentReady || isPending}
            className="mt-4 space-y-2 max-h-60 overflow-y-auto pr-1"
          >
            {roles.map((role) => {
              const isChecked = roleIds.includes(role.id)

              return (
                <label
                  key={role.id}
                  className="flex items-start gap-3 rounded-xl border border-border/80 p-3 hover:bg-muted/40 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={
                      !assignment.data?.assignableRoleIds.includes(role.id)
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRoleIds([...roleIds, role.id])
                      } else {
                        setSelectedRoleIds(
                          roleIds.filter((id) => id !== role.id),
                        )
                      }
                    }}
                    className="rounded border-border text-blue-600 focus:ring-blue-500 mt-0.5"
                  />
                  <div className="flex-1 text-xs">
                    <div className="font-semibold text-foreground">
                      {role.name}
                    </div>
                    <div className="text-muted-foreground">
                      {role.description || '—'}
                    </div>
                    {assignment.isSuccess &&
                      !assignment.data?.assignableRoleIds.includes(role.id) && (
                        <span className="text-muted-foreground">
                          Ngoài phạm vi được cấp
                        </span>
                      )}
                  </div>
                </label>
              )
            })}
          </fieldset>

          <DialogFooter className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isPending}
            >
              Hủy
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={!assignmentReady || isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isPending ? 'Đang lưu...' : 'Lưu vai trò'}
            </Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  )
}
