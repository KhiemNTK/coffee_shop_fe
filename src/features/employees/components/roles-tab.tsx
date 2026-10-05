import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { Pencil, Plus, ShieldCheck, Trash2, RefreshCw } from 'lucide-react'
import {
  deleteRole,
  getAllPermissions,
  getRolePermissions,
  replaceRolePermissions,
  saveRole,
  type Role,
} from '../employees.api'
import type { Session } from '../../auth/session'
import { errorMessage } from '@/shared/api/client'
import { Button, Badge, Dialog, Input } from '@/shared/ui'

export function RolesTab({
  roles,
  isLoadingRoles,
  canManagePermissions,
  onToast,
}: {
  roles: Role[]
  isLoadingRoles: boolean
  canManagePermissions: boolean
  onToast: (message: string) => void
}) {
  const { authorization } = useOutletContext<Session>()
  const can = (key: string) => authorization.permissionKeys.includes(key)
  const client = useQueryClient()
  const [permissionsFor, setPermissionsFor] = useState<Role | null>(null)
  const [editing, setEditing] = useState<Role | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Role | null>(null)
  const remove = useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => {
      setDeleting(null)
      onToast('Đã xóa vai trò')
      void client.invalidateQueries({ queryKey: ['private'] })
    },
  })
  return (
    <section className="space-y-4">
      {can('/roles_create') && (
        <Button onClick={() => setEditing('new')}>
          <Plus size={16} />
          Thêm vai trò
        </Button>
      )}
      {isLoadingRoles ? (
        <p role="status">Đang tải vai trò...</p>
      ) : roles.length === 0 ? (
        <p>Chưa có vai trò.</p>
      ) : (
        <div className="divide-y border-y">
          {roles.map((role) => (
            <div
              key={role.id}
              className="flex flex-wrap items-center justify-between gap-3 py-4"
            >
              <div className="min-w-0">
                <h3 className="break-words font-semibold">{role.name}</h3>
                <p className="break-words text-sm text-muted-foreground">
                  {role.description}
                </p>
                {role.isSystemRole && <Badge variant="outline">Hệ thống</Badge>}
              </div>
              {!role.isSystemRole && (
                <div className="flex flex-wrap gap-2">
                  {canManagePermissions && can('/permissions_read') && (
                    <Button
                      variant="outline"
                      onClick={() => setPermissionsFor(role)}
                    >
                      <ShieldCheck size={16} />
                      Phân quyền
                    </Button>
                  )}
                  {can('/roles_update') && (
                    <Button
                      variant="outline"
                      aria-label={'Sửa vai trò ' + role.name}
                      title="Sửa vai trò"
                      onClick={() => setEditing(role)}
                    >
                      <Pencil size={16} />
                    </Button>
                  )}
                  {can('/roles_delete') && (
                    <Button
                      variant="outline"
                      aria-label={'Xóa vai trò ' + role.name}
                      title="Xóa vai trò"
                      onClick={() => {
                        setDeleting(role)
                        remove.reset()
                      }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {permissionsFor && (
        <RolePermissions
          key={permissionsFor.id}
          role={permissionsFor}
          onClose={() => setPermissionsFor(null)}
          onToast={onToast}
        />
      )}
      {editing && (
        <RoleForm
          key={editing === 'new' ? 'new' : editing.id}
          role={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onToast={onToast}
        />
      )}
      {deleting && (
        <Dialog
          open
          onClose={() => {
            if (!remove.isPending) setDeleting(null)
          }}
        >
          <h2 className="pr-8 text-lg font-semibold">
            Xóa vai trò {deleting.name}?
          </h2>
          <p className="my-3 text-sm">
            Xóa vai trò sẽ gỡ toàn bộ quyền của vai trò và gỡ vai trò này khỏi
            tất cả nhân viên đang được gán.
          </p>
          {remove.isError && <p role="alert">{errorMessage(remove.error)}</p>}
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate(deleting.id)}
          >
            <Trash2 size={16} />
            Xác nhận xóa
          </Button>
        </Dialog>
      )}
    </section>
  )
}

function RoleForm({
  role,
  onClose,
  onToast,
}: {
  role?: Role
  onClose: () => void
  onToast: (message: string) => void
}) {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: (data: { name: string; description: string }) =>
      saveRole(role?.id, data),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['private', 'roles'] })
      onToast('Đã lưu vai trò')
      onClose()
    },
  })
  return (
    <Dialog
      open
      onClose={() => {
        if (!mutation.isPending) onClose()
      }}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (mutation.isPending) return
          const data = new FormData(event.currentTarget)
          mutation.mutate({
            name: String(data.get('name')).trim(),
            description: String(data.get('description')).trim(),
          })
        }}
      >
        <h2 className="pr-8 text-lg font-semibold">
          {role ? 'Sửa vai trò' : 'Thêm vai trò'}
        </h2>
        <fieldset disabled={mutation.isPending} className="space-y-3">
          <label className="block">
            Tên vai trò
            <Input
              name="name"
              defaultValue={role?.name}
              required
              maxLength={100}
            />
          </label>
          <label className="block">
            Mô tả
            <Input
              name="description"
              defaultValue={role?.description ?? ''}
              maxLength={500}
            />
          </label>
        </fieldset>
        {mutation.isError && <p role="alert">{errorMessage(mutation.error)}</p>}
        <Button type="submit" disabled={mutation.isPending}>
          Lưu vai trò
        </Button>
      </form>
    </Dialog>
  )
}

function RolePermissions({
  role,
  onClose,
  onToast,
}: {
  role: Role
  onClose: () => void
  onToast: (message: string) => void
}) {
  const { employee } = useOutletContext<Session>()
  const client = useQueryClient()
  const flight = useRef(false)
  const [selected, setSelected] = useState<string[] | null>(null)
  const query = useQuery({
    queryKey: ['private', employee.id, 'role-permissions', role.id],
    queryFn: ({ signal }) => getRolePermissions(role.id, signal),
    retry: false,
    refetchOnWindowFocus: false,
  })
  const catalog = useQuery({
    queryKey: ['private', employee.id, 'permissions'],
    queryFn: ({ signal }) => getAllPermissions(signal),
    retry: false,
  })
  const ids =
    selected ??
    query.data?.rolePermissions?.map((item) => item.permission.id) ??
    []
  const ready =
    query.isSuccess &&
    catalog.isSuccess &&
    !query.isFetching &&
    !catalog.isFetching
  const mutation = useMutation({
    mutationFn: (permissionIds: string[]) =>
      replaceRolePermissions(role.id, permissionIds),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['private'] })
      onToast('Đã cập nhật danh sách quyền cho vai trò')
      onClose()
    },
    onSettled: () => {
      flight.current = false
    },
  })
  return (
    <Dialog
      open
      maxWidth="lg"
      onClose={() => {
        if (!mutation.isPending) onClose()
      }}
    >
      <h2 className="pr-8 text-lg font-semibold">
        Phân quyền vai trò: {role.name}
      </h2>
      {(query.isPending || catalog.isPending) && (
        <p role="status">Đang tải quyền hiện tại...</p>
      )}
      {(query.isError || catalog.isError) && (
        <div role="alert" className="space-y-2 py-3">
          <p>{errorMessage(query.error || catalog.error)}</p>
          <Button
            variant="outline"
            onClick={() => {
              void query.refetch()
              void catalog.refetch()
            }}
          >
            <RefreshCw size={16} />
            Thử tải lại
          </Button>
        </div>
      )}
      <fieldset
        disabled={!ready || mutation.isPending}
        className="my-4 grid max-h-80 grid-cols-1 gap-2 overflow-auto sm:grid-cols-2"
      >
        {catalog.data?.map((permission) => (
          <label
            key={permission.id}
            className="flex min-w-0 items-start gap-2 border-b py-2 text-sm"
          >
            <input
              type="checkbox"
              checked={ids.includes(permission.id)}
              onChange={(event) =>
                setSelected(
                  event.target.checked
                    ? [...ids, permission.id]
                    : ids.filter((id) => id !== permission.id),
                )
              }
            />
            <span className="min-w-0 break-words">
              {permission.name}
              <span className="block break-all text-xs text-muted-foreground">
                {permission.key}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      {mutation.isError && <p role="alert">{errorMessage(mutation.error)}</p>}
      <Button
        disabled={!ready || mutation.isPending}
        onClick={() => {
          if (!ready || flight.current) return
          if (
            !ids.length &&
            !window.confirm('Thu hồi toàn bộ quyền của vai trò này?')
          )
            return
          flight.current = true
          mutation.mutate(ids)
        }}
      >
        Lưu danh sách quyền
      </Button>
    </Dialog>
  )
}
