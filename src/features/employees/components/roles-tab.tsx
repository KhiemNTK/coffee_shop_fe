import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { Copy, Pencil, Plus, ShieldCheck, Trash2, RefreshCw } from 'lucide-react'
import {
  deleteRole,
  getAllPermissions,
  getRolePermissions,
  getRoleById,
  replaceRolePermissions,
  saveRole,
  type Role,
} from '../employees.api'
import { sessionKey, type Session } from '../../auth/session'
import { errorMessage } from '@/shared/api/client'
import { Button, Badge, Dialog, Input } from '@/shared/ui'
import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog'
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
  const { t } = useTranslation()
  const { access } = useOutletContext<Session>()
  const can = access.has
  const canCopy = can('/roles_create') && can('/roles_read') &&
    can('/roles_permissions_read') && can('/roles_permissions_update')
  const client = useQueryClient()
  const [permissionsFor, setPermissionsFor] = useState<Role | null>(null)
  const [editing, setEditing] = useState<Role | 'new' | null>(null)
  const [template, setTemplate] = useState<Role | undefined>()
  const [deleting, setDeleting] = useState<Role | null>(null)
  const remove = useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => {
      setDeleting(null)
      onToast(t("roles.deleted"))
      void client.invalidateQueries({ queryKey: ['private'] })
    },
  })
  return (
    <section className="space-y-4">
      {can('/roles_create') && (
        <Button onClick={() => {
          setTemplate(undefined)
          setEditing('new')
        }}>
          <Plus size={16} />
          {t("roles.add")}
        </Button>
      )}
      {isLoadingRoles ? (
        <p role="status">{t("roles.loading")}</p>
      ) : roles.length === 0 ? (
        <p>{t("roles.empty")}</p>
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
                {role.isSystemRole && <Badge variant="outline">{t("roles.system")}</Badge>}
              </div>
              <div className="flex flex-wrap gap-2">
                {canCopy && (
                  <Button
                    variant="outline"
                    aria-label={t('roles.copyLabel', { name: role.name })}
                    title={t('roles.copyLabel', { name: role.name })}
                    onClick={() => {
                      setTemplate(role)
                      setEditing('new')
                    }}
                  >
                    <Copy size={16} />
                  </Button>
                )}
                {can('/roles_permissions_read') && (
                  <Button
                    variant="outline"
                    onClick={() => setPermissionsFor(role)}
                  >
                    <ShieldCheck size={16} />
                    {canManagePermissions &&
                    can('/permissions_read') &&
                    !role.isSystemRole
                      ? t("roles.manage")
                      : t("roles.view")}
                  </Button>
                )}
                {!role.isSystemRole && can('/roles_update') && (
                  <Button
                    variant="outline"
                    aria-label={t('roles.edit') + ' ' + role.name}
                    title={t("roles.edit")}
                    onClick={() => {
                      setTemplate(undefined)
                      setEditing(role)
                    }}
                  >
                    <Pencil size={16} />
                  </Button>
                )}
                {!role.isSystemRole && can('/roles_delete') && (
                  <Button
                    variant="outline"
                    aria-label={t('roles.delete') + ' ' + role.name}
                    title={t("roles.delete")}
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
      {permissionsFor && can('/roles_permissions_read') && (
        <RolePermissions
          key={permissionsFor.id}
          role={permissionsFor}
          onClose={() => setPermissionsFor(null)}
          onToast={onToast}
        />
      )}
      {editing && can(editing === 'new' ? '/roles_create' : '/roles_update') && (!template || canCopy) && (
        <RoleEditor
          key={template?.id ?? (editing === 'new' ? 'new' : editing.id)}
          role={editing === 'new' ? undefined : editing}
          template={template}
          onClose={() => setEditing(null)}
          onToast={onToast}
        />
      )}
      {deleting && can('/roles_delete') && (
        <Dialog
          open
          onClose={() => {
            if (!remove.isPending) setDeleting(null)
          }}
        >
          <h2 className="pr-8 text-lg font-semibold">
            {t("roles.delete")} {deleting.name}?
          </h2>
          <p className="my-3 text-sm">
            {t('roles.deleteWarning')}
          </p>
          {remove.isError && <p role="alert">{errorMessage(remove.error)}</p>}
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate(deleting.id)}
          >
            <Trash2 size={16} />
            {t("roles.confirmDelete")}
          </Button>
        </Dialog>
      )}
    </section>
  )
}

function RoleEditor(props: { role?: Role; template?: Role; onClose: () => void; onToast: (message: string) => void }) {
  return props.role ? <RoleEditLoader {...props} role={props.role} /> : <RoleForm {...props} />
}

function RoleEditLoader(props: { role: Role; onClose: () => void; onToast: (message: string) => void }) {
  const { employee } = useOutletContext<Session>()
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['private', employee.id, 'role-detail', props.role.id],
    queryFn: ({ signal }) => getRoleById(props.role.id, signal),
    staleTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false,
  })
  if (!query.isSuccess || query.isFetching) return <Dialog open onClose={props.onClose}>
    <h2 className="pr-8 text-lg font-semibold">{t('roles.edit')}</h2>
    {query.isFetching ? <p role="status">{t('common.loading')}</p> : <>
      <p role="alert">{errorMessage(query.error)}</p>
      <Button variant="outline" onClick={() => void query.refetch()}>{t('common.retry')}</Button>
    </>}
  </Dialog>
  return <RoleForm key={query.data.updatedAt} {...props} role={query.data} onReload={() => void query.refetch()} />
}

