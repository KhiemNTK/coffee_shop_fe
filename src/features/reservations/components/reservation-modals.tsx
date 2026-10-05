import { useId, useRef, useState } from 'react'
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
import { getDiningTables } from '../../pos/pos.api'
import { posKeys } from '../../pos/pos.keys'
import { ApiError, errorMessage } from '../../../shared/api/client'
import { Button, Dialog, DialogFooter, DialogHeader, DialogTitle, Input } from '../../../shared/ui'

type ModalProps = {
  employeeId: string
  canReadTables: boolean
  onClose: () => void
  onSuccess: () => void
  onSettled: () => void
}

function TableSelect({
  employeeId,
  canReadTables,
  value,
  onChange,
  id,
  initial,
}: Pick<ModalProps, 'employeeId' | 'canReadTables'> & {
  value: string
  onChange: (value: string) => void
  id: string
  initial?: Reservation['table']
}) {
  const query = useQuery({
    queryKey: posKeys.tables(employeeId),
    queryFn: ({ signal }) => getDiningTables(signal),
    enabled: canReadTables,
    staleTime: 30_000,
  })
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">
        Bàn phục vụ
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        disabled={!canReadTables || !query.isSuccess || query.isFetching}
        className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
      >
        <option value="">Chọn bàn</option>
        {initial && !query.data?.some((table) => table.id === initial.id) && (
          <option value={initial.id}>{initial.name}</option>
        )}
        {query.data?.map((table) => (
          <option key={table.id} value={table.id}>
            {table.name}
          </option>
        ))}
      </select>
      {!canReadTables ? (
        <p className="text-sm text-muted-foreground">Bạn không có quyền xem danh sách bàn.</p>
      ) : query.isPending ? (
        <p role="status" className="text-sm">
          Đang tải bàn…
        </p>
      ) : query.isError ? (
        <div role="alert" className="text-sm text-destructive">
          {errorMessage(query.error)}
          <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
            <RefreshCw size={16} />
            Tải lại bàn
          </Button>
        </div>
      ) : (
        query.data?.length === 0 && <p className="text-sm">Chưa có bàn phục vụ.</p>
      )}
    </div>
  )
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
        <DialogTitle>Điều chỉnh lịch đặt bàn #{props.reservation.id}</DialogTitle>
        {query.isFetching ? (
          <p role="status">Đang tải lịch đặt bàn…</p>
        ) : (
          <>
            <p role="alert">{errorMessage(query.error)}</p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              <RefreshCw size={16} />
              Tải lại lịch
            </Button>
          </>
        )}
      </Dialog>
    )
  if (query.data.status !== 'PENDING')
    return (
      <Dialog open onClose={props.onClose}>
        <DialogTitle>Lịch đặt bàn #{props.reservation.id}</DialogTitle>
        <p role="status">Lịch đã chuyển sang {query.data.status}, không thể sửa.</p>
      </Dialog>
    )
  return <ReservationEditor {...props} initial={query.data} onReload={() => void query.refetch()} />
}

