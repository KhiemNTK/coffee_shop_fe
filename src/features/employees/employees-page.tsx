import { useState } from 'react'
import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import {
  Users,
  Briefcase,
  Shield,
  Plus,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react'
import {
  getEmployees,
  getPositionsDropdown,
  getAllRoles,
} from '@/features/employees/employees.api'
import type { Session } from '@/features/auth/session'
import { Button, Badge } from '@/shared/ui'
import { EmployeesListTab } from './components/employees-list-tab'
import { PositionsTab } from './components/positions-tab'
import { RolesTab } from './components/roles-tab'
import { errorMessage } from '../../shared/api/client'

export function EmployeesPage() {
  const client = useQueryClient()
  const { authorization } = useOutletContext<Session>()
  const permissions = authorization.permissionKeys

  // Permissions check
  const canReadEmployees = permissions.includes('/employees_read')
  const canCreateEmployee = permissions.includes('/employees_create')
  const canUpdateEmployee = permissions.includes('/employees_update')
  const canDeleteEmployee = permissions.includes('/employees_delete')
  const canManageEmployeeRoles =
    permissions.includes('/employees_roles_read') &&
    permissions.includes('/employees_roles_update') &&
    permissions.includes('/roles_read')

  const canReadPositions = permissions.includes('/positions_read')
  const canCreatePosition = permissions.includes('/positions_create')
  const canUpdatePosition = permissions.includes('/positions_update')
  const canDeletePosition = permissions.includes('/positions_delete')

  const canReadRoles = permissions.includes('/roles_read')
  const canManageRolePermissions =
    permissions.includes('/roles_permissions_read') &&
    permissions.includes('/roles_permissions_update')

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    'employees' | 'positions' | 'roles'
  >(canReadEmployees ? 'employees' : canReadPositions ? 'positions' : 'roles')

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Modals state for header buttons
  const [isCreateEmployeeOpen, setIsCreateEmployeeOpen] = useState(false)
  const [isCreatePositionOpen, setIsCreatePositionOpen] = useState(false)

  // Queries
  const { data: employeesData } = useQuery({
    queryKey: ['private', 'employees', 'total'],
    queryFn: ({ signal }) => getEmployees({ page: 1, itemPerPage: 1 }, signal),
    enabled: canReadEmployees,
  })

  const { data: positionsDropdown = [] } = useQuery({
    queryKey: ['private', 'positions-dropdown'],
    queryFn: ({ signal }) => getPositionsDropdown(signal),
    enabled: canReadPositions,
  })

  const {
    data: rolesData,
    isLoading: isLoadingRoles,
    error: rolesError,
    refetch: refetchRoles,
  } = useQuery({
    queryKey: ['private', 'roles'],
    queryFn: ({ signal }) => getAllRoles(signal),
    enabled: canReadRoles,
  })

  const stats = {
    total: employeesData?.totalItems ?? '—',
    positionsCount: positionsDropdown.length,
  }

  const handleRefresh = () => {
    void client.invalidateQueries({ queryKey: ['private', activeTab] })
    if (canReadPositions && activeTab !== 'roles') {
      void client.invalidateQueries({
        queryKey: ['private', 'positions-dropdown'],
      })
    }
  }
  const refreshing = useIsFetching({ queryKey: ['private', activeTab] }) > 0

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8 w-full">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Quản lý Nhân sự & Phân quyền
              </h1>
              <p className="text-sm text-muted-foreground">
                Hồ sơ nhân viên, chức danh vị trí công việc và ma trận phân
                quyền bảo mật
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Làm mới"
            title="Làm mới"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Làm mới</span>
          </Button>

          {activeTab === 'employees' && canCreateEmployee && (
            <Button
              onClick={() => setIsCreateEmployeeOpen(true)}
              size="sm"
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm nhân viên</span>
            </Button>
          )}

          {activeTab === 'positions' && canCreatePosition && (
            <Button
              onClick={() => setIsCreatePositionOpen(true)}
              size="sm"
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm vị trí mới</span>
            </Button>
          )}
        </div>
      </div>

      {rolesError && canReadRoles && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(rolesError)}{' '}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetchRoles()}
          >
            Thử tải vai trò
          </Button>
        </p>
      )}
      {/* Tabs Navigation */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('employees')}
          disabled={!canReadEmployees}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === 'employees'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Danh sách Nhân sự</span>
          <Badge variant="outline" className="ml-1 text-[11px] px-1.5 py-0">
            {stats.total}
          </Badge>
        </button>

        {canReadPositions && (
          <button
            type="button"
            onClick={() => setActiveTab('positions')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === 'positions'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Briefcase className="h-4 w-4" />
            <span>Vị trí Công việc</span>
            <Badge variant="outline" className="ml-1 text-[11px] px-1.5 py-0">
              {stats.positionsCount}
            </Badge>
          </button>
        )}

        {canReadRoles && (
          <button
            type="button"
            onClick={() => setActiveTab('roles')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === 'roles'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Shield className="h-4 w-4" />
            <span>Vai trò & Quyền hạn</span>
          </button>
        )}
      </div>

      {/* Tab Panels */}
      {activeTab === 'employees' && canReadEmployees && (
        <EmployeesListTab
          positionsDropdown={positionsDropdown}
          roles={rolesData ?? []}
          rolesLoaded={Boolean(rolesData) && !isLoadingRoles}
          canCreate={canCreateEmployee}
          canUpdate={canUpdateEmployee}
          canDelete={canDeleteEmployee}
          canManageRoles={canManageEmployeeRoles}
          onToast={(msg) => setToastMessage(msg)}
          isCreateOpen={isCreateEmployeeOpen}
          setIsCreateOpen={setIsCreateEmployeeOpen}
        />
      )}

      {activeTab === 'positions' && (
        <PositionsTab
          canUpdate={canUpdatePosition}
          canDelete={canDeletePosition}
          onToast={(msg) => setToastMessage(msg)}
          isCreateOpen={isCreatePositionOpen}
          setIsCreateOpen={setIsCreatePositionOpen}
        />
      )}

      {activeTab === 'roles' && (
        <RolesTab
          roles={rolesData ?? []}
          isLoadingRoles={isLoadingRoles}
          canManagePermissions={canManageRolePermissions}
          onToast={(msg) => setToastMessage(msg)}
        />
      )}
    </div>
  )
}
