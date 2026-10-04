import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, ShieldCheck, Lock, AlertCircle } from 'lucide-react'
import {
  getRolePermissions,
  replaceRolePermissions,
  getPermissions,
  type Role,
  type Permission,
} from '@/features/employees/employees.api'
import { errorMessage } from '@/shared/api/client'
import {
  Button,
  Badge,
  Card,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui'

export interface RolesTabProps {
  roles: Role[]
  isLoadingRoles: boolean
  canManagePermissions: boolean
  onToast: (msg: string) => void
}

export function RolesTab({
  roles,
  isLoadingRoles,
  canManagePermissions,
  onToast,
}: RolesTabProps) {
  const queryClient = useQueryClient()

  const [managingRole, setManagingRole] = useState<Role | null>(null)
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([])
  const [rolePermissionError, setRolePermissionError] = useState<string | null>(null)

  const { data: allPermissionsData } = useQuery({
    queryKey: ['private', 'permissions'],
    queryFn: ({ signal }) => getPermissions({ page: 1, itemPerPage: 200 }, signal),
    enabled: canManagePermissions && !!managingRole,
  })

  const invalidateQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ['private', 'roles'] })
  }

  const saveRolePermissionsMutation = useMutation({
    mutationFn: async () => {
      if (!managingRole) return
      return replaceRolePermissions(managingRole.id, selectedPermissionIds)
    },
    onSuccess: () => {
      invalidateQueries()
      onToast('Đã cập nhật danh sách quyền cho vai trò')
      setManagingRole(null)
      setSelectedPermissionIds([])
      setRolePermissionError(null)
    },
    onError: (err) => setRolePermissionError(errorMessage(err)),
  })

  const handleOpenRolePermissions = async (role: Role) => {
    setManagingRole(role)
    setRolePermissionError(null)
    try {
      const res = await getRolePermissions(role.id)
      const currentPermIds = res.rolePermissions?.map((rp) => rp.permission.id) ?? []
      setSelectedPermissionIds(currentPermIds)
    } catch {
      setSelectedPermissionIds([])
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoadingRoles ? (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            Đang tải danh sách vai trò...
          </div>
        ) : (
          roles.map((role) => (
            <Card key={role.id} className="border border-border/80 p-5 shadow-xs">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-semibold text-base text-foreground">{role.name}</h3>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {role.description || 'Không có mô tả chi tiết'}
                  </p>
                </div>
                {role.isSystemRole && (
                  <Badge variant="outline" className="border-border text-[10px]">
                    Hệ thống
                  </Badge>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-mono">
                  ID: {role.id.slice(0, 8)}
                </span>
                {canManagePermissions && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleOpenRolePermissions(role)}
                    className="text-xs h-7 px-2.5 gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50 dark:text-blue-300 dark:border-blue-800"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Phân quyền
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* MODAL: ROLE PERMISSIONS CHECKLIST */}
      <Dialog
        open={!!managingRole}
        onOpenChange={(open) => !open && setManagingRole(null)}
        maxWidth="lg"
        className="max-h-[85vh] flex flex-col"
      >
        {managingRole && (
          <>
            <DialogHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 mb-2">
                <Lock className="h-5 w-5" />
              </div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Phân quyền vai trò: {managingRole.name}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Cấp quyền truy cập các module chức năng hệ thống cho vai trò này
              </DialogDescription>
            </DialogHeader>

            {rolePermissionError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{rolePermissionError}</span>
              </div>
            )}

            <div className="mt-4 flex-1 overflow-y-auto pr-1 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {allPermissionsData?.list?.map((perm: Permission) => {
                  const isChecked = selectedPermissionIds.includes(perm.id)

                  return (
                    <label
                      key={perm.id}
                      className="flex items-start gap-2.5 rounded-lg border border-border/70 p-2.5 hover:bg-muted/40 cursor-pointer text-xs transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPermissionIds([...selectedPermissionIds, perm.id])
                          } else {
                            setSelectedPermissionIds(
                              selectedPermissionIds.filter((id) => id !== perm.id),
                            )
                          }
                        }}
                        className="rounded border-border text-blue-600 focus:ring-blue-500 mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-foreground">{perm.name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {perm.key}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            <DialogFooter className="mt-6 flex justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setManagingRole(null)}
                disabled={saveRolePermissionsMutation.isPending}
              >
                Hủy
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => saveRolePermissionsMutation.mutate()}
                disabled={saveRolePermissionsMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {saveRolePermissionsMutation.isPending ? 'Đang lưu...' : 'Lưu danh sách quyền'}
              </Button>
            </DialogFooter>
          </>
        )}
      </Dialog>
    </div>
  )
}