function ReservationEditor({
  initial,
  onReload,
  ...props
}: ModalProps & { initial?: Reservation; onReload?: () => void }) {
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
  const mutation = useMutation({
    mutationFn: (payload: UpdateReservationPayload) =>
      initial
        ? updateReservation(initial.id, payload)
        : createReservation({
            phoneNumber,
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
            ? `Điều chỉnh lịch đặt bàn #${initial.id}`
            : 'Tạo đặt bàn mới tại quầy / điện thoại'}
        </DialogTitle>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (mutation.isPending || blocked) return
          let start: Date, end: Date
          try {
            start = fromReservationLocal(startsAt)
            end = fromReservationLocal(endsAt)
          } catch {
            setValidation('Ngày giờ chưa hợp lệ.')
            requestAnimationFrame(() => errorRef.current?.focus())
            return
          }
          const duration = end.getTime() - start.getTime()
          if (
            !/^[0-9+()\-\s]{8,20}$/.test(phoneNumber.trim()) ||
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
              'Kiểm tra số điện thoại, bàn, số khách (1–50) và khung giờ (15 phút–8 giờ). Lịch mới phải bắt đầu trong tương lai.',
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
            ...(phoneNumber.trim() !== initial.phoneNumber
              ? { phoneNumber: phoneNumber.trim() }
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
              Tên khách hàng
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
              Số điện thoại
            </label>
            <Input
              id={`${id}-phone`}
              type="tel"
              value={phoneNumber}
              required
              minLength={8}
              maxLength={20}
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
          />
          <div className="space-y-1">
            <label htmlFor={`${id}-guests`} className="text-sm font-medium">
              Số lượng khách
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
              Giờ bắt đầu (Việt Nam)
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
              Giờ kết thúc (Việt Nam)
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
              Ghi chú
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
                ? 'Đối chiếu lịch mới nhất trước khi sửa tiếp.'
                : 'Chưa xác nhận được kết quả. Đối chiếu danh sách theo số điện thoại trước khi tạo lịch khác.'}
            </p>
            {onReload && (
              <Button type="button" variant="outline" onClick={onReload}>
                <RefreshCw size={16} />
                Đối chiếu lịch
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
            Đóng
          </Button>
          <Button
            type="submit"
            disabled={
              mutation.isPending || blocked || (!initial && (!tableId || !props.canReadTables))
            }
          >
            {mutation.isPending ? 'Đang lưu…' : initial ? 'Lưu thay đổi' : 'Xác nhận đặt bàn'}
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
        <DialogTitle>Xác nhận thao tác đặt bàn</DialogTitle>
        {query.isFetching ? (
          <p role="status">Đang tải trạng thái mới nhất…</p>
        ) : (
          <>
            <p role="alert">{errorMessage(query.error)}</p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              <RefreshCw size={16} />
              Tải lại trạng thái
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
  const id = useId()
  const navigate = useNavigate()
  const errorRef = useRef<HTMLParagraphElement>(null)
  const [reason, setReason] = useState('')
  const [tableId, setTableId] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [checkInResult, setCheckInResult] = useState<CheckInResult | null>(null)
  const [openedAt] = useState(() => Date.now())
  const title =
    target.kind === 'approve'
      ? 'Phê duyệt & Xếp bàn cho yêu cầu'
      : target.kind === 'reject'
        ? 'Từ chối yêu cầu đặt bàn'
        : target.kind === 'cancel'
          ? `Hủy lịch đặt bàn #${current.id}`
          : `Đón khách cho lịch #${current.id}`
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
  return (
    <Dialog
      open
      onClose={() => {
        if (!mutation.isPending) props.onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>{checkInResult ? 'Đón khách vào bàn thành công!' : title}</DialogTitle>
      </DialogHeader>
      <p className="break-words text-sm font-medium">
        {current.customerName || 'Khách vãng lai'} · {current.phoneNumber} · {current.guestCount}{' '}
        người
      </p>
      {'table' in current && current.table && (
        <p className="break-words text-sm font-medium">Bàn: {current.table.name}</p>
      )}
      <p className="text-sm">
        {formatReservationDateTime(current.startsAt)} – {formatReservationDateTime(current.endsAt)}
      </p>
      {terminal ? (
        <>
          <p role="status">Trạng thái: {checkInResult ? 'ARRIVED' : current.status}</p>
          {'reservationId' in current && current.reservationId && (
            <p className="text-sm">Mã lịch đặt bàn: #{current.reservationId}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={props.onClose}>
              Đóng
            </Button>
            {canReadPos && sessionId && (
              <Button
                onClick={() => {
                  props.onClose()
                  navigate(`/staff/pos/sessions/${sessionId}`)
                }}
              >
                <LogIn size={16} />
                Mở phiên POS ngay
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
              (target.kind === 'approve' && (!tableId || !props.canReadTables)) ||
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
              Khung giờ bắt đầu đã qua, không thể duyệt.
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
              />
            )}
            {(target.kind === 'reject' || target.kind === 'cancel') && (
              <div className="space-y-1">
                <label htmlFor={`${id}-reason`} className="text-sm font-medium">
                  {target.kind === 'reject' ? 'Lý do từ chối' : 'Lý do hủy'}
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
              Đối chiếu trạng thái
            </Button>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={props.onClose}
            >
              Đóng
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
                (target.kind === 'approve' && (!tableId || !props.canReadTables))
              }
            >
              {mutation.isPending
                ? 'Đang xử lý…'
                : target.kind === 'approve'
                  ? 'Xác nhận duyệt'
                  : target.kind === 'reject'
                    ? 'Xác nhận từ chối'
                    : target.kind === 'cancel'
                      ? 'Xác nhận hủy lịch'
                      : 'Xác nhận đón khách'}
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  )
}
