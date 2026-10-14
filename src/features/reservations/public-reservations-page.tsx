import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CalendarDays, CheckCircle2, Copy, RefreshCw, Search, Sparkles } from 'lucide-react'
import { SiteHeader } from '@/shared/components/site-header'
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
  const { t: translate } = useTranslation()
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
        ARRIVED: translate('reservation.checkedIn'),
        CANCELLED: translate('reservation.cancelled'),
        NO_SHOW: translate('reservation.noShow'),
      }[data.reservationStatus as 'ARRIVED' | 'CANCELLED' | 'NO_SHOW']
    : data?.status === 'PENDING'
      ? translate('reservation.pending')
      : data?.status === 'APPROVED'
        ? translate('reservation.confirmed')
        : data?.status === 'REJECTED'
          ? translate('reservation.rejected')
          : data?.status === 'CANCELLED'
            ? translate('reservation.requestCancelled')
            : translate('reservation.expired')

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 flex-1 w-full">
        {activeToken ? (
          <div className="max-w-2xl mx-auto rounded-[18px] border border-border/80 bg-card p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-border/80">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-foreground">{translate('reservation.requestStatus')}</h1>
                <p className="text-xs text-muted-foreground">Thông tin chi tiết yêu cầu giữ chỗ tại quán</p>
              </div>
            </div>

            <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface-muted/50 p-4">
              <div className="min-w-0 flex-1">
                <span className="text-xs font-semibold text-muted-foreground block mb-1">
                  {translate('reservation.accessCode')}
                </span>
                <p className="break-all font-mono text-xs font-bold text-foreground select-all bg-card/80 p-2 rounded-lg border border-border/70">
                  {activeToken}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 mt-5"
                aria-label={translate('reservation.copyAccess')}
                title={translate('reservation.copyAccess')}
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(activeToken)
                    .then(() => setCopied(true))
                    .catch(() => setCopied(false))
                }}
              >
                <Copy size={15} />
                <span className="ml-1 text-xs">Sao chép</span>
              </Button>
            </div>

            {copied && (
              <p role="status" className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                {translate('reservation.copied')}
              </p>
            )}

            {tracking.isError ? (
              <div role="alert" className="space-y-3 text-sm text-destructive rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                <p className="font-semibold">{errorMessage(tracking.error)}</p>
                {unconfirmed && <p className="text-xs">{translate('reservation.uncertain')}</p>}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={tracking.isFetching}
                    onClick={() => void tracking.refetch()}
                  >
                    <RefreshCw size={14} className="mr-1.5" />
                    {translate('reservation.reloadStatus')}
                  </Button>
                  {pendingPayload && (
                    <Button variant="outline" size="sm" onClick={() => setActiveToken(null)}>
                      {translate('reservation.backToRequest')}
                    </Button>
                  )}
                </div>
              </div>
            ) : tracking.isPending ? (
              <div className="p-8 text-center text-muted-foreground animate-pulse text-sm" role="status">
                {translate('reservation.loadingStatus')}
              </div>
            ) : (
              data && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-muted-foreground block">Trạng thái</span>
                      <p role="status" className="text-base font-extrabold text-primary mt-0.5">
                        {label}
                      </p>
                    </div>
                    <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Sparkles className="h-4 w-4" />
                    </div>
                  </div>

                  <dl className="grid gap-3 sm:grid-cols-3 rounded-xl border border-border p-4 text-sm bg-card">
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">{translate('reservation.startsAt')}</dt>
                      <dd className="font-bold text-foreground mt-0.5">{formatReservationDateTime(data.startsAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">{translate('reservation.endsAt')}</dt>
                      <dd className="font-bold text-foreground mt-0.5">{formatReservationDateTime(data.endsAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">{translate('reservation.guests')}</dt>
                      <dd className="font-bold text-foreground mt-0.5">
                        {data.guestCount} {translate('reservation.people')}
                      </dd>
                    </div>
                  </dl>

                  {data.status === 'PENDING' && (
                    <Button
                      variant="outline"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      disabled={cancel.isPending || tracking.isFetching}
                      onClick={() => {
                        cancel.reset()
                        setCancelOpen(true)
                      }}
                    >
                      {translate('reservation.cancelRequest')}
                    </Button>
                  )}
                </div>
              )
            )}

            <div className="pt-2 border-t border-border flex justify-end">
              <Button
                variant="outline"
                disabled={cancel.isPending || (unconfirmed && !tracking.isSuccess)}
                onClick={forget}
              >
                {translate('reservation.anotherRequest')}
              </Button>
            </div>
          </div>
        ) : (
          /* 2-Column Booking Layout (Mockup Panel 4) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Right Column in DOM but on desktop on the right (7 cols) */}
            <div className="lg:col-span-7 order-1 lg:order-2">
              <div className="rounded-[18px] border border-border/80 bg-card p-6 sm:p-8 shadow-xs">
                <div className="mb-6 pb-4 border-b border-border/80">
                  <h1 className="flex items-center gap-2.5 text-xl sm:text-2xl font-extrabold text-foreground">
                    <CalendarDays className="h-6 w-6 text-primary shrink-0" />
                    <span>{translate('reservation.heading')}</span>
                  </h1>
                  <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                    {translate('reservation.details')}
                  </p>
                </div>
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
                    setFormError(translate('reservation.validation'))
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
                  setFormError(translate('reservation.storageValidation'))
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
                    {translate('reservation.customerName')}
                  </label>
                  <Input
                    id="reservation-name"
                    required
                    maxLength={120}
                    placeholder={translate('reservation.nameExample')}
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="reservation-phone" className="text-sm font-medium">
                    {translate('reservation.contactPhone')}
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
                    {translate('reservation.arrival')}
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
                    {translate('reservation.duration')}
                  </label>
                  <select
                    id="reservation-duration"
                    value={durationHours}
                    onChange={(event) => setDurationHours(Number(event.target.value))}
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  >
                    <option value={1}>{translate('reservation.oneHour')}</option>
                    <option value={1.5}>{translate('reservation.ninetyMinutes')}</option>
                    <option value={2}>{translate('reservation.twoHours')}</option>
                    <option value={3}>{translate('reservation.threeHours')}</option>
                    <option value={4}>{translate('reservation.fourHours')}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="reservation-guests" className="text-sm font-medium">
                    {translate('pos.guestCount')}
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
                    {translate('reservation.specialRequests')}
                  </label>
                  <Input
                    id="reservation-notes"
                    maxLength={500}
                    placeholder={translate('reservation.noteExample')}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </div>
              </fieldset>
              {unavailable && (
                <p role="alert" className="text-sm text-destructive">
                  {translate('reservation.unavailable')}
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
                  <p>{translate('reservation.retryUncertain')}</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveToken(pendingPayload.clientRequestToken!)}
                  >
                    <Search size={16} />
                    {translate('reservation.reviewRequest')}
                  </Button>
                </div>
              )}
              <Button
                type="submit"
                className="w-full h-11 rounded-[10px] bg-primary text-white font-bold text-sm shadow-xs hover:bg-primary-hover transition-all flex items-center justify-center gap-2 cursor-pointer"
                disabled={
                  create.isPending ||
                  unavailable ||
                  Boolean(authConfig.turnstileSiteKey && !captcha)
                }
              >
                {create.isPending
                  ? translate('reservation.submitting')
                  : pendingPayload
                    ? translate('reservation.resend')
                    : translate('reservation.submit')}
              </Button>
            </form>
          </div>
        </div>

        {/* Left Column in DOM, positioned left on desktop via order-1 (5 cols) */}
        <div className="lg:col-span-5 order-2 lg:order-1 space-y-6">
          <div className="rounded-[18px] border border-border/80 bg-card overflow-hidden shadow-xs">
            <div className="relative h-60 sm:h-72 w-full overflow-hidden bg-primary/20">
              <img
                src="/hero-coffee.jpg"
                alt="Không gian Coffee Homes"
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = '/menu-cover.jpg'
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/90 px-3 py-0.5 text-[11px] font-bold text-black uppercase tracking-wider mb-2">
                  <Sparkles className="h-3 w-3" />
                  <span>Không gian ấm cúng</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold leading-tight">Đặt bàn tại Coffee Homes</h2>
                <p className="text-xs text-emerald-100/90 mt-1">
                  Giữ chỗ trước để có trải nghiệm trọn vẹn nhất bên tách cà phê thơm ngon và góc ngồi ưng ý.
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-foreground">Xác nhận ngay lập tức</p>
                  <p className="text-xs text-muted-foreground">Đội ngũ phục vụ tiếp nhận và chuẩn bị bàn kịp thời.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-foreground">Giữ chỗ hoàn toàn miễn phí</p>
                  <p className="text-xs text-muted-foreground">Không yêu cầu phí đặt cọc cho các bàn thông thường.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-foreground">Dễ dàng thay đổi &amp; tra cứu lịch</p>
                  <p className="text-xs text-muted-foreground">Tra cứu tình trạng duyệt bàn dễ dàng qua mã truy cập cá nhân.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-foreground">Không cần đặt cọc</p>
                  <p className="text-xs text-muted-foreground">Thoải mái đến quán đúng giờ hẹn mà không lo ngại thủ tục.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tra cứu mã đặt bàn (Lookup Card) */}
          <div className="rounded-[18px] border border-border/80 bg-card p-5 sm:p-6 shadow-xs">
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                if (locked) return
                const token = tokenInput.trim()
                if (!validToken(token)) {
                  setFormError(translate('reservation.invalidAccess'))
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
              <label htmlFor="reservation-token" className="block text-sm font-bold text-foreground">
                {translate('reservation.lookupByAccess')}
              </label>
              <div className="flex gap-2">
                <Input
                  id="reservation-token"
                  value={tokenInput}
                  disabled={locked}
                  maxLength={43}
                  autoComplete="off"
                  placeholder="Nhập mã truy cập 43 ký tự..."
                  onChange={(event) => setTokenInput(event.target.value)}
                />
                <Button type="submit" variant="outline" disabled={locked} className="shrink-0">
                  <Search size={15} className="mr-1" />
                  {translate('reservation.lookup')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )}
      </main>
      {cancelOpen && (
        <Dialog
          open
          onClose={() => {
            if (!cancel.isPending) setCancelOpen(false)
          }}
        >
          <DialogTitle>{translate('reservation.cancelHeading')}</DialogTitle>
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
              {translate('reservation.keepRequest')}
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
                {translate('reservation.checkStatus')}
              </Button>
            ) : (
              <Button
                variant="destructive"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate()}
              >
                {cancel.isPending
                  ? translate('reservation.cancelling')
                  : translate('reservation.confirmCancel')}
              </Button>
            )}
          </DialogFooter>
        </Dialog>
      )}
    </div>
  )
}
export default PublicReservationsPage
