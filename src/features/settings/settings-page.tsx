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
import { operationsApi } from '../operations/operations.api'
import { errorMessage } from '@/shared/api/client'
import type { Session } from '@/features/auth/session'
import { Button, Badge, cn } from '@/shared/ui'
import { EquipmentTab } from './components/equipment-tab'
import { SystemSettingsTab } from './components/system-settings-tab'
import { ManagementExceptionsTab } from '../operations/exception-queue'

export function SettingsPage() {
  const queryClient = useQueryClient()
  const { employee, access } = useOutletContext<Session>()


  // Permissions check
  const canReadEquipment = access.has('/equipment_read')
  const canCreateEquipment = access.has('/equipment_create')
  const canUpdateEquipment = access.has('/equipment_update')
  const canTransitionEquipment = access.has('/equipment_transition')

  const canReadSettings = access.has('/system-settings_read')
  const canCreateSettings = access.has('/system-settings_create')
  const canUpdateSettings = access.has('/system-settings_update')
  const canDeleteSettings = access.has('/system-settings_delete')

  const canReadExceptions = access.has('/management-exceptions_read')

  // Active Tab
  const tabs = [
    { id: 'equipment', allowed: canReadEquipment },
    { id: 'settings', allowed: canReadSettings },
    { id: 'exceptions', allowed: canReadExceptions },
  ] as const
  const [selectedTab, setActiveTab] = useState<(typeof tabs)[number]['id']>('equipment')
  const activeTab = tabs.find((tab) => tab.id === selectedTab && tab.allowed)?.id
    ?? tabs.find((tab) => tab.allowed)?.id

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)
  function showToast(message: string, tone: 'success' | 'error' = 'success') {
    setToast({ message, tone })
  }

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

  const { data: exceptionsSummaryData, isError: exceptionsSummaryError, error: exceptionsError, refetch: refetchExceptions } = useQuery({
    queryKey: ['management-exceptions-summary', employee.id],
    queryFn: ({ signal }) => operationsApi.getManagementExceptionsSummary(signal),
    enabled: canReadExceptions && activeTab === 'exceptions',
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
      {toast && (
        <div role={toast.tone === 'error' ? 'alert' : 'status'} className={cn('flex items-center justify-between gap-2 rounded-lg border px-4 py-3 text-sm shadow-xs',
          toast.tone === 'error' ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300')}>
          <div className="flex items-center gap-2">
            {toast.tone === 'error' ? <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />}
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
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
      {activeTab === 'equipment' && canReadEquipment && (
        <EquipmentTab
          canCreate={canCreateEquipment}
          canUpdate={canUpdateEquipment}
          canTransition={canTransitionEquipment}
          onToast={showToast}
          isCreateOpen={canCreateEquipment && isCreateEquipmentOpen}
          setIsCreateOpen={setIsCreateEquipmentOpen}
        />
      )}

      {activeTab === 'settings' && canReadSettings && (
        <SystemSettingsTab
          canUpdate={canUpdateSettings}
          canDelete={canDeleteSettings}
          onToast={showToast}
          isCreateOpen={canCreateSettings && isCreateSettingOpen}
          setIsCreateOpen={setIsCreateSettingOpen}
        />
      )}

      {activeTab === 'exceptions' && canReadExceptions && <>
        {exceptionsSummaryError && <p role="alert">{errorMessage(exceptionsError)}</p>}
        <ManagementExceptionsTab summary={exceptionsSummaryError ? undefined : exceptionsSummaryData} />
      </>}
    </div>
  )
}
