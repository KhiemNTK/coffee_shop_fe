import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import {
  Cpu,
  Sliders,
  AlertTriangle,
  Plus,
  RefreshCw,
  CheckCircle2,
  Wrench,
} from 'lucide-react'
import { settingsApi } from '@/features/settings/settings.api'
import type { Session } from '@/features/auth/session'
import { Button, Badge } from '@/shared/ui'
import { EquipmentTab } from './components/equipment-tab'
import { SystemSettingsTab } from './components/system-settings-tab'
import { ManagementExceptionsTab } from './components/management-exceptions-tab'

export function SettingsPage() {
  const queryClient = useQueryClient()
  const { authorization } = useOutletContext<Session>()
  const permissions = authorization.permissionKeys

  // Permissions check
  const canReadEquipment = permissions.includes('/equipment_read')
  const canCreateEquipment = permissions.includes('/equipment_create')
  const canUpdateEquipment = permissions.includes('/equipment_update')
  const canTransitionEquipment = permissions.includes('/equipment_transition')

  const canReadSettings = permissions.includes('/system-settings_read')
  const canCreateSettings = permissions.includes('/system-settings_create')
  const canUpdateSettings = permissions.includes('/system-settings_update')
  const canDeleteSettings = permissions.includes('/system-settings_delete')

  const canReadExceptions = permissions.includes('/management-exceptions_read')

  // Active Tab
  const [activeTab, setActiveTab] = useState<'equipment' | 'settings' | 'exceptions'>(() => {
    if (canReadEquipment) return 'equipment'
    if (canReadSettings) return 'settings'
    return 'exceptions'
  })

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Modals state for header create buttons
  const [isCreateEquipmentOpen, setIsCreateEquipmentOpen] = useState(false)
  const [isCreateSettingOpen, setIsCreateSettingOpen] = useState(false)

  // Lightweight queries for Tab Badges
  const { data: equipmentSummaryData, refetch: refetchEquipment } = useQuery({
    queryKey: ['equipment-list', 'summary-badge'],
    queryFn: ({ signal }) => settingsApi.getEquipment({ itemPerPage: 1 }, signal),
    enabled: canReadEquipment,
  })

  const { data: settingsSummaryData, refetch: refetchSettings } = useQuery({
    queryKey: ['system-settings-list', 'summary-badge'],
    queryFn: ({ signal }) => settingsApi.getSystemSettings({ itemPerPage: 1 }, signal),
    enabled: canReadSettings,
  })

  const { data: exceptionsSummaryData, refetch: refetchExceptions } = useQuery({
    queryKey: ['management-exceptions-summary'],
    queryFn: ({ signal }) => settingsApi.getManagementExceptionsSummary(signal),
    enabled: canReadExceptions,
  })

  const handleRefresh = () => {
    if (activeTab === 'equipment') {
      void refetchEquipment()
      void queryClient.invalidateQueries({ queryKey: ['equipment-list'] })
    }
    if (activeTab === 'settings') {
      void refetchSettings()
      void queryClient.invalidateQueries({ queryKey: ['system-settings-list'] })
    }
    if (activeTab === 'exceptions') {
      void refetchExceptions()
      void queryClient.invalidateQueries({ queryKey: ['management-exceptions-list'] })
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Cpu className="h-6 w-6 text-primary" />
            Cài đặt & Thiết bị Hệ thống
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quản trị máy móc thiết bị quán, cấu hình tham số vận hành và hàng đợi ngoại lệ
          </p>
        </div>

        {/* Action Buttons depending on Tab */}
        <div className="flex items-center gap-2">
          {activeTab === 'equipment' && canCreateEquipment && (
            <Button
              size="sm"
              onClick={() => setIsCreateEquipmentOpen(true)}
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Thêm thiết bị mới
            </Button>
          )}

          {activeTab === 'settings' && canCreateSettings && (
            <Button
              size="sm"
              onClick={() => setIsCreateSettingOpen(true)}
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Tạo cấu hình mới
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            title="Làm mới dữ liệu"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Toast notification */}
      {toastMessage && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {canReadEquipment && (
          <button
            type="button"
            onClick={() => setActiveTab('equipment')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === 'equipment'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Wrench className="h-4 w-4" />
            Trang thiết bị & Máy móc
            <Badge
              variant="outline"
              className={
                activeTab === 'equipment'
                  ? 'border-primary-foreground/30 text-primary-foreground'
                  : ''
              }
            >
              {equipmentSummaryData?.totalItems ?? 0}
            </Badge>
          </button>
        )}

        {canReadSettings && (
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Sliders className="h-4 w-4" />
            Cấu hình Tham số Quán
            <Badge
              variant="outline"
              className={
                activeTab === 'settings'
                  ? 'border-primary-foreground/30 text-primary-foreground'
                  : ''
              }
            >
              {settingsSummaryData?.totalItems ?? 0}
            </Badge>
          </button>
        )}

        {canReadExceptions && (
          <button
            type="button"
            onClick={() => setActiveTab('exceptions')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === 'exceptions'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Hàng đợi Ngoại lệ Quản trị
            {Boolean(exceptionsSummaryData?.total) && (
              <Badge variant="destructive" className="animate-pulse">
                {exceptionsSummaryData?.total}
              </Badge>
            )}
          </button>
        )}
      </div>

      {/* Tab Panels */}
      {activeTab === 'equipment' && (
        <EquipmentTab
          canCreate={canCreateEquipment}
          canUpdate={canUpdateEquipment}
          canTransition={canTransitionEquipment}
          onToast={(msg) => setToastMessage(msg)}
          isCreateOpen={isCreateEquipmentOpen}
          setIsCreateOpen={setIsCreateEquipmentOpen}
        />
      )}

      {activeTab === 'settings' && (
        <SystemSettingsTab
          canUpdate={canUpdateSettings}
          canDelete={canDeleteSettings}
          onToast={(msg) => setToastMessage(msg)}
          isCreateOpen={isCreateSettingOpen}
          setIsCreateOpen={setIsCreateSettingOpen}
        />
      )}

      {activeTab === 'exceptions' && (
        <ManagementExceptionsTab summary={exceptionsSummaryData} />
      )}
    </div>
  )
}
