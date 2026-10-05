import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CalendarDays, Copy, RefreshCw, Search } from 'lucide-react'
import {
  createPublicReservationRequest,
  trackPublicReservationRequest,
  cancelPublicReservationRequest,
  type CreatePublicReservationPayload,
} from './reservations.api'
import {
  fromReservationLocal,
  toReservationLocal,
  formatReservationDateTime,
} from './reservation-time'
import { ApiError, errorMessage } from '../../shared/api/client'
import { authConfig } from '../auth/auth.config'
import { Turnstile } from '../auth/turnstile'
import { Button, Dialog, DialogFooter, DialogTitle, Input } from '../../shared/ui'

const storageKey = 'coffee_shop_reservation_access_token'
const pendingKey = `${storageKey}_pending`
const validToken = (value: string) => /^[A-Za-z0-9_-]{43}$/.test(value)

function savedToken() {
  try {
    const value = sessionStorage.getItem(storageKey) ?? localStorage.getItem(storageKey)
    if (value && validToken(value)) {
      sessionStorage.setItem(storageKey, value)
      localStorage.removeItem(storageKey)
      return value
    }
  } catch {
    /* Storage can be unavailable in restricted browsers. */
  }
  return null
}

export function PublicReservationsPage() {
  const errorRef = useRef<HTMLParagraphElement>(null)
  const uncertainRef = useRef(false)
  const submittingRef = useRef(false)
  const [tokenInput, setTokenInput] = useState('')
  const [activeToken, setActiveToken] = useState(savedToken)
  const [customerName, setCustomerName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [guestCount, setGuestCount] = useState(2)
  const [durationHours, setDurationHours] = useState(1.5)
  const [notes, setNotes] = useState('')
  const [startsAt, setStartsAt] = useState(
    () => `${toReservationLocal(new Date(Date.now() + 86_400_000)).slice(0, 10)}T18:00`,
  )
  const [formError, setFormError] = useState('')
  // ponytail: draft stays in memory; reload supports token lookup only, without persisted PII.
  const [pendingPayload, setPendingPayload] = useState<CreatePublicReservationPayload | null>(null)
  const [captcha, setCaptcha] = useState('')
  const [captchaAttempt, setCaptchaAttempt] = useState(0)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const unavailable = import.meta.env.PROD && !authConfig.turnstileSiteKey
  const tracking = useQuery({
    queryKey: ['public', 'track-reservation', activeToken],
    queryFn: () => trackPublicReservationRequest(activeToken!),
    enabled: Boolean(activeToken),
    gcTime: 0,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.status === 'PENDING' ||
      (query.state.data?.status === 'APPROVED' && query.state.data.reservationStatus === 'PENDING')
        ? 10_000
        : false,
  })
  const create = useMutation({
    mutationFn: async (payload: CreatePublicReservationPayload) => {
      const result = await createPublicReservationRequest(payload)
      if (result.accessToken !== payload.clientRequestToken)
        throw new ApiError(502, 'CLIENT_RESPONSE_INVALID')
      return result
    },
    retry: false,
    onSuccess: (result) => {
      uncertainRef.current = false
      setFormError('')
      setPendingPayload(null)
      setActiveToken(result.accessToken)
      try {
        sessionStorage.removeItem(pendingKey)
      } catch {
        /* Keep the token in memory. */
      }
    },
    onError: (error) => {
      setFormError(errorMessage(error))
      const rejected = error instanceof ApiError && error.status >= 400 && error.status < 500
      if (rejected && !uncertainRef.current) {
        setPendingPayload(null)
        try {
          sessionStorage.removeItem(storageKey)
          sessionStorage.removeItem(pendingKey)
        } catch {
          /* No confirmed request exists. */
        }
      }
      if (!rejected) uncertainRef.current = true
      requestAnimationFrame(() => errorRef.current?.focus())
    },
    onSettled: () => {
      submittingRef.current = false
      setCaptcha('')
      setCaptchaAttempt((value) => value + 1)
    },
  })
  const cancel = useMutation({
    mutationFn: () => cancelPublicReservationRequest(activeToken!),
    retry: false,
    onSuccess: () => {
      setCancelOpen(false)
      void tracking.refetch()
    },
  })
  useEffect(() => {
    if (!tracking.isSuccess || !activeToken) return
    uncertainRef.current = false
    try {
      sessionStorage.removeItem(pendingKey)
    } catch {
      /* Tracking already proves the request exists. */
    }
  }, [tracking.isSuccess, activeToken])

  function forget() {
    try {
      sessionStorage.removeItem(storageKey)
      sessionStorage.removeItem(pendingKey)
      localStorage.removeItem(storageKey)
    } catch {
      /* In-memory lookup remains usable. */
    }
    setActiveToken(null)
    setTokenInput('')
    setCopied(false)
    setFormError('')
    create.reset()
    cancel.reset()
    setPendingPayload(null)
    uncertainRef.current = false
  }
  let unconfirmed = Boolean(pendingPayload)
  try {
    unconfirmed ||= sessionStorage.getItem(pendingKey) === 'true'
  } catch {
    /* Use the in-memory submission state. */
  }
  const locked = create.isPending || Boolean(pendingPayload)
  const data = tracking.data
  const reservationFinished =
    data?.status === 'APPROVED' && data.reservationStatus && data.reservationStatus !== 'PENDING'
  const label = reservationFinished
    ? {
        ARRIVED: 'Đã đón khách vào bàn',
        CANCELLED: 'Lịch đặt bàn đã hủy',
        NO_SHOW: 'Lịch đặt bàn đã quá hạn đón khách',
      }[data.reservationStatus as 'ARRIVED' | 'CANCELLED' | 'NO_SHOW']
    : data?.status === 'PENDING'
      ? 'Yêu cầu đang chờ quán xác nhận'
      : data?.status === 'APPROVED'
        ? 'Đã xác nhận lịch đặt bàn'
        : data?.status === 'REJECTED'
          ? 'Yêu cầu chưa được chấp thuận'
          : data?.status === 'CANCELLED'
            ? 'Yêu cầu đặt bàn đã hủy'
            : 'Yêu cầu đã hết hạn'

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link to="/" className="text-lg font-semibold">
            Coffee Shop
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm">
            <Link to="/order">Đặt mang đi</Link>
            <Link to="/">Xem thực đơn</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <CalendarDays size={24} />
          Đặt Chỗ Trước Tại Quán
        </h1>
        {activeToken ? (
          <section className="space-y-4 border-t border-border pt-4">
            <h2 className="text-lg font-semibold">Trạng thái yêu cầu đặt bàn của bạn</h2>
            <div className="flex items-start gap-2 rounded-md border border-border p-3">
              <div className="min-w-0 flex-1">
                <span className="text-sm text-muted-foreground">Mã truy cập cá nhân</span>
                <p className="break-all font-mono text-xs">{activeToken}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Sao chép mã truy cập"
                title="Sao chép mã truy cập"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(activeToken)
                    .then(() => setCopied(true))
                    .catch(() => setCopied(false))
                }}
              >
                <Copy size={16} />
              </Button>
            </div>
            {copied && (
              <p role="status" className="text-sm">
                Đã sao chép mã.
              </p>
            )}
            {tracking.isError ? (
              <div role="alert" className="space-y-3 text-sm text-destructive">
                <p>{errorMessage(tracking.error)}</p>
                {unconfirmed && (
                  <p>
                    Chưa xác nhận được kết quả gửi. Giữ mã truy cập và đối chiếu trước khi tạo yêu
                    cầu khác.
                  </p>
                )}
                <Button
                  variant="outline"
                  disabled={tracking.isFetching}
                  onClick={() => void tracking.refetch()}
                >
                  <RefreshCw size={16} />
                  Tải lại trạng thái
                </Button>
                {pendingPayload && (
                  <Button variant="outline" onClick={() => setActiveToken(null)}>
                    Quay lại yêu cầu đã gửi
                  </Button>
                )}
              </div>
            ) : tracking.isPending ? (
              <p role="status">Đang tải trạng thái…</p>
            ) : (
              data && (
                <>
                  <p role="status" className="border-l-4 border-primary pl-3 font-semibold">
                    {label}
                  </p>
                  <dl className="grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-muted-foreground">Bắt đầu (Việt Nam)</dt>
                      <dd>{formatReservationDateTime(data.startsAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Kết thúc (Việt Nam)</dt>
                      <dd>{formatReservationDateTime(data.endsAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Số khách</dt>
                      <dd>{data.guestCount} người</dd>
                    </div>
                  </dl>
                  {data.status === 'PENDING' && (
                    <Button
                      variant="outline"
                      disabled={cancel.isPending || tracking.isFetching}
                      onClick={() => {
                        cancel.reset()
                        setCancelOpen(true)
                      }}
                    >
                      Hủy yêu cầu đặt bàn này
                    </Button>
                  )}
                </>
              )
            )}
            <Button
              variant="outline"
              disabled={cancel.isPending || (unconfirmed && !tracking.isSuccess)}
              onClick={forget}
            >
              Đặt thêm yêu cầu khác
            </Button>
          </section>
        ) : (
          <section className="space-y-6 border-t border-border pt-4">
            <h2 className="text-lg font-semibold">Điền thông tin đặt bàn</h2>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                if (
                  submittingRef.current ||
                  create.isPending ||
                  unavailable ||
                  (authConfig.turnstileSiteKey && !captcha)
                )
                  return
                setFormError('')
                if (pendingPayload) {
                  submittingRef.current = true
                  create.mutate({ ...pendingPayload, turnstileToken: captcha || undefined })
                  return
                }
                try {
                  const start = fromReservationLocal(startsAt)
                  if (
                    !customerName.trim() ||
                    !/^[0-9+()\-\s]{8,20}$/.test(phoneNumber.trim()) ||
                    !Number.isInteger(guestCount) ||
                    guestCount < 1 ||
                    guestCount > 50 ||
                    start.getTime() <= Date.now() ||
                    start.getTime() > Date.now() + 30 * 86_400_000
                  ) {
                    setFormError(
                      'Kiểm tra tên, số điện thoại, số khách (1–50) và ngày đến trong 30 ngày tới.',
                    )
                    requestAnimationFrame(() => errorRef.current?.focus())
                    return
                  }
                  const clientRequestToken = btoa(
                    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
                  )
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=+$/, '')
                  const payload = {
                    customerName: customerName.trim(),
                    phoneNumber: phoneNumber.trim(),
                    startsAt: start.toISOString(),
                    endsAt: new Date(start.getTime() + durationHours * 3_600_000).toISOString(),
                    guestCount,
                    notes: notes.trim() || undefined,
                    clientRequestToken,
                  }
                  // Preserve recovery capability before sending, without persisting customer contact details.
                  sessionStorage.setItem(storageKey, clientRequestToken)
                  sessionStorage.setItem(pendingKey, 'true')
                  submittingRef.current = true
                  setPendingPayload(payload)
                  create.mutate({ ...payload, turnstileToken: captcha || undefined })
                } catch {
                  submittingRef.current = false
                  setFormError(
                    'Kiểm tra ngày giờ và cho phép lưu phiên trên trình duyệt trước khi gửi yêu cầu.',
                  )
                  requestAnimationFrame(() => errorRef.current?.focus())
                }
              }}
            >
              {formError && (
                <p ref={errorRef} tabIndex={-1} role="alert" className="text-sm text-destructive">
                  {formError}
                </p>
              )}
              <fieldset disabled={locked} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="reservation-name" className="text-sm font-medium">
                    Họ và tên của bạn
                  </label>
                  <Input
                    id="reservation-name"
                    required
                    maxLength={120}
                    placeholder="Nguyễn Văn A"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="reservation-phone" className="text-sm font-medium">
                    Số điện thoại liên hệ
                  </label>
                  <Input
                    id="reservation-phone"
                    type="tel"
                    required
                    minLength={8}
                    maxLength={20}
                    placeholder="0912 345 678"
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value)}
                    autoComplete="tel"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="reservation-start" className="text-sm font-medium">
                    Ngày và giờ đến (Việt Nam)
                  </label>
                  <Input
                    id="reservation-start"
                    type="datetime-local"
                    required
                    value={startsAt}
                    onChange={(event) => setStartsAt(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="reservation-duration" className="text-sm font-medium">
                    Thời lượng dự kiến
                  </label>
                  <select
                    id="reservation-duration"
                    value={durationHours}
                    onChange={(event) => setDurationHours(Number(event.target.value))}
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  >
                    <option value={1}>1 giờ</option>
                    <option value={1.5}>1 giờ 30 phút</option>
                    <option value={2}>2 giờ</option>
                    <option value={3}>3 giờ</option>
                    <option value={4}>4 giờ</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="reservation-guests" className="text-sm font-medium">
                    Số lượng khách
                  </label>
                  <Input
                    id="reservation-guests"
                    type="number"
                    required
                    min={1}
                    max={50}
                    step={1}
                    value={guestCount}
                    onChange={(event) => setGuestCount(Number(event.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="reservation-notes" className="text-sm font-medium">
                    Yêu cầu đặc biệt
                  </label>
                  <Input
                    id="reservation-notes"
                    maxLength={500}
                    placeholder="Ví dụ: Ghế em bé, bàn gần cửa sổ..."
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </div>
              </fieldset>
              {unavailable && (
                <p role="alert" className="text-sm text-destructive">
                  Đặt bàn trực tuyến chưa sẵn sàng.
                </p>
              )}
              {authConfig.turnstileSiteKey && (
                <Turnstile
                  key={captchaAttempt}
                  siteKey={authConfig.turnstileSiteKey}
                  action="reservation_request"
                  onToken={setCaptcha}
                />
              )}
              {pendingPayload && create.isError && (
                <div className="space-y-2 text-sm">
                  <p>Chưa rõ kết quả gửi. Lần gửi lại giữ nguyên thông tin và mã yêu cầu.</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveToken(pendingPayload.clientRequestToken!)}
                  >
                    <Search size={16} />
                    Đối chiếu yêu cầu
                  </Button>
                </div>
              )}
              <Button
                type="submit"
                disabled={
                  create.isPending ||
                  unavailable ||
                  Boolean(authConfig.turnstileSiteKey && !captcha)
                }
              >
                {create.isPending
                  ? 'Đang gửi yêu cầu…'
                  : pendingPayload
                    ? 'Gửi lại yêu cầu đã gửi'
                    : 'Gửi yêu cầu đặt bàn ngay'}
              </Button>
            </form>
            <form
              className="space-y-2 border-t border-border pt-4"
              onSubmit={(event) => {
                event.preventDefault()
                if (locked) return
                const token = tokenInput.trim()
                if (!validToken(token)) {
                  setFormError('Mã truy cập phải gồm đúng 43 ký tự hợp lệ.')
                  return
                }
                try {
                  sessionStorage.setItem(storageKey, token)
                } catch {
                  /* Manual lookup does not create a request. */
                }
                setActiveToken(token)
              }}
            >
              <label htmlFor="reservation-token" className="text-sm font-medium">
                Tra cứu bằng mã truy cập
              </label>
              <div className="flex gap-2">
                <Input
                  id="reservation-token"
                  value={tokenInput}
                  disabled={locked}
                  maxLength={43}
                  autoComplete="off"
                  onChange={(event) => setTokenInput(event.target.value)}
                />
                <Button type="submit" variant="outline" disabled={locked}>
                  <Search size={16} />
                  Tra cứu
                </Button>
              </div>
            </form>
          </section>
        )}
      </main>
      {cancelOpen && (
        <Dialog
          open
          onClose={() => {
            if (!cancel.isPending) setCancelOpen(false)
          }}
        >
          <DialogTitle>Hủy yêu cầu đặt bàn?</DialogTitle>
          {cancel.isError && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(cancel.error)}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={cancel.isPending}
              onClick={() => setCancelOpen(false)}
            >
              Giữ yêu cầu
            </Button>
            {cancel.isError ? (
              <Button
                variant="outline"
                disabled={tracking.isFetching}
                onClick={() => {
                  void tracking.refetch().then((result) => {
                    if (result.isSuccess) {
                      cancel.reset()
                      setCancelOpen(false)
                    }
                  })
                }}
              >
                <RefreshCw size={16} />
                Đối chiếu trạng thái
              </Button>
            ) : (
              <Button
                variant="destructive"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate()}
              >
                {cancel.isPending ? 'Đang hủy…' : 'Xác nhận hủy yêu cầu'}
              </Button>
            )}
          </DialogFooter>
        </Dialog>
      )}
    </div>
  )
}
export default PublicReservationsPage
