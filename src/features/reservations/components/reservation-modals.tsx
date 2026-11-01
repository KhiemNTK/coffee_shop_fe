import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from '@tanstack/react-query'
import { LogIn, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  createReservation,
  updateReservation,
  cancelReservation,
  checkInReservation,
  approveReservationRequest,
  rejectReservationRequest,
  getReservationById,
  getReservationRequestById,
  type Reservation,
  type ReservationRequest,
  type CheckInResult,
  type UpdateReservationPayload,
} from '../reservations.api'
import {
  fromReservationLocal,
  toReservationLocal,
  formatReservationDateTime,
} from '../reservation-time'
import { ReservationTablePicker as TableSelect } from './reservation-table-picker'
import { tableAvailabilityKey, type ReservationWindow } from '../reservation-availability'
import { isValidPhone, normalizePhone } from '@/shared/lib/phone'
import { reservationStatusLabel } from '../reservation-status'
import { ApiError, errorMessage } from '../../../shared/api/client'
import { Button, Dialog, DialogFooter, DialogHeader, DialogTitle, Input } from '../../../shared/ui'

type ModalProps = {
  employeeId: string
  canReadTables: boolean
  onClose: () => void
  onSuccess: () => void
  onSettled: () => void
}

export function CreateReservationModal(props: ModalProps & { open: boolean }) {
  return props.open ? <ReservationEditor {...props} /> : null
}

export function EditReservationModal(props: ModalProps & { reservation: Reservation | null }) {
  return props.reservation ? (
    <EditReservationLoader key={props.reservation.id} {...props} reservation={props.reservation} />
  ) : null
}

function EditReservationLoader(props: ModalProps & { reservation: Reservation }) {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['private', props.employeeId, 'reservation-detail', props.reservation.id],
    queryFn: ({ signal }) => getReservationById(props.reservation.id, signal),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  if (!query.isSuccess || query.isFetching)
    return (
      <Dialog open onClose={props.onClose}>
        <DialogTitle>{t("reservation.editPrefix")}{props.reservation.id}</DialogTitle>
        {query.isFetching ? (
          <p role="status">{t("reservation.loadingSchedule")}</p>
        ) : (
          <>
            <p role="alert">{errorMessage(query.error)}</p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              <RefreshCw size={16} />
              {t("reservation.reloadSchedule")}
            </Button>
          </>
        )}
      </Dialog>
    )
  if (query.data.status !== 'PENDING')
    return (
      <Dialog open onClose={props.onClose}>
        <DialogTitle>{t("reservation.idPrefix")}{props.reservation.id}</DialogTitle>
        <p role="status">{t("reservation.changedPrefix")} {reservationStatusLabel(query.data.status)}{t("reservation.cannotEditSuffix")}</p>
      </Dialog>
    )
  return <ReservationEditor {...props} initial={query.data} onReload={() => void query.refetch()} />
}