function RoleForm({
  role,
  template,
  onClose,
  onToast,
  onReload,
}: {
  role?: Role
  template?: Role
  onClose: () => void
  onToast: (message: string) => void
  onReload?: () => void
}) {
  const { t } = useTranslation()
  const { employee, authorization } = useOutletContext<Session>()
  const client = useQueryClient()
  const source = useQuery({
    queryKey: ['private', employee.id, 'role-permissions', template?.id],
    queryFn: ({ signal }) => getRolePermissions(template!.id, signal),
    enabled: !!template,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const [reviewRequired, setReviewRequired] = useState(false)
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? template?.description ?? '')
  const dirty = name.trim() !== (role?.name ?? '') || description.trim() !== (role?.description ?? template?.description ?? '')
  const grants = new Set(authorization.permissionKeys)
  const withinScope = source.data?.rolePermissions.every(({ permission }) => grants.has(permission.key))
  const ready = !reviewRequired && (!role || Boolean(role.updatedAt)) &&
    (!template || (source.isSuccess && !source.isFetching && withinScope))
  const mutation = useMutation({
    mutationFn: (data: { name?: string; description?: string | null }) =>
      saveRole(role?.id, {
        ...data,
        ...(role ? { expectedUpdatedAt: role.updatedAt } : {}),
        ...(template ? {
          templateRoleId: template.id,
          expectedPermissionIds: source.data!.rolePermissions.map(({ permission }) => permission.id),
        } : {}),
      }),
    onError: () => {
      if (template || role) setReviewRequired(true)
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['private'] })
      onToast(t("roles.saved"))
      onClose()
    },
  })
  return (
    <UnsavedChangesDialog
      open
      dirty={dirty}
      blocked={mutation.isPending}
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (mutation.isPending || !ready) return
          if (role && !dirty) { onClose(); return }
          mutation.mutate(role ? {
            ...(name.trim() !== role.name ? { name: name.trim() } : {}),
            ...(description.trim() !== (role.description ?? '') ? { description: description.trim() || null } : {}),
          } : { name: name.trim(), description: description.trim() || null })
        }}
      >
        <h2 className="pr-8 text-lg font-semibold">
          {template ? t('roles.copyTitle', { name: template.name }) : role ? t("roles.edit") : t("roles.add")}
        </h2>
        <fieldset disabled={mutation.isPending} className="space-y-3">
          <label className="block">
            {t("roles.name")}
            <Input
              name="name"
              value={name}
              onChange={event => setName(event.target.value)}
              required
              maxLength={100}
            />
          </label>
          <label className="block">
            {t("roles.description")}
            <Input
              name="description"
              value={description}
              onChange={event => setDescription(event.target.value)}
              maxLength={500}
            />
          </label>
        </fieldset>
        {template && (
          <div className="space-y-2">
            {source.isFetching && <p role="status">{t('roles.loadingTemplate')}</p>}
            {source.isError && <p role="alert">{errorMessage(source.error)}</p>}
            {source.data && (
              <>
                <h3 className="text-sm font-semibold">{t('roles.copiedPermissions', { count: source.data.rolePermissions.length })}</h3>
                <ul className="max-h-48 space-y-1 overflow-y-auto text-sm" aria-label={t('roles.templatePermissions')}>
                  {source.data.rolePermissions.map(({ permission }) => (
                    <li key={permission.id}>{permissionLabel(permission)}</li>
                  ))}
                </ul>
                {!withinScope && <p role="alert">{t('roles.outsideScope')}</p>}
              </>
            )}
            {(source.isError || reviewRequired) && (
              <Button variant="outline" type="button" disabled={source.isFetching} onClick={async () => {
                const result = await source.refetch()
                if (result.isSuccess) {
                  setReviewRequired(false)
                  mutation.reset()
                }
              }}>
                <RefreshCw size={16} />
                {t('roles.reloadTemplate')}
              </Button>
            )}
          </div>
        )}
        {mutation.isError && <p role="alert">{errorMessage(mutation.error)}</p>}
        {role && reviewRequired && <Button type="button" variant="outline" onClick={onReload}>
          <RefreshCw size={16} /> {t('roles.reloadMetadata')}
        </Button>}
        <Button type="submit" disabled={mutation.isPending || !ready}>
          {t("roles.save")}
        </Button>
      </form>
    </UnsavedChangesDialog>
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
  const [baseline, setBaseline] = useState<string[] | null>(null)
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
  const originalIds = baseline ?? query.data?.rolePermissions.map(item => item.permission.id) ?? []
  const dirty = selected !== null && (ids.length !== originalIds.length || ids.some(id => !originalIds.includes(id)))
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
      onToast(t("roles.permissionsSaved"))
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
    <UnsavedChangesDialog
      open
      maxWidth="lg"
      dirty={dirty}
      blocked={mutation.isPending}
      onClose={onClose}
    >
      <h2 className="pr-8 text-lg font-semibold">
        {t("roles.permissionsTitle")} {role.name}
      </h2>
      {(query.isPending || (canReadCatalog && catalog.isPending)) && (
        <p role="status">{t("roles.permissionsLoading")}</p>
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
            {t("roles.retry")}
          </Button>
        </div>
      )}
      {query.isSuccess && !query.data.canManagePermissions && (
        <p role="status" className="my-3 text-sm text-muted-foreground">
          {t("roles.protected")}
        </p>
      )}
      <label className="my-3 block text-sm">
        {t("roles.search")}
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <p className="text-sm text-muted-foreground">
        {ids.length} {t("roles.selectedCount")}
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
                      setBaseline(previous => previous ?? query.data?.rolePermissions.map((entry) => entry.permission.id) ?? [])
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
                        {t("roles.sensitive")}
                      </Badge>
                    )}
                    {showKeys && <span className="block break-all text-xs text-muted-foreground">
                      {permission.key}
                    </span>}
                    {!granted.has(permission.key) && (
                      <span className="block text-xs text-muted-foreground">
                        {t("roles.outsideGrant")}
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
            <p className="text-sm">{t("roles.noMatch")}</p>
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
              setBaseline(null)
              setSelected(null)
              setReviewRequired(false)
              mutation.reset()
            }
          }}
        >
          <RefreshCw size={16} /> {t("roles.reconcile")}
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
              t('roles.confirmSensitive') + ' ' + role.name + '?',
            )
          )
            return
          if (
            !ids.length &&
            !window.confirm(t("roles.confirmRevoke"))
          )
            return
          flight.current = true
          mutation.mutate({
            permissionIds: ids,
            expectedPermissionIds: baseline ?? query.data?.rolePermissions.map((entry) => entry.permission.id) ?? [],
          })
        }}
      >
        {t("roles.savePermissions")}
      </Button>
    </UnsavedChangesDialog>
  )
}
