import { useState } from 'react'
import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { Clock, Plus, Printer, Receipt, RefreshCw } from 'lucide-react'
import { type Session } from '@/features/auth/session'
import { errorMessage } from '@/shared/api/client'
import { printingApi, type PrintDevice } from './printing.api'
import { Button } from '@/shared/ui'
import { PrintDevicesTab } from './components/print-devices-tab'
import { PrintJobsTab } from './components/print-jobs-tab'
import { ReprintReceiptTab } from './components/reprint-receipt-tab'

const EMPTY_DEVICES: PrintDevice[] = []

export function PrintingPage() {
  const { authorization } = useOutletContext<Session>()
  const client = useQueryClient()
  const can = (key: string) => authorization.permissionKeys.includes(key)
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
    queryKey: ['print-devices', 'active-options'],
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
      queryKey: activeTab === 'DEVICES' ? ['print-devices'] : ['print-jobs'],
    }) > 0

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Printer className="h-5 w-5 shrink-0" />
          Quản trị Thiết bị In & Lệnh in
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing}
            onClick={() => {
              void client.invalidateQueries({
                queryKey:
                  activeTab === 'DEVICES' ? ['print-devices'] : ['print-jobs'],
              })
              if (canReadDevices && activeTab !== 'DEVICES') {
                void client.invalidateQueries({
                  queryKey: ['print-devices', 'active-options'],
                })
              }
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Làm mới
          </Button>
          {canManageDevices && (
            <Button
              size="sm"
              onClick={() => {
                setSelectedTab('DEVICES')
                setIsCreateOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              Thêm máy in
            </Button>
          )}
        </div>
      </header>
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant={activeTab === id ? 'secondary' : 'ghost'}
            onClick={() => setSelectedTab(id)}
          >
            <Icon className="h-4 w-4" />
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

export default PrintingPage