function ReservationEditor({
  initial,
  onReload,
  ...props
}: ModalProps & { initial?: Reservation; onReload?: () => void }) {
  const { t } = useTranslation()
  const id = useId()
  const errorRef = useRef<HTMLParagraphElement>(null)
  const [customerName, setCustomerName] = useState(initial?.customerName ?? '')
  const [phoneNumber, setPhoneNumber] = useState(initial?.phoneNumber ?? '')
  const [tableId, setTableId] = useState(initial?.tableId ?? '')
  const [guestCount, setGuestCount] = useState(initial?.guestCount ?? 2)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [startsAt, setStartsAt] = useState(() =>
    toReservationLocal(initial ? new Date(initial.startsAt) : new Date(Date.now() + 30 * 60_000)),
  )
  const [endsAt, setEndsAt] = useState(() =>
    toReservationLocal(initial ? new Date(initial.endsAt) : new Date(Date.now() + 150 * 60_000)),
  )
  const [validation, setValidation] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [confirmedTable, setConfirmedTable] = useState<string | null>(null)
  const [openedAt] = useState(() => Date.now())
  let window: ReservationWindow | null = null
  try {
    const start = fromReservationLocal(startsAt), end = fromReservationLocal(endsAt)
    const duration = end.getTime() - start.getTime()
    if (duration >= 15 * 60_000 && duration <= 8 * 3_600_000 && end.getTime() > openedAt)
      window = { startsAt: start.toISOString(), endsAt: end.toISOString() }
  } catch { /* A partial date must not start an availability request. */ }
  const expectedTable = tableAvailabilityKey(window, tableId, initial?.id)
  const tableReady = expectedTable !== null && confirmedTable === expectedTable
  const mutation = useMutation({
    mutationFn: (payload: UpdateReservationPayload) =>
      initial
        ? updateReservation(initial.id, payload)
        : createReservation({
            phoneNumber: normalizePhone(phoneNumber),
            tableId,
            guestCount,
            startsAt: fromReservationLocal(startsAt).toISOString(),
            endsAt: fromReservationLocal(endsAt).toISOString(),
            customerName: customerName.trim() || undefined,
            notes: notes.trim() || undefined,
          }),
    retry: false,
    onSuccess: props.onSuccess,
    onSettled: props.onSettled,
    onError: (error) => {
      setBlocked(!(error instanceof ApiError) || error.status >= 500 || error.status === 409)
      requestAnimationFrame(() => errorRef.current?.focus())
    },
  })
  return (
    <Dialog
      open
      onClose={() => {
        if (!mutation.isPending) props.onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>
          {initial
            ? t('reservation.editPrefix') + initial.id
            : t("reservation.createAtCounter")}
        </DialogTitle>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (mutation.isPending || blocked || !tableReady) return
          let start: Date, end: Date
          try {
            start = fromReservationLocal(startsAt)
            end = fromReservationLocal(endsAt)
          } catch {
            setValidation(t("reservation.invalidDate"))
            requestAnimationFrame(() => errorRef.current?.focus())
            return
          }
          const duration = end.getTime() - start.getTime()
          if (
            !isValidPhone(phoneNumber) ||
            !tableId ||
            !Number.isInteger(guestCount) ||
            guestCount < 1 ||
            guestCount > 50 ||
            duration < 15 * 60_000 ||
            duration > 8 * 3_600_000 ||
            end.getTime() <= Date.now() ||
            (!initial && start.getTime() <= Date.now())
          ) {
            setValidation(
              t("reservation.staffValidation"),
            )
            requestAnimationFrame(() => errorRef.current?.focus())
            return
          }
          setValidation('')
          if (!initial) {
            mutation.mutate({})
            return
          }
          const changes: UpdateReservationPayload = {
            ...(customerName.trim() !== (initial.customerName ?? '')
              ? { customerName: customerName.trim() || null }
              : {}),
            ...(normalizePhone(phoneNumber) !== normalizePhone(initial.phoneNumber)
              ? { phoneNumber: normalizePhone(phoneNumber) }
              : {}),
            ...(tableId !== initial.tableId ? { tableId } : {}),
            ...(guestCount !== initial.guestCount ? { guestCount } : {}),
            ...(notes.trim() !== (initial.notes ?? '') ? { notes: notes.trim() || null } : {}),
            ...(startsAt !== toReservationLocal(new Date(initial.startsAt))
              ? { startsAt: start.toISOString() }
              : {}),
            ...(endsAt !== toReservationLocal(new Date(initial.endsAt))
              ? { endsAt: end.toISOString() }
              : {}),
          }
          if (!Object.keys(changes).length) {
            props.onClose()
            return
          }
          mutation.mutate({ ...changes, expectedUpdatedAt: initial.updatedAt })
        }}
      >
        {(validation || mutation.isError) && (
          <p ref={errorRef} tabIndex={-1} role="alert" className="text-sm text-destructive">
            {validation || errorMessage(mutation.error)}
          </p>
        )}
        <fieldset
          disabled={mutation.isPending || blocked}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <div className="space-y-1">
            <label htmlFor={`${id}-name`} className="text-sm font-medium">
              {t("reservation.staffCustomer")}
            </label>
            <Input
              id={`${id}-name`}
              value={customerName}
              maxLength={120}
              onChange={(event) => setCustomerName(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={`${id}-phone`} className="text-sm font-medium">
              {t("reservation.phone")}
            </label>
            <Input
              id={`${id}-phone`}
              type="tel"
              value={phoneNumber}
              required
              minLength={8}
              maxLength={30}
              onChange={(event) => setPhoneNumber(event.target.value)}
            />
          </div>
          <TableSelect
            employeeId={props.employeeId}
            canReadTables={props.canReadTables}
            value={tableId}
            id={`${id}-table`}
            onChange={setTableId}
            initial={initial?.table}
            window={window}
            excludeReservationId={initial?.id}
            onConfirmed={setConfirmedTable}
          />
          <div className="space-y-1">
            <label htmlFor={`${id}-guests`} className="text-sm font-medium">
              {t("reservation.guestCount")}
            </label>
            <Input
              id={`${id}-guests`}
              type="number"
              value={guestCount}
              required
              min={1}
              max={50}
              step={1}
              onChange={(event) => setGuestCount(Number(event.target.value))}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={`${id}-start`} className="text-sm font-medium">
              {t("reservation.startLocal")}
            </label>
            <Input
              id={`${id}-start`}
              type="datetime-local"
              value={startsAt}
              required
              onChange={(event) => setStartsAt(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={`${id}-end`} className="text-sm font-medium">
              {t("reservation.endLocal")}
            </label>
            <Input
              id={`${id}-end`}
              type="datetime-local"
              value={endsAt}
              required
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor={`${id}-notes`} className="text-sm font-medium">
              {t("reservation.notes")}
            </label>
            <Input
              id={`${id}-notes`}
              value={notes}
              maxLength={500}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </fieldset>
        {blocked && (
          <div className="space-y-2 text-sm">
            <p>
              {initial
                ? t("reservation.reviewEdit")
                : t("reservation.unknownCreate")}
            </p>
            {onReload && (
              <Button type="button" variant="outline" onClick={onReload}>
                <RefreshCw size={16} />
                {t("reservation.reconcile")}
              </Button>
            )}
          </div>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={props.onClose}
          >
            {t("roles.close")}
          </Button>
          <Button
            type="submit"
            disabled={
              mutation.isPending || blocked || !tableReady
            }
          >
            {mutation.isPending ? t("reservation.saving") : initial ? t("reservation.saveChanges") : t("reservation.confirmCreate")}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

export type ReservationCommand =
  | { kind: 'approve' | 'reject'; request: ReservationRequest }
  | { kind: 'cancel' | 'check-in'; reservation: Reservation }

export function ReservationCommandModal(
  props: ModalProps & { target: ReservationCommand; canReadPos: boolean },
) {
  const { t } = useTranslation()
  const { target } = props
  const isRequest = 'request' in target
  const targetId = isRequest ? target.request.id : target.reservation.id
  const query = useQuery<Reservation | ReservationRequest>({
    queryKey: [
      'private',
      props.employeeId,
      isRequest ? 'reservation-request-detail' : 'reservation-detail',
      targetId,
    ],
    queryFn: ({ signal }) =>
      isRequest
        ? getReservationRequestById(String(targetId), signal)
        : getReservationById(Number(targetId), signal),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  if (!query.isSuccess || query.isFetching)
    return (
      <Dialog open onClose={props.onClose}>
        <DialogTitle>{t("reservation.commandTitle")}</DialogTitle>
        {query.isFetching ? (
          <p role="status">{t("reservation.loadingCurrent")}</p>
        ) : (
          <>
            <p role="alert">{errorMessage(query.error)}</p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              <RefreshCw size={16} />
              {t("reservation.reloadCurrent")}
            </Button>
          </>
        )}
      </Dialog>
    )
  return (
    <ReservationCommandForm {...props} current={query.data} onReload={() => void query.refetch()} />
  )
}

function ReservationCommandForm({
  target,
  current,
  onReload,
  canReadPos,
  ...props
}: ModalProps & {
  target: ReservationCommand
  current: Reservation | ReservationRequest
  onReload: () => void
  canReadPos: boolean
}) {
  const { t } = useTranslation()
  const id = useId()
  const navigate = useNavigate()
  const errorRef = useRef<HTMLParagraphElement>(null)
  const [reason, setReason] = useState('')
  const [tableId, setTableId] = useState('')
  const [confirmedTable, setConfirmedTable] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [checkInResult, setCheckInResult] = useState<CheckInResult | null>(null)
  const [openedAt] = useState(() => Date.now())
  const title =
    target.kind === 'approve'
      ? t("reservation.approveTitle")
      : target.kind === 'reject'
        ? t("reservation.rejectTitle")
        : target.kind === 'cancel'
          ? t('reservation.cancelTitle', { id: current.id })
          : t('reservation.checkInTitle', { id: current.id })
  const mutation = useMutation({
    mutationFn: async () => {
      switch (target.kind) {
        case 'approve':
          await approveReservationRequest(target.request.id, tableId)
          return null
        case 'reject':
          await rejectReservationRequest(target.request.id, reason.trim())
          return null
        case 'cancel':
          await cancelReservation(target.reservation.id, reason.trim())
          return null
        case 'check-in':
          return checkInReservation(target.reservation.id)
      }
    },
    retry: false,
    onSuccess: (result) => {
      if (result) setCheckInResult(result)
      else props.onSuccess()
    },
    onSettled: props.onSettled,
    onError: (error) => {
      setBlocked(!(error instanceof ApiError) || error.status >= 500 || error.status === 409)
      requestAnimationFrame(() => errorRef.current?.focus())
    },
  })
  const sessionId =
    checkInResult?.orderSession.id ?? ('orderSessionId' in current ? current.orderSessionId : null)
  const terminal = current.status !== 'PENDING' || Boolean(checkInResult)
  const expiredApproval = target.kind === 'approve' && Date.parse(current.startsAt) <= openedAt
  const window = { startsAt: current.startsAt, endsAt: current.endsAt }
  const tableReady = Boolean(tableId) && confirmedTable === tableAvailabilityKey(window, tableId)
  return (
    <Dialog
      open
      onClose={() => {
        if (!mutation.isPending) props.onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>{checkInResult ? t("reservation.checkedInTitle") : title}</DialogTitle>
      </DialogHeader>
      <p className="break-words text-sm font-medium">
        {current.customerName || t("reservation.walkIn")} · {current.phoneNumber} · {current.guestCount}{' '}
        {t("reservation.peopleLabel")}
      </p>
      {'table' in current && current.table && (
        <p className="break-words text-sm font-medium">{t("reservation.tablePrefix")} {current.table.name}</p>
      )}
      <p className="text-sm">
        {formatReservationDateTime(current.startsAt)} – {formatReservationDateTime(current.endsAt)}
      </p>
      {terminal ? (
        <>
          <p role="status">{t("reservation.statusPrefix")} {reservationStatusLabel(checkInResult ? 'ARRIVED' : current.status, 'request' in target)}</p>
          {'reservationId' in current && current.reservationId && (
            <p className="text-sm">{t("reservation.assignedId")}{current.reservationId}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={props.onClose}>
              {t("roles.close")}
            </Button>
            {canReadPos && sessionId && (
              <Button
                onClick={() => {
                  props.onClose()
                  navigate(`/staff/pos/sessions/${sessionId}`)
                }}
              >
                <LogIn size={16} />
                {t("reservation.openPos")}
              </Button>
            )}
          </DialogFooter>
        </>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (
              mutation.isPending ||
              blocked ||
              expiredApproval ||
              (target.kind === 'approve' && !tableReady) ||
              ((target.kind === 'reject' || target.kind === 'cancel') && !reason.trim())
            )
              return
            mutation.mutate()
          }}
        >
          {mutation.isError && (
            <p ref={errorRef} tabIndex={-1} role="alert" className="text-sm text-destructive">
              {errorMessage(mutation.error)}
            </p>
          )}
          {expiredApproval && (
            <p role="alert" className="text-sm text-destructive">
              {t("reservation.expiredApproval")}
            </p>
          )}
          <fieldset disabled={mutation.isPending || blocked} className="space-y-4">
            {target.kind === 'approve' && (
              <TableSelect
                employeeId={props.employeeId}
                canReadTables={props.canReadTables}
                value={tableId}
                onChange={setTableId}
                id={`${id}-table`}
                window={window}
                onConfirmed={setConfirmedTable}
              />
            )}
            {(target.kind === 'reject' || target.kind === 'cancel') && (
              <div className="space-y-1">
                <label htmlFor={`${id}-reason`} className="text-sm font-medium">
                  {target.kind === 'reject' ? t("reservation.rejectReason") : t("reservation.cancelReason")}
                </label>
                <Input
                  id={`${id}-reason`}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  required
                  maxLength={500}
                />
              </div>
            )}
          </fieldset>
          {blocked && (
            <Button type="button" variant="outline" onClick={onReload}>
              <RefreshCw size={16} />
              {t("reservation.reconcileStatus")}
            </Button>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={props.onClose}
            >
              {t("roles.close")}
            </Button>
            <Button
              type="submit"
              variant={
                target.kind === 'reject' || target.kind === 'cancel' ? 'destructive' : 'default'
              }
              disabled={
                mutation.isPending ||
                blocked ||
                expiredApproval ||
                (target.kind === 'approve' && !tableReady)
              }
            >
              {mutation.isPending
                ? t("reservation.processing")
                : target.kind === 'approve'
                  ? t("reservation.confirmApprove")
                  : target.kind === 'reject'
                    ? t("reservation.confirmReject")
                    : target.kind === 'cancel'
                      ? t("reservation.confirmCancelStaff")
                      : t("reservation.confirmCheckIn")}
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  )
}
