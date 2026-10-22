import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { Clock, Plus, Printer, Receipt, RefreshCw } from 'lucide-react'
import { type Session } from '@/features/auth/session'
import { errorMessage } from '@/shared/api/client'
import { printingApi, printingKeys, type PrintDevice } from './printing.api'
import { Button } from '@/shared/ui'
import { PrintDevicesTab } from './components/print-devices-tab'
import { PrintJobsTab } from './components/print-jobs-tab'
import { ReprintReceiptTab } from './components/reprint-receipt-tab'

const EMPTY_DEVICES: PrintDevice[] = []

export function PrintingPage() {
  useTranslation()
  const { employee, access } = useOutletContext<Session>()
  const client = useQueryClient()
  const can = access.has
  const canReadDevices = can('/print-devices_read')
  const canReadJobs = can('/print-jobs_read')
  const canManageDevices = canReadDevices && can('/print-devices_manage')
  const canManageJobs = canReadJobs && can('/print-jobs_manage')
  const canReprint = can('/receipts_reprint')

  const tabs = [
    {
      id: 'DEVICES',
      label: 'Danh sách Máy in',
      icon: Printer,
      allowed: canReadDevices,
    },
    {
      id: 'JOBS',
      label: 'Hàng đợi Lệnh in',
      icon: Clock,
      allowed: canReadJobs,
    },
    {
      id: 'REPRINT',
      label: 'In lại Hóa đơn',
      icon: Receipt,
      allowed: canReprint,
    },
  ].filter((tab) => tab.allowed)

  const [selectedTab, setSelectedTab] = useState(tabs[0]?.id)
  const activeTab =
    tabs.find((tab) => tab.id === selectedTab)?.id ?? tabs[0]?.id
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const options = useQuery({
    queryKey: [...printingKeys.devices(employee.id), 'active-options'],
    queryFn: ({ signal }) => printingApi.getActiveDevices(signal),
    enabled:
      canReadDevices &&
      ((activeTab === 'JOBS' && canManageJobs) ||
        (activeTab === 'REPRINT' && canReprint)),
  })

  const devices = canReadDevices
    ? (options.data ?? EMPTY_DEVICES)
    : EMPTY_DEVICES

  const refreshing =
    useIsFetching({
      queryKey: activeTab === 'DEVICES' ? printingKeys.devices(employee.id) : printingKeys.jobs(employee.id),
    }) > 0

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
            <Printer className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Quản trị Thiết bị In &amp; Lệnh in
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Quản lý máy in, theo dõi trạng thái kết nối và hàng đợi lệnh in từ hệ thống POS
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing}
            onClick={() => {
              void client.invalidateQueries({
                queryKey:
                  activeTab === 'DEVICES' ? printingKeys.devices(employee.id) : printingKeys.jobs(employee.id),
              })
              if (canReadDevices && activeTab !== 'DEVICES') {
                void client.invalidateQueries({
                  queryKey: [...printingKeys.devices(employee.id), 'active-options'],
                })
              }
            }}
            className="gap-1.5 text-xs h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>

          {canManageDevices && (
            <Button
              size="sm"
              onClick={() => {
                setSelectedTab('DEVICES')
                setIsCreateOpen(true)
              }}
              className="gap-1.5 bg-[#08634e] hover:bg-[#074b3d] text-white text-xs h-9 font-semibold shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm máy in
            </Button>
          )}
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border/70 pb-2.5">
        {tabs.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant={activeTab === id ? 'secondary' : 'ghost'}
            onClick={() => setSelectedTab(id)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold shadow-xs transition-all h-9 ${
              activeTab === id
                ? 'bg-[#062F29] text-white hover:bg-[#062F29] hover:text-white'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <Icon className="h-4 w-4 mr-1.5" />
            {label}
          </Button>
        ))}
      </div>

      {canReadDevices && activeTab !== 'DEVICES' && options.isError && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(options.error)}{' '}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void options.refetch()}
          >
            Thử tải máy in
          </Button>
        </p>
      )}

      {activeTab === 'DEVICES' && canReadDevices && (
        <PrintDevicesTab
          canManageDevices={canManageDevices}
          isCreateOpen={isCreateOpen}
          setIsCreateOpen={setIsCreateOpen}
        />
      )}

      {activeTab === 'JOBS' && canReadJobs && (
        <PrintJobsTab canManageJobs={canManageJobs} devices={devices} />
      )}

      {activeTab === 'REPRINT' && canReprint && (
        <ReprintReceiptTab devices={devices} />
      )}
    </div>
  )
}
