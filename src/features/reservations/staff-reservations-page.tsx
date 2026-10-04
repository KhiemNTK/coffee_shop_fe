import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'
import {
  CalendarDays,
  Plus,
  RefreshCw,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import {
  getReservations,
  getReservationRequests,
  checkInReservation,
  type Reservation,
  type ReservationRequest,
  type ReservationStatus,
  type ReservationRequestStatus,
  type CheckInResult,
} from './reservations.api'
import { getDiningTables } from '../pos/pos.api'
import { errorMessage } from '../../shared/api/client'
import type { Session } from '../auth/session'
import { Button } from '../../shared/ui'
import { ReservationsTab } from './components/reservations-tab'
import { RequestsTab } from './components/requests-tab'
import {
  CreateReservationModal,
  EditReservationModal,
  ApproveRequestModal,
  RejectRequestModal,
  CancelReservationModal,
  CheckInSuccessModal,
} from './components/reservation-modals'

export default function StaffReservationsPage() {
  const queryClient = useQueryClient()
  const session = useOutletContext<Session | undefined>()
  const permissions = session?.authorization.permissionKeys ?? []

  const canCreate = permissions.includes('/reservations_create')
  const canUpdate = permissions.includes('/reservations_update')
  const canCancel = permissions.includes('/reservations_cancel')
  const canCheckIn = permissions.includes('/reservations_check-in')

  const [activeTab, setActiveTab] = useState<'reservations' | 'requests'>('reservations')

  // Filters for Reservations tab
  const [resPage, setResPage] = useState(1)
  const [resStatus, setResStatus] = useState<ReservationStatus | 'ALL'>('ALL')
  const [resTableId, setResTableId] = useState<string>('ALL')
  const [resSearchPhone, setResSearchPhone] = useState('')
  const [dateFilter, setDateFilter] = useState<'today' | 'tomorrow' | 'all'>('today')

  // Filters for Requests tab
  const [reqPage, setReqPage] = useState(1)
  const [reqStatus, setReqStatus] = useState<ReservationRequestStatus | 'ALL'>('PENDING')

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editReservation, setEditReservation] = useState<Reservation | null>(null)
  const [cancelReservationTarget, setCancelReservationTarget] = useState<Reservation | null>(null)
  const [approveRequestTarget, setApproveRequestTarget] = useState<ReservationRequest | null>(null)
  const [rejectRequestTarget, setRejectRequestTarget] = useState<ReservationRequest | null>(null)
  const [checkInSuccess, setCheckInSuccess] = useState<CheckInResult | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [now] = useState(() => new Date())
  // Calculate startsFrom / startsTo based on dateFilter
  const { startsFrom, startsTo } = useMemo(() => {
    if (dateFilter === 'all') return { startsFrom: undefined, startsTo: undefined }
    if (dateFilter === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      return { startsFrom: start.toISOString(), startsTo: end.toISOString() }
    }
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59, 999)
    return { startsFrom: start.toISOString(), startsTo: end.toISOString() }
  }, [dateFilter, now])

  // Fetch dining tables for selection
  const { data: tables = [] } = useQuery({
    queryKey: ['private', 'dining-tables'],
    queryFn: ({ signal }) => getDiningTables(signal),
    staleTime: 60_000,
  })

  // Query: Reservations
  const {
    data: reservationsData,
    isLoading: isLoadingReservations,
    refetch: refetchReservations,
  } = useQuery({
    queryKey: [
      'private',
      'reservations',
      resPage,
      resStatus,
      resTableId,
      resSearchPhone,
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
          phoneNumber: resSearchPhone.trim() || undefined,
          startsFrom,
          startsTo,
        },
        signal,
      ),
    staleTime: 15_000,
  })

  // Query: Public requests
  const {
    data: requestsData,
    isLoading: isLoadingRequests,
    refetch: refetchRequests,
  } = useQuery({
    queryKey: ['private', 'reservation-requests', reqPage, reqStatus],
    queryFn: ({ signal }) =>
      getReservationRequests(
        {
          page: reqPage,
          itemPerPage: 15,
          status: reqStatus === 'ALL' ? undefined : reqStatus,
        },
        signal,
      ),
    staleTime: 15_000,
  })

  // Mutation: Check in
  const checkInMutation = useMutation({
    mutationFn: (id: number) => checkInReservation(id),
    onSuccess: (data) => {
      setActionError(null)
      void queryClient.invalidateQueries({ queryKey: ['private', 'reservations'] })
      void queryClient.invalidateQueries({ queryKey: ['private', 'dining-tables'] })
      setCheckInSuccess(data)
    },
    onError: (err) => {
      setActionError(errorMessage(err))
    },
  })

  const requestsList = requestsData?.list ?? []
  const pendingRequestsCount =
    requestsList.filter((r) => r.status === 'PENDING').length || 0

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <CalendarDays className="h-6 w-6" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Quản lý Đặt bàn
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Tiếp nhận yêu cầu trực tuyến, điều phối sơ đồ bàn và đón khách vào phiên phục vụ POS.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void refetchReservations()
              void refetchRequests()
            }}
            className="gap-1.5"
          >
            <RefreshCw className="h-4 w-4" />
            Làm mới
          </Button>
          {canCreate && (
            <Button
              size="sm"
              onClick={() => setCreateModalOpen(true)}
              className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              <Plus className="h-4 w-4" />
              Tạo đặt bàn mới
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-600 hover:underline font-medium text-xs"
          >
            Bỏ qua
          </button>
        </div>
      )}

      {/* Tabs navigation */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('reservations')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'reservations'
              ? 'border-emerald-700 text-emerald-800 bg-emerald-50/50'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <CalendarDays className="h-4 w-4" />
          Lịch đặt bàn tại quán
          {reservationsData?.totalItems ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {reservationsData.totalItems}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'requests'
              ? 'border-emerald-700 text-emerald-800 bg-emerald-50/50'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Yêu cầu từ khách online
          {pendingRequestsCount > 0 ? (
            <span className="rounded-full bg-amber-500 text-white px-2 py-0.5 text-xs font-bold animate-pulse">
              {pendingRequestsCount} mới
            </span>
          ) : null}
        </button>
      </div>

      {/* TAB 1: RESERVATIONS LIST */}
      {activeTab === 'reservations' && (
        <ReservationsTab
          reservationsData={reservationsData}
          isLoading={isLoadingReservations}
          tables={tables}
          dateFilter={dateFilter}
          onDateFilterChange={setDateFilter}
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
          checkInMutation={checkInMutation}
          onCreateClick={() => setCreateModalOpen(true)}
          onEditClick={setEditReservation}
          onCancelClick={setCancelReservationTarget}
        />
      )}

      {/* TAB 2: ONLINE REQUESTS LIST */}
      {activeTab === 'requests' && (
        <RequestsTab
          requestsData={requestsData}
          isLoading={isLoadingRequests}
          reqStatus={reqStatus}
          onReqStatusChange={setReqStatus}
          reqPage={reqPage}
          onReqPageChange={setReqPage}
          canCreate={canCreate}
          onApproveClick={setApproveRequestTarget}
          onRejectClick={setRejectRequestTarget}
        />
      )}

      {/* MODALS */}
      <CreateReservationModal
        open={createModalOpen}
        tables={tables}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          setCreateModalOpen(false)
          void queryClient.invalidateQueries({ queryKey: ['private', 'reservations'] })
        }}
      />

      <EditReservationModal
        reservation={editReservation}
        tables={tables}
        onClose={() => setEditReservation(null)}
        onSuccess={() => {
          setEditReservation(null)
          void queryClient.invalidateQueries({ queryKey: ['private', 'reservations'] })
        }}
      />

      <ApproveRequestModal
        request={approveRequestTarget}
        tables={tables}
        onClose={() => setApproveRequestTarget(null)}
        onSuccess={() => {
          setApproveRequestTarget(null)
          void queryClient.invalidateQueries({
            queryKey: ['private', 'reservation-requests'],
          })
          void queryClient.invalidateQueries({ queryKey: ['private', 'reservations'] })
        }}
      />

      <RejectRequestModal
        request={rejectRequestTarget}
        onClose={() => setRejectRequestTarget(null)}
        onSuccess={() => {
          setRejectRequestTarget(null)
          void queryClient.invalidateQueries({
            queryKey: ['private', 'reservation-requests'],
          })
        }}
      />

      <CancelReservationModal
        reservation={cancelReservationTarget}
        onClose={() => setCancelReservationTarget(null)}
        onSuccess={() => {
          setCancelReservationTarget(null)
          void queryClient.invalidateQueries({ queryKey: ['private', 'reservations'] })
        }}
      />

      <CheckInSuccessModal
        checkInSuccess={checkInSuccess}
        onClose={() => setCheckInSuccess(null)}
      />
    </div>
  )
}
