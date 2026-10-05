import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import { CalendarDays, Plus, RefreshCw, Sparkles } from 'lucide-react'
import {
  getReservations,
  getReservationRequests,
  type Reservation,
  type ReservationStatus,
  type ReservationRequestStatus,
} from './reservations.api'
import { reservationDayBounds } from './reservation-time'
import { getDiningTables } from '../pos/pos.api'
import { posKeys } from '../pos/pos.keys'
import { errorMessage } from '../../shared/api/client'
import type { Session } from '../auth/session'
import { Button } from '../../shared/ui'
import { ReservationsTab } from './components/reservations-tab'
import { RequestsTab } from './components/requests-tab'
import {
  CreateReservationModal,
  EditReservationModal,
  ReservationCommandModal,
  type ReservationCommand,
} from './components/reservation-modals'

export default function StaffReservationsPage() {
  const client = useQueryClient()
  const session = useOutletContext<Session>()
  const employeeId = session.employee.id
  const permissions = session.authorization.permissionKeys
  const canCreate = permissions.includes('/reservations_create')
  const canUpdate = permissions.includes('/reservations_update')
  const canCancel = permissions.includes('/reservations_cancel')
  const canCheckIn = permissions.includes('/reservations_check-in')
  const canReadTables = permissions.includes('/dining-tables_read')
  const canReadPos = permissions.includes('/orders_sessions_read')
  const [activeTab, setActiveTab] = useState<'reservations' | 'requests'>('reservations')
  const [resPage, setResPage] = useState(1)
  const [resStatus, setResStatus] = useState<ReservationStatus | 'ALL'>('ALL')
  const [resTableId, setResTableId] = useState('ALL')
  const [resSearchPhone, setResSearchPhone] = useState('')
  const [phoneFilter, setPhoneFilter] = useState('')
  const [dateFilter, setDateFilter] = useState<'today' | 'tomorrow' | 'all'>('today')
  const [now, setNow] = useState(() => new Date())
  const [reqPage, setReqPage] = useState(1)
  const [reqStatus, setReqStatus] = useState<ReservationRequestStatus | 'ALL'>('PENDING')
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Reservation | null>(null)
  const [command, setCommand] = useState<ReservationCommand | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (resSearchPhone.trim() === phoneFilter) return
    const timer = window.setTimeout(() => {
      setPhoneFilter(resSearchPhone.trim())
      setResPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [resSearchPhone, phoneFilter])
  const { startsFrom, startsTo } =
    dateFilter === 'all'
      ? { startsFrom: undefined, startsTo: undefined }
      : reservationDayBounds(dateFilter === 'tomorrow' ? 1 : 0, now)
  const tables = useQuery({
    queryKey: posKeys.tables(employeeId),
    queryFn: ({ signal }) => getDiningTables(signal),
    enabled: canReadTables && activeTab === 'reservations',
    staleTime: 30_000,
  })
  const reservations = useQuery({
    queryKey: [
      'private',
      employeeId,
      'reservations',
      resPage,
      resStatus,
      resTableId,
      phoneFilter,
      startsFrom,
      startsTo,
    ],
    queryFn: ({ signal }) =>
      getReservations(
        {
          page: resPage,
          itemPerPage: 15,
          status: resStatus === 'ALL' ? undefined : resStatus,
          tableId: resTableId === 'ALL' ? undefined : resTableId,
          phoneNumber: phoneFilter || undefined,
          startsFrom,
          startsTo,
        },
        signal,
      ),
    enabled: activeTab === 'reservations',
    staleTime: 15_000,
  })
  const requests = useQuery({
    queryKey: ['private', employeeId, 'reservation-requests', reqPage, reqStatus],
    queryFn: ({ signal }) =>
      getReservationRequests({ page: reqPage, itemPerPage: 15, status: reqStatus }, signal),
    enabled: activeTab === 'requests',
    staleTime: 15_000,
  })
  function invalidate() {
    void client.invalidateQueries({ queryKey: ['private', employeeId, 'reservations'] })
    void client.invalidateQueries({ queryKey: ['private', employeeId, 'reservation-requests'] })
  }
  function invalidateCheckIn() {
    invalidate()
    void client.invalidateQueries({ queryKey: ['private', 'dining-tables-admin'] })
    void client.invalidateQueries({ queryKey: posKeys.tables(employeeId) })
    void client.invalidateQueries({ queryKey: posKeys.sessions(employeeId) })
  }
  const modalProps = { employeeId, canReadTables, onSettled: invalidate }
  const activeQuery = activeTab === 'reservations' ? reservations : requests
  const canRunCommand =
    command?.kind === 'approve'
      ? canCreate
      : command?.kind === 'reject'
        ? canUpdate
        : command?.kind === 'cancel'
          ? canCancel
          : canCheckIn

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <CalendarDays size={24} />
          Quản lý Đặt bàn
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={activeQuery.isFetching}
            onClick={() => {
              setNow(new Date())
              void activeQuery.refetch()
            }}
          >
            <RefreshCw size={16} />
            Làm mới
          </Button>
          {canCreate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={16} />
              Tạo đặt bàn mới
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap border-b border-border">
        <Button
          variant="ghost"
          aria-pressed={activeTab === 'reservations'}
          onClick={() => setActiveTab('reservations')}
          className={activeTab === 'reservations' ? 'border-b-2 border-primary rounded-none' : ''}
        >
          <CalendarDays size={16} />
          Lịch đặt bàn tại quán
        </Button>
        <Button
          variant="ghost"
          aria-pressed={activeTab === 'requests'}
          onClick={() => setActiveTab('requests')}
          className={activeTab === 'requests' ? 'border-b-2 border-primary rounded-none' : ''}
        >
          <Sparkles size={16} />
          Yêu cầu từ khách online
        </Button>
      </div>
      {activeQuery.isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-md border border-destructive p-3 text-sm"
        >
          <p>{errorMessage(activeQuery.error)}</p>
          <Button variant="outline" size="sm" onClick={() => void activeQuery.refetch()}>
            <RefreshCw size={16} />
            Tải lại danh sách
          </Button>
        </div>
      )}
      {activeTab === 'reservations' && canReadTables && tables.isError && (
        <div role="alert" className="text-sm text-destructive">
          Không tải được danh sách bàn.{' '}
          <Button variant="outline" size="sm" onClick={() => void tables.refetch()}>
            <RefreshCw size={16} />
            Tải lại bàn
          </Button>
        </div>
      )}
      {activeTab === 'reservations' && (
        <ReservationsTab
          reservationsData={reservations.data}
          isLoading={reservations.isPending}
          tables={tables.data ?? []}
          hasError={reservations.isError}
          canReadTables={canReadTables && tables.isSuccess}
          canReadPos={canReadPos}
          dateFilter={dateFilter}
          onDateFilterChange={(value) => {
            setDateFilter(value)
            setResPage(1)
          }}
          resStatus={resStatus}
          onResStatusChange={setResStatus}
          resTableId={resTableId}
          onResTableIdChange={setResTableId}
          resSearchPhone={resSearchPhone}
          onResSearchPhoneChange={setResSearchPhone}
          resPage={resPage}
          onResPageChange={setResPage}
          canCreate={canCreate}
          canUpdate={canUpdate}
          canCancel={canCancel}
          canCheckIn={canCheckIn}
          onCheckInClick={(reservation) => setCommand({ kind: 'check-in', reservation })}
          onCreateClick={() => setCreateOpen(true)}
          onEditClick={setEditTarget}
          onCancelClick={(reservation) => setCommand({ kind: 'cancel', reservation })}
        />
      )}
      {activeTab === 'requests' && (
        <RequestsTab
          requestsData={requests.data}
          isLoading={requests.isPending}
          hasError={requests.isError}
          reqStatus={reqStatus}
          onReqStatusChange={setReqStatus}
          reqPage={reqPage}
          onReqPageChange={setReqPage}
          canCreate={canCreate}
          canUpdate={canUpdate}
          onApproveClick={(request) => setCommand({ kind: 'approve', request })}
          onRejectClick={(request) => setCommand({ kind: 'reject', request })}
        />
      )}
      <CreateReservationModal
        {...modalProps}
        open={canCreate && createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => setCreateOpen(false)}
      />
      <EditReservationModal
        {...modalProps}
        reservation={canUpdate ? editTarget : null}
        onClose={() => setEditTarget(null)}
        onSuccess={() => setEditTarget(null)}
      />
      {command && canRunCommand && (
        <ReservationCommandModal
          key={`${command.kind}-${'request' in command ? command.request.id : command.reservation.id}`}
          {...modalProps}
          target={command}
          onSettled={command.kind === 'check-in' ? invalidateCheckIn : invalidate}
          canReadPos={canReadPos}
          onClose={() => setCommand(null)}
          onSuccess={() => setCommand(null)}
        />
      )}
    </div>
  )
}
