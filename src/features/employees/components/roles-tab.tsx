import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { sessionKey, type Session } from '../../auth/session'
import { errorMessage } from '@/shared/api/client'
import { Button, Badge, Dialog, Input } from '@/shared/ui'
import { groupPermissions, isSensitivePermission, permissionLabel } from '../permission-groups'

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
  const { access } = useOutletContext<Session>()
  const can = access.has
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
              <div className="flex flex-wrap gap-2">
                {can('/roles_permissions_read') && (
                  <Button
                    variant="outline"
                    onClick={() => setPermissionsFor(role)}
                  >
                    <ShieldCheck size={16} />
                    {canManagePermissions &&
                    can('/permissions_read') &&
                    !role.isSystemRole
                      ? 'Phân quyền'
                      : 'Xem quyền'}
                  </Button>
                )}
                {!role.isSystemRole && can('/roles_update') && (
                  <Button
                    variant="outline"
                    aria-label={'Sửa vai trò ' + role.name}
                    title="Sửa vai trò"
                    onClick={() => setEditing(role)}
                  >
                    <Pencil size={16} />
                  </Button>
                )}
                {!role.isSystemRole && can('/roles_delete') && (
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
  const { employee, authorization } = useOutletContext<Session>()
  const { t } = useTranslation()
  const client = useQueryClient()
  const flight = useRef(false)
  const baseline = useRef<string[] | null>(null)
  const [selected, setSelected] = useState<string[] | null>(null)
  const [search, setSearch] = useState('')
  const [showKeys, setShowKeys] = useState(false)
  const [reviewRequired, setReviewRequired] = useState(false)
  const granted = new Set(authorization.permissionKeys)
  const canReadCatalog = granted.has('/permissions_read')
  const query = useQuery({
    queryKey: ['private', employee.id, 'role-permissions', role.id],
    queryFn: ({ signal }) => getRolePermissions(role.id, signal),
    retry: false,
    refetchOnWindowFocus: false,
  })
  const catalog = useQuery({
    queryKey: ['private', employee.id, 'permissions'],
    queryFn: ({ signal }) => getAllPermissions(signal),
    enabled: canReadCatalog,
    retry: false,
  })
  const ids =
    selected ??
    query.data?.rolePermissions?.map((item) => item.permission.id) ??
    []
  const ready =
    canReadCatalog &&
    granted.has('/roles_permissions_update') &&
    query.isSuccess &&
    catalog.isSuccess &&
    !query.isFetching &&
    !catalog.isFetching &&
    query.data.canManagePermissions &&
    !reviewRequired
  const needle = search.trim().toLocaleLowerCase('vi')
  const grouped = groupPermissions(
    (canReadCatalog
      ? (catalog.data ?? [])
      : (query.data?.rolePermissions.map((entry) => entry.permission) ?? [])
    ).filter((permission) =>
      [permissionLabel(permission), permission.name, permission.key, permission.description ?? ''].some(
        (value) => value.toLocaleLowerCase('vi').includes(needle),
      ),
    ),
  )
  const mutation = useMutation({
    retry: false,
    mutationFn: ({ permissionIds, expectedPermissionIds }: { permissionIds: string[]; expectedPermissionIds: string[] }) =>
      replaceRolePermissions(role.id, permissionIds, expectedPermissionIds),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['private'] })
      onToast('Đã cập nhật danh sách quyền cho vai trò')
      onClose()
    },
    onSettled: () => {
      flight.current = false
    },
    onError: () => {
      setReviewRequired(true)
      void client.invalidateQueries({ queryKey: sessionKey })
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
        Quyền của vai trò: {role.name}
      </h2>
      {(query.isPending || (canReadCatalog && catalog.isPending)) && (
        <p role="status">Đang tải quyền hiện tại...</p>
      )}
      {(query.isError || (canReadCatalog && catalog.isError)) && (
        <div role="alert" className="space-y-2 py-3">
          <p>{errorMessage(query.error || catalog.error)}</p>
          <Button
            variant="outline"
            onClick={() => {
              void query.refetch()
              if (canReadCatalog) void catalog.refetch()
            }}
          >
            <RefreshCw size={16} />
            Thử tải lại
          </Button>
        </div>
      )}
      {query.isSuccess && !query.data.canManagePermissions && (
        <p role="status" className="my-3 text-sm text-muted-foreground">
          Không được thay đổi quyền của vai trò này.
        </p>
      )}
      <label className="my-3 block text-sm">
        Tìm quyền
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <p className="text-sm text-muted-foreground">
        {ids.length} quyền được chọn
      </p>
      <label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={showKeys} onChange={(event) => setShowKeys(event.target.checked)} />
        {t('permissions.showKeys')}
      </label>
      <div className="my-4 max-h-80 space-y-4 overflow-auto">
        {grouped.map(([label, permissions]) => (
          <fieldset
            key={label}
            disabled={!ready || mutation.isPending}
            className="min-w-0 border-0 p-0"
          >
            <legend className="mb-2 text-sm font-semibold">{label}</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {permissions.map((permission) => (
                <label
                  key={permission.id}
                  className="flex min-w-0 items-start gap-2 border-b py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={ids.includes(permission.id)}
                    disabled={!granted.has(permission.key)}
                    onChange={(event) => {
                      baseline.current ??= query.data?.rolePermissions.map((entry) => entry.permission.id) ?? []
                      setSelected(
                        event.target.checked
                          ? [...ids, permission.id]
                          : ids.filter((id) => id !== permission.id),
                      )
                    }}
                  />
                  <span className="min-w-0 break-words">
                    {permissionLabel(permission)}
                    {isSensitivePermission(permission.key) && (
                      <Badge variant="warning" className="ml-2">
                        Nhạy cảm
                      </Badge>
                    )}
                    {showKeys && <span className="block break-all text-xs text-muted-foreground">
                      {permission.key}
                    </span>}
                    {!granted.has(permission.key) && (
                      <span className="block text-xs text-muted-foreground">
                        Ngoài phạm vi được cấp
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        {(canReadCatalog ? catalog.isSuccess : query.isSuccess) &&
          grouped.length === 0 && (
            <p className="text-sm">Không có quyền phù hợp.</p>
          )}
      </div>
      {reviewRequired && (
        <Button
          variant="outline"
          disabled={query.isFetching || catalog.isFetching}
          onClick={async () => {
            const [current, permissions] = await Promise.all([
              query.refetch(),
              catalog.refetch(),
            ])
            if (current.isSuccess && permissions.isSuccess) {
              baseline.current = null
              setSelected(null)
              setReviewRequired(false)
              mutation.reset()
            }
          }}
        >
          <RefreshCw size={16} /> Đối chiếu quyền
        </Button>
      )}
      {mutation.isError && <p role="alert">{errorMessage(mutation.error)}</p>}
      <Button
        disabled={!ready || mutation.isPending}
        onClick={() => {
          if (!ready || flight.current) return
          const previousIds = new Set(
            query.data?.rolePermissions.map((entry) => entry.permission.id),
          )
          const changedSensitive = catalog.data?.some(
            (permission) =>
              isSensitivePermission(permission.key) &&
              previousIds.has(permission.id) !== ids.includes(permission.id),
          )
          if (
            changedSensitive &&
            !window.confirm(
              'Thay đổi quyền nhạy cảm cho vai trò ' + role.name + '?',
            )
          )
            return
          if (
            !ids.length &&
            !window.confirm('Thu hồi toàn bộ quyền của vai trò này?')
          )
            return
          flight.current = true
          mutation.mutate({
            permissionIds: ids,
            expectedPermissionIds: baseline.current ?? query.data?.rolePermissions.map((entry) => entry.permission.id) ?? [],
          })
        }}
      >
        Lưu danh sách quyền
      </Button>
    </Dialog>
  )
}
